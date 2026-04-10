const supabase = require('../utils/supabase');
const instagramApi = require('./instagramApi');
const logger = require('../utils/logger');

/**
 * Check if a comment text matches any trigger keywords
 */
function matchesKeywords(commentText, keywords) {
  if (!keywords || keywords.length === 0) return false;
  const lowerText = commentText.toLowerCase().trim();
  return keywords.some((kw) => lowerText.includes(kw.toLowerCase().trim()));
}

/**
 * Main handler called when a comment webhook arrives
 * @param {object} commentData - { commentId, commentText, commenterIgId, postId, igAccountId }
 */
async function handleIncomingComment(commentData) {
  const { commentId, commentText, commenterIgId, postId, igAccountId } = commentData;

  logger.info(`Processing comment ${commentId} on post ${postId}`);

  try {
    // 1. Find active automations for this post
    const { data: automations, error } = await supabase
      .from('automations')
      .select(`
        *,
        instagram_accounts (
          access_token,
          ig_account_id,
          page_access_token
        )
      `)
      .eq('post_id', postId)
      .eq('status', 'active');

    if (error) {
      logger.error('DB error fetching automations:', error);
      return;
    }

    if (!automations || automations.length === 0) {
      logger.info(`No active automations for post ${postId}`);
      return;
    }

    for (const automation of automations) {
      await processAutomation(automation, commentData);
    }
  } catch (err) {
    logger.error('handleIncomingComment error:', err);
  }
}

/**
 * Process a single automation rule against a comment
 */
async function processAutomation(automation, commentData) {
  const { commentId, commentText, commenterIgId } = commentData;
  const account = automation.instagram_accounts;

  if (!account) {
    logger.warn(`No account linked to automation ${automation.id}`);
    return;
  }

  // 2. Keyword check (skip if match_all_comments is enabled)
  const keywords = automation.keywords || [];
  if (!automation.match_all_comments && !matchesKeywords(commentText, keywords)) {
    logger.info(`Comment does not match keywords for automation ${automation.id}`);
    return;
  }

  // 3. Check if we already processed this comment (dedup)
  const { data: existing } = await supabase
    .from('automation_logs')
    .select('id')
    .eq('comment_id', commentId)
    .eq('automation_id', automation.id)
    .single();

  if (existing) {
    logger.info(`Comment ${commentId} already processed for automation ${automation.id}`);
    return;
  }

  // 4. Log the attempt
  const { data: logEntry } = await supabase
    .from('automation_logs')
    .insert({
      automation_id: automation.id,
      comment_id: commentId,
      commenter_ig_id: commenterIgId,
      comment_text: commentText,
      status: 'processing',
    })
    .select()
    .single();

  let replySuccess = false;
  let dmSuccess = false;
  let replyError = null;
  let dmError = null;

  try {
    // 5. Send comment reply
    if (automation.reply_text) {
      try {
        await sendCommentReply(commentId, automation.reply_text, account.page_access_token);
        replySuccess = true;
        logger.info(`✅ Comment reply sent for automation ${automation.id}`);
      } catch (err) {
        replyError = err.message;
        logger.error(`❌ Comment reply failed: ${err.message}`);
      }
    }

    // 6. Send DM
    if (automation.dm_text && commenterIgId) {
      // Small delay to avoid rate limit issues
      await sleep(1000);
      try {
        const dmResult = await instagramApi.sendInstagramDM(
          account.ig_account_id,
          commenterIgId,
          automation.dm_text,
          account.page_access_token
        );
        dmSuccess = !dmResult.error;
        if (dmResult.error) dmError = dmResult.error;
        logger.info(`✅ DM sent to ${commenterIgId}`);
      } catch (err) {
        dmError = err.message;
        logger.error(`❌ DM failed: ${err.message}`);
      }
    }

    // 7. Update log
    await supabase
      .from('automation_logs')
      .update({
        status: replySuccess || dmSuccess ? 'completed' : 'failed',
        reply_sent: replySuccess,
        dm_sent: dmSuccess,
        reply_error: replyError,
        dm_error: dmError,
        processed_at: new Date().toISOString(),
      })
      .eq('id', logEntry.id);

    // 8. Increment automation trigger count
    await supabase.rpc('increment_trigger_count', { automation_id: automation.id });

  } catch (err) {
    logger.error(`Process automation error for ${automation.id}:`, err);
    if (logEntry) {
      await supabase
        .from('automation_logs')
        .update({ status: 'failed', reply_error: err.message })
        .eq('id', logEntry.id);
    }
  }
}

/**
 * Wrapper to send comment reply with token validation
 */
async function sendCommentReply(commentId, replyText, accessToken) {
  return instagramApi.sendCommentReply(commentId, replyText, accessToken);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  handleIncomingComment,
  matchesKeywords,
};
