// Humanisation helpers — make automated DMs look less like a bot to Meta's
// anti-spam ML and the recipients themselves. Patterns Meta watches for:
// fixed timing, identical text, no mark_seen/typing, velocity spikes, repeat
// targeting. Each helper here neutralises one of those signals.

const logger = require('./logger');

const DEFAULT_NOTICE_MS = [5_000, 25_000];   // 5–25s "noticing the comment"
const DEFAULT_TYPING_MS = [3_000, 12_000];   // 3–12s "typing"

const DEFAULT_HOURLY_CAP = 60;
const DEFAULT_DAILY_CAP = 400;
const DEFAULT_RECIPIENT_COOLDOWN_HOURS = 24;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Pick a random delay in the human "noticing → reading → typing" window.
 * Returns total milliseconds. Caller should use markSeen / typingOn split.
 */
function humanReplyDelay(noticeRange = DEFAULT_NOTICE_MS, typingRange = DEFAULT_TYPING_MS) {
  return {
    notice: randInt(noticeRange[0], noticeRange[1]),
    typing: randInt(typingRange[0], typingRange[1]),
  };
}

/**
 * Resolve {a|b|c} placeholders in a string, picking one variant per group.
 *
 *   pickVariant("hey {there|friend|y'all}! {here's|sending} your link")
 *   →  "hey friend! sending your link"
 *
 * Lets users write a single dm_text that produces dozens of distinct outputs
 * across recipients without us needing a separate template UI.
 */
function pickVariant(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const options = group.split('|').map(s => s.trim()).filter(Boolean);
    if (!options.length) return '';
    return options[randInt(0, options.length - 1)];
  });
}

/**
 * Per-recipient cooldown check — has this commenter already received a DM
 * from this account within the last N hours? Blocks a single user from being
 * spammed with the same automation across multiple posts in a short window.
 */
async function isRecipientOnCooldown(supabase, accountId, commenterIgId, hours = DEFAULT_RECIPIENT_COOLDOWN_HOURS) {
  if (!commenterIgId) return false;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('automation_logs')
    .select('id, automations!inner(instagram_account_id)')
    .eq('commenter_ig_id', commenterIgId)
    .eq('dm_sent', true)
    .gt('created_at', since)
    .eq('automations.instagram_account_id', accountId)
    .limit(1);
  if (error) {
    logger.warn(`Cooldown check failed (allowing send): ${error.message}`);
    return false;
  }
  return data && data.length > 0;
}

/**
 * Hourly throughput cap — count DMs already sent on this account in the last
 * hour. Returns true if we're at or above the cap (caller should skip/queue).
 */
async function isAccountAtHourlyCap(supabase, accountId, cap = DEFAULT_HOURLY_CAP) {
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count, error } = await supabase
    .from('automation_logs')
    .select('id, automations!inner(instagram_account_id)', { count: 'exact', head: true })
    .eq('dm_sent', true)
    .gt('created_at', since)
    .eq('automations.instagram_account_id', accountId);
  if (error) {
    logger.warn(`Hourly-cap check failed (allowing send): ${error.message}`);
    return false;
  }
  return (count || 0) >= cap;
}

module.exports = {
  randInt,
  sleep,
  humanReplyDelay,
  pickVariant,
  isRecipientOnCooldown,
  isAccountAtHourlyCap,
  DEFAULT_HOURLY_CAP,
  DEFAULT_DAILY_CAP,
  DEFAULT_RECIPIENT_COOLDOWN_HOURS,
};
