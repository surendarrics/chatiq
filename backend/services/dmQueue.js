// DM Queue Worker
// Comments that hit the hourly cap or a transient Meta error are parked in
// automation_logs with status='queued'. This worker polls every couple of
// minutes, processes whatever's ready, re-queues anything still capped, and
// expires anything past Meta's 7-day Private Reply window so we don't bang
// our head against the API for messages that can never land.

const axios = require('axios');
const supabase = require('../utils/supabase');
const logger = require('../utils/logger');
const {
  sleep, randInt, humanReplyDelay, pickVariant,
  isAccountAtHourlyCap,
} = require('../utils/humanize');

const POLL_INTERVAL_MS = 2 * 60 * 1000;       // 2 minutes
const WARMUP_DELAY_MS  = 30 * 1000;           // wait 30s after server boot
const BATCH_SIZE       = 5;                   // process up to N per tick
const MAX_AGE_DAYS     = 6;                   // 7d Private Reply window − 1d buffer
const MAX_RETRIES      = 20;                  // safety net so a permanent broken item can't loop forever

const GRAPH_API     = 'https://graph.facebook.com/v19.0';
const IG_GRAPH_API  = 'https://graph.instagram.com/v21.0';

async function processQueueOnce() {
  const nowIso = new Date().toISOString();

  // Pick rows whose backoff has elapsed (queued_until is null OR ≤ now).
  // We also pull the joined automation + account so we have everything
  // we need to send without follow-up queries per item.
  const { data: rows, error } = await supabase
    .from('automation_logs')
    .select(`
      id, automation_id, comment_id, commenter_ig_id, created_at, retry_count,
      automations:automation_id (
        id, dm_text, instagram_account_id,
        instagram_accounts:instagram_account_id (
          id, ig_account_id, access_token, page_access_token, page_id,
          message_access_enabled, username
        )
      )
    `)
    .eq('status', 'queued')
    .or(`queued_until.is.null,queued_until.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.warn(`DM queue poll failed: ${error.message}`);
    return;
  }
  if (!rows || rows.length === 0) return;

  logger.info(`📤 DM queue: processing ${rows.length} item(s)`);

  for (const row of rows) {
    try {
      await processOne(row);
    } catch (e) {
      logger.error(`Queue item ${row.id} crashed: ${e.message}`);
    }
    // Stagger sends within a batch so we don't burst.
    await sleep(randInt(2_000, 8_000));
  }
}

async function processOne(row) {
  const auto = row.automations;
  const account = auto?.instagram_accounts;
  if (!auto || !account) {
    await markFailed(row.id, 'Automation or account missing (deleted?)');
    return;
  }

  // ── Expire items past Meta's Private Reply window ────────────────
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > MAX_AGE_DAYS * 24 * 3600 * 1000) {
    await supabase
      .from('automation_logs')
      .update({
        status: 'expired',
        dm_error: 'Past 7-day Private Reply window',
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    logger.warn(`⏰ Queue ${row.id}: expired (>${MAX_AGE_DAYS}d old)`);
    return;
  }

  // ── Safety: kill items that have retried far too many times ──────
  if ((row.retry_count || 0) >= MAX_RETRIES) {
    await markFailed(row.id, `Exhausted ${MAX_RETRIES} retries`);
    return;
  }

  // ── Re-check hourly cap; re-queue with backoff if still capped ───
  if (await isAccountAtHourlyCap(supabase, account.id)) {
    const backoffMin = randInt(5, 15);
    await reQueue(row, backoffMin, 'still at hourly cap');
    return;
  }

  // ── Guard: account must have message access enabled ──────────────
  if (!account.message_access_enabled) {
    await markFailed(row.id, 'Message access not enabled');
    return;
  }

  // ── Send ─────────────────────────────────────────────────────────
  const isIgLogin = !account.page_id || account.page_id === '';
  const TOKEN = isIgLogin ? account.access_token : account.page_access_token;
  const API_BASE = isIgLogin ? IG_GRAPH_API : GRAPH_API;
  const dmParams = { access_token: TOKEN };
  if (API_BASE === GRAPH_API) dmParams.platform = 'instagram';

  // Same human-shaped delay we use on the live path
  const delay = humanReplyDelay();
  await sleep(delay.notice + delay.typing);

  try {
    const dmText = pickVariant(auto.dm_text);
    await axios.post(
      `${API_BASE}/me/messages`,
      { recipient: { comment_id: row.comment_id }, message: { text: dmText } },
      { params: dmParams }
    );
    await supabase
      .from('automation_logs')
      .update({
        status: 'completed',
        dm_sent: true,
        dm_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    logger.info(`✅ Queue ${row.id}: DM sent (was queued ${Math.round(ageMs / 60000)}min)`);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    const sub = err.response?.data?.error?.error_subcode;
    const code = err.response?.data?.error?.code;

    // Subcode 33 ("does not exist / missing permissions") is sometimes a
    // propagation race — retry. Most other errors are permanent.
    const isTransient = sub === 33 || code === 1 || code === 2;
    if (isTransient && (row.retry_count || 0) < MAX_RETRIES) {
      const backoffMin = randInt(10, 45);
      await reQueue(row, backoffMin, `transient error (subcode ${sub}): ${msg}`);
    } else {
      await markFailed(row.id, msg);
      logger.error(`❌ Queue ${row.id} permanently failed [${code}/${sub}]: ${msg}`);
    }
  }
}

async function reQueue(row, backoffMin, reason) {
  const queuedUntil = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
  await supabase
    .from('automation_logs')
    .update({
      status: 'queued',
      queued_until: queuedUntil,
      retry_count: (row.retry_count || 0) + 1,
      dm_error: reason.substring(0, 250),
    })
    .eq('id', row.id);
  logger.info(`⏰ Queue ${row.id}: re-queued for ${backoffMin}min (${reason})`);
}

async function markFailed(id, reason) {
  await supabase
    .from('automation_logs')
    .update({
      status: 'failed',
      dm_error: String(reason).substring(0, 250),
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

let intervalHandle = null;

function startQueueWorker() {
  if (intervalHandle) return;
  logger.info(`🔁 DM queue worker starting — poll every ${POLL_INTERVAL_MS / 1000}s, batch ${BATCH_SIZE}, max age ${MAX_AGE_DAYS}d`);

  // Warmup: don't hammer the DB the instant the server boots.
  setTimeout(() => {
    processQueueOnce().catch(e => logger.error('Queue tick error:', e.message));
  }, WARMUP_DELAY_MS);

  intervalHandle = setInterval(() => {
    processQueueOnce().catch(e => logger.error('Queue tick error:', e.message));
  }, POLL_INTERVAL_MS);
}

function stopQueueWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startQueueWorker, stopQueueWorker, processQueueOnce };
