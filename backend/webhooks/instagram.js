const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const supabase = require('../utils/supabase');
const { getCommenterFollowStatus, sendQuickReplyDM } = require('../services/instagramApi');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const IG_GRAPH_API = 'https://graph.instagram.com/v21.0';

// Payload prefix for the follow-gate "Following" quick-reply button.
// Format: CHATIQ_FOLLOW_CHECK:<automation_id>
const FOLLOW_CHECK_PAYLOAD_PREFIX = 'CHATIQ_FOLLOW_CHECK:';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /webhook/instagram — Meta verification handshake
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  console.log('❌ Webhook verification failed');
  return res.sendStatus(403);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /webhook/instagram — Receive real-time events from Meta
// Handles BOTH:
//  - Instagram Webhooks (object: "instagram", field: "comments")
//  - Facebook Page Webhooks (object: "page", field: "feed" with item: "comment")
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/instagram', async (req, res) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0: Log immediately so we ALWAYS see hits in Railway, no matter what
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════');
  console.log('📥 WEBHOOK POST HIT at', new Date().toISOString());
  console.log('   Headers:', JSON.stringify({
    'content-type': req.headers['content-type'],
    'x-hub-signature-256': req.headers['x-hub-signature-256'] ? '(present)' : '(MISSING)',
    'user-agent': req.headers['user-agent'],
  }));
  console.log('   Body type:', typeof req.body, Buffer.isBuffer(req.body) ? `(Buffer, ${req.body.length} bytes)` : '');
  console.log('═══════════════════════════════════════════');

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: ALWAYS return 200 immediately — Meta REQUIRES this.
  // If we return anything else, Meta retries and eventually STOPS sending.
  // ═══════════════════════════════════════════════════════════════════════
  res.sendStatus(200);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Parse body
  // ═══════════════════════════════════════════════════════════════════════
  let body;
  try {
    const raw = req.body;
    body = typeof raw === 'string' ? JSON.parse(raw) : (Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw);
  } catch (e) {
    console.error('❌ Failed to parse webhook body:', e.message);
    return;
  }

  console.log('📦 Parsed webhook body:');
  console.log(JSON.stringify(body, null, 2));

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Verify Meta Webhook Signature (OWASP Security)
  // We validate AFTER returning 200 so Meta doesn't stop sending webhooks.
  // If validation fails we LOG the issue but still process during debug.
  // ═══════════════════════════════════════════════════════════════════════
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  let signatureValid = false;

  if (!signature) {
    console.warn('⚠️ Webhook missing X-Hub-Signature-256 header');
  } else if (!appSecret) {
    console.warn('⚠️ No META_APP_SECRET or INSTAGRAM_APP_SECRET set — cannot validate signature');
  } else {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature === expectedSignature) {
        signatureValid = true;
        console.log('🔐 Webhook signature VALID ✅');
      } else {
        console.warn('⚠️ Webhook signature MISMATCH (logging but still processing)');
        console.warn('   Expected:', expectedSignature);
        console.warn('   Got:     ', signature);
      }
    } catch (e) {
      console.error('⚠️ Signature validation error:', e.message);
    }
  }

  // Log to file for inspection
  try {
    const fs = require('fs');
    fs.appendFileSync('webhook_inspect.log', JSON.stringify({ time: new Date().toISOString(), signatureValid, body }) + '\n');
  } catch (e) { }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Route the event
  // ═══════════════════════════════════════════════════════════════════════
  // Accept both 'instagram' and 'page' object types
  if (body.object !== 'instagram' && body.object !== 'page') {
    console.log(`⏭️ Ignoring object type: ${body.object}`);
    return;
  }

  for (const entry of body.entry || []) {
    const entryId = entry.id; // IG User ID or Page ID
    console.log(`📌 Processing entry ID: ${entryId}`);

    // ─── Handle Instagram Webhooks (object: "instagram") ─────
    for (const change of entry.changes || []) {
      console.log(`   📌 Change field: ${change.field}, object: ${body.object}`);

      if (change.field === 'comments') {
        // Instagram webhook comments format
        handleComment(entryId, change.value, 'instagram').catch(err =>
          console.error('❌ handleComment error:', err.message, err.stack)
        );
      }

      if (change.field === 'feed' && change.value?.item === 'comment') {
        // Facebook Page webhook comment format
        const feedValue = {
          id: change.value.comment_id,
          text: change.value.message || '',
          from: { id: change.value.sender_id || change.value.from?.id },
          media: { id: change.value.post_id },
        };
        handleComment(entryId, feedValue, 'page').catch(err =>
          console.error('❌ handleComment (feed) error:', err.message, err.stack)
        );
      }
    }

    // ─── Handle Messaging (for both Instagram and Page) ─────
    for (const msg of entry.messaging || []) {
      console.log('📩 Messaging event received:', JSON.stringify(msg).substring(0, 200));
      const qrPayload = msg.message?.quick_reply?.payload;
      if (qrPayload && qrPayload.startsWith(FOLLOW_CHECK_PAYLOAD_PREFIX)) {
        const automationId = qrPayload.slice(FOLLOW_CHECK_PAYLOAD_PREFIX.length);
        const senderId = msg.sender?.id;
        handleFollowCheck(entryId, automationId, senderId).catch(err =>
          console.error('❌ handleFollowCheck error:', err.message, err.stack)
        );
      }
    }
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE: Handle incoming comment
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleComment(entryId, value, source) {
  const commentId = value.id;
  const commentText = (value.text || '').trim();
  const commenterId = value.from?.id;
  const postId = value.media?.id;

  console.log(`\n💬 Comment received (source: ${source}):`);
  console.log(`   Text: "${commentText}"`);
  console.log(`   Comment ID: ${commentId}`);
  console.log(`   Commenter ID: ${commenterId}`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   Entry ID: ${entryId}`);

  if (!commentId || !commentText) {
    console.log('⏭️ Skipping: missing commentId or text');
    return;
  }

  // ── Find the Instagram account in DB ──
  // Try ig_account_id first, then page_id
  let account = null;

  const { data: byIg } = await supabase
    .from('instagram_accounts')
    .select('id, ig_account_id, access_token, page_access_token, page_id, message_access_enabled, username')
    .eq('ig_account_id', entryId)
    .single();

  if (byIg) {
    account = byIg;
  } else {
    const { data: byPage } = await supabase
      .from('instagram_accounts')
      .select('id, ig_account_id, access_token, page_access_token, page_id, message_access_enabled, username')
      .eq('page_id', entryId)
      .single();
    account = byPage;
  }

  if (!account) {
    console.log(`⚠️ No account found for entry ID: ${entryId}`);
    return;
  }

  // ── Do not reply to our own comments (avoids infinite loops/DOS) ──
  if (String(commenterId) === String(account.ig_account_id)) {
    console.log(`⏭️ Skipping comment because it's from our own account (@${account.username})`);
    return;
  }

  console.log(`✅ Matched account: @${account.username} (${account.ig_account_id})`);

  // Pick the right token and API base depending on login type
  const isIgLogin = !account.page_id || account.page_id === '';
  const TOKEN = isIgLogin ? account.access_token : account.page_access_token;
  const API_BASE = isIgLogin ? IG_GRAPH_API : GRAPH_API;

  console.log(`   Token type: ${isIgLogin ? 'Instagram Login' : 'Facebook Page'}`);
  console.log(`   API Base: ${API_BASE}`);

  // ── Check if post has an active automation ──
  const { data: automations } = await supabase
    .from('automations')
    .select('id, keywords, reply_text, dm_text, match_all_comments, require_follow, follow_gate_message, follow_button_label')
    .eq('post_id', postId)
    .eq('status', 'active');

  if (!automations || automations.length === 0) {
    console.log(`⏭️ No active automations for post: ${postId}`);
    return;
  }

  console.log(`📋 Found ${automations.length} active automation(s) for post ${postId}`);

  for (const auto of automations) {
    // ── Keyword matching ──
    const keywords = auto.keywords || [];
    const textLower = commentText.toLowerCase();

    const matched = auto.match_all_comments || keywords.some(kw =>
      textLower.includes(kw.toLowerCase().trim())
    );

    if (!matched) {
      console.log(`⏭️ Keywords not matched for automation ${auto.id}`);
      continue;
    }

    console.log(`🎯 KEYWORD MATCH! Automation: ${auto.id}`);

    // ── Dedup check ──
    const { data: existing } = await supabase
      .from('automation_logs')
      .select('id')
      .eq('comment_id', commentId)
      .eq('automation_id', auto.id)
      .single();

    if (existing) {
      console.log(`⏭️ Already processed comment ${commentId} for automation ${auto.id}`);
      continue;
    }

    let replySent = false;
    let dmSent = false;
    let replyError = null;
    let dmError = null;

    // ── Reply to comment ──
    // Meta error 100/subcode 33 ("Object ... does not exist") is usually a
    // propagation delay — the webhook fires before the comment is queryable.
    // Retry once after a delay, then fall back to the alternate Graph base
    // since IG Login tokens sometimes need graph.facebook.com for /replies.
    if (auto.reply_text) {
      const altBase = API_BASE === IG_GRAPH_API ? GRAPH_API : IG_GRAPH_API;
      const replyAttempts = [
        { base: API_BASE, delay: 0, label: 'primary' },
        { base: API_BASE, delay: 2500, label: 'primary+retry' },
        { base: altBase, delay: 0, label: 'alternate-base' },
      ];
      for (const attempt of replyAttempts) {
        if (attempt.delay) await new Promise(r => setTimeout(r, attempt.delay));
        try {
          const replyRes = await axios.post(
            `${attempt.base}/${commentId}/replies`,
            null,
            { params: { message: auto.reply_text, access_token: TOKEN } }
          );
          console.log(`✅ Comment reply sent via ${attempt.label}! Response:`, replyRes.data);
          replySent = true;
          replyError = null;
          break;
        } catch (err) {
          replyError = err.response?.data?.error?.message || err.message;
          const sub = err.response?.data?.error?.error_subcode;
          console.warn(`  ↳ reply attempt "${attempt.label}" failed [subcode ${sub}]: ${replyError}`);
        }
      }
      if (!replySent) {
        console.error(`❌ All comment-reply attempts failed for ${commentId}`);
      }
    }

    // ── Send DM (Private Reply to Comment) ──
    let followGateSent = false;
    let followGateUnlocked = false;
    if (auto.dm_text && commenterId) {
      // Guard: check if user confirmed message access is enabled
      if (!account.message_access_enabled) {
        console.warn(`⚠️ Skipping DM — message access not enabled for @${account.username}.`);
        dmError = 'Message access not enabled';
      } else {
        // Small delay to avoid rate limit
        await new Promise(r => setTimeout(r, 1000));

        // Decide: link DM directly, or follow-gate first?
        let shouldSendLink = !auto.require_follow;
        if (auto.require_follow) {
          const profile = await getCommenterFollowStatus(commenterId, account);
          if (profile?.is_user_follow_business === true) {
            shouldSendLink = true;
            followGateUnlocked = true;
            console.log(`✅ ${commenterId} already follows @${account.username} — sending link directly`);
          } else {
            console.log(`🔒 ${commenterId} doesn't follow yet (or unknown) — sending follow gate`);
          }
        }

        try {
          if (shouldSendLink) {
            const dmParams = { access_token: TOKEN };
            if (API_BASE === GRAPH_API) dmParams.platform = 'instagram';
            const dmRes = await axios.post(
              `${API_BASE}/me/messages`,
              {
                recipient: { comment_id: commentId },
                message: { text: auto.dm_text },
              },
              { params: dmParams }
            );
            console.log(`✅ Link DM sent! Response:`, dmRes.data);
            dmSent = true;
          } else {
            // Follow gate: send the gate message with a "Following" quick reply button.
            // Note: comment_id recipient is required for the FIRST DM (Private Reply rule)
            // but quick replies require recipient.id, so we send via comment_id with no
            // button first if needed. In practice the IG messaging API allows both via
            // comment_id; if buttons get stripped, the user still sees the text and
            // can click "Following" once they get any reply from us.
            const dmParams = { access_token: TOKEN };
            if (API_BASE === GRAPH_API) dmParams.platform = 'instagram';
            const gateText = auto.follow_gate_message
              || '🔔 The Workflow is exclusively for Followers. Follow to gain access! 🔔';
            const gateRes = await axios.post(
              `${API_BASE}/me/messages`,
              {
                recipient: { comment_id: commentId },
                message: {
                  text: gateText,
                  quick_replies: [
                    {
                      content_type: 'text',
                      title: auto.follow_button_label || 'Following',
                      payload: `${FOLLOW_CHECK_PAYLOAD_PREFIX}${auto.id}`,
                    },
                  ],
                },
              },
              { params: dmParams }
            );
            console.log(`✅ Follow-gate DM sent! Response:`, gateRes.data);
            followGateSent = true;
          }
        } catch (err) {
          dmError = err.response?.data?.error?.message || err.message;
          const fbErrorCode = err.response?.data?.error?.code;
          const fbErrorSubcode = err.response?.data?.error?.error_subcode;
          console.error(`❌ DM FAILED [Code: ${fbErrorCode}, Subcode: ${fbErrorSubcode}]:`, err.response?.data || err.message);
        }
      }
    }

    // ── Log to DB ──
    try {
      await supabase.from('automation_logs').insert({
        automation_id: auto.id,
        comment_id: commentId,
        commenter_ig_id: commenterId,
        comment_text: commentText,
        status: (replySent || dmSent || followGateSent) ? 'completed' : 'failed',
        reply_sent: replySent,
        dm_sent: dmSent,
        follow_gate_sent: followGateSent,
        follow_gate_unlocked: followGateUnlocked,
        reply_error: replyError ? String(replyError).substring(0, 250) : null,
        dm_error: dmError ? String(dmError).substring(0, 250) : null,
        processed_at: new Date().toISOString(),
      });

      await supabase.rpc('increment_trigger_count', { automation_id: auto.id });
      console.log(`📊 Logged to DB — reply: ${replySent}, dm: ${dmSent}, gate: ${followGateSent}`);
    } catch (dbErr) {
      console.error('⚠️ DB log failed:', dbErr.message);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOLLOW GATE: handle the "Following" button click
// Re-checks is_user_follow_business; if true, send the link DM. If still false,
// re-send the gate message so user can try again.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleFollowCheck(entryId, automationId, senderIgId) {
  if (!automationId || !senderIgId) {
    console.log('⏭️ handleFollowCheck: missing automation or sender id');
    return;
  }
  console.log(`🔁 Follow-check postback: automation=${automationId}, sender=${senderIgId}`);

  const { data: account } = await supabase
    .from('instagram_accounts')
    .select('id, ig_account_id, access_token, page_access_token, page_id, message_access_enabled, username')
    .or(`ig_account_id.eq.${entryId},page_id.eq.${entryId}`)
    .single();
  if (!account) {
    console.log(`⚠️ handleFollowCheck: no account for entry ${entryId}`);
    return;
  }

  const { data: auto } = await supabase
    .from('automations')
    .select('id, dm_text, follow_gate_message, follow_button_label, require_follow')
    .eq('id', automationId)
    .single();
  if (!auto) {
    console.log(`⚠️ handleFollowCheck: automation ${automationId} not found`);
    return;
  }

  const profile = await getCommenterFollowStatus(senderIgId, account);
  const isFollowing = profile?.is_user_follow_business === true;
  console.log(`   is_user_follow_business = ${profile?.is_user_follow_business}`);

  if (isFollowing && auto.dm_text) {
    // Send the actual link DM
    const isIgLogin = !account.page_id || account.page_id === '';
    const TOKEN = isIgLogin ? account.access_token : account.page_access_token;
    const API_BASE = isIgLogin ? IG_GRAPH_API : GRAPH_API;
    const dmParams = { access_token: TOKEN };
    if (API_BASE === GRAPH_API) dmParams.platform = 'instagram';
    try {
      await axios.post(
        `${API_BASE}/me/messages`,
        { recipient: { id: senderIgId }, message: { text: auto.dm_text } },
        { params: dmParams }
      );
      console.log(`✅ Unlocked: link DM sent to ${senderIgId}`);
      // Mark the most recent log row for this commenter+automation as unlocked
      await supabase
        .from('automation_logs')
        .update({ follow_gate_unlocked: true, dm_sent: true })
        .eq('automation_id', auto.id)
        .eq('commenter_ig_id', senderIgId)
        .eq('follow_gate_sent', true)
        .eq('follow_gate_unlocked', false);
    } catch (err) {
      console.error('❌ Unlock DM failed:', err.response?.data || err.message);
    }
  } else {
    // Still not following — re-send the gate message
    const gateText = auto.follow_gate_message
      || '🔔 The Workflow is exclusively for Followers. Follow to gain access! 🔔';
    await sendQuickReplyDM(
      account,
      senderIgId,
      gateText,
      auto.follow_button_label || 'Following',
      `${FOLLOW_CHECK_PAYLOAD_PREFIX}${auto.id}`
    );
    console.log(`🔒 Re-sent follow gate to ${senderIgId}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /webhook/test — Debug endpoint to verify webhook is reachable
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/test', (req, res) => {
  res.json({
    status: 'Webhook endpoint is reachable',
    deploy_version: '2026-04-14-fix-signature-blocking',
    timestamp: new Date().toISOString(),
    env_checks: {
      META_APP_SECRET: !!process.env.META_APP_SECRET,
      INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
      META_WEBHOOK_VERIFY_TOKEN: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NODE_ENV: process.env.NODE_ENV || 'not set',
    },
  });
});

module.exports = router;
