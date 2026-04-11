const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const supabase = require('../utils/supabase');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const IG_GRAPH_API = 'https://graph.instagram.com/v21.0';

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
  // ALWAYS return 200 immediately — Meta will retry if you don't
  res.sendStatus(200);

  let body;
  try {
    const raw = req.body;
    body = typeof raw === 'string' ? JSON.parse(raw) : (Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw);
  } catch (e) {
    console.error('❌ Failed to parse webhook body:', e.message);
    return;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('📥 WEBHOOK RECEIVED');
  console.log(`   Object type: ${body.object}`);
  console.log(JSON.stringify(body, null, 2));
  console.log('═══════════════════════════════════════════\n');

  try {
    const fs = require('fs');
    fs.appendFileSync('webhook_inspect.log', JSON.stringify({time: new Date().toISOString(), body}) + '\n');
  } catch(e){}

  // Accept both 'instagram' and 'page' object types
  if (body.object !== 'instagram' && body.object !== 'page') {
    console.log(`⏭️ Ignoring object type: ${body.object}`);
    return;
  }

  for (const entry of body.entry || []) {
    const entryId = entry.id; // IG User ID or Page ID

    // ─── Handle Instagram Webhooks (object: "instagram") ─────
    for (const change of entry.changes || []) {
      console.log(`📌 Change field: ${change.field}, object: ${body.object}`);

      if (change.field === 'comments') {
        // Instagram webhook comments format
        handleComment(entryId, change.value, 'instagram').catch(err =>
          console.error('❌ handleComment error:', err.message)
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
          console.error('❌ handleComment (feed) error:', err.message)
        );
      }
    }

    // ─── Handle Messaging (for both Instagram and Page) ─────
    for (const msg of entry.messaging || []) {
      console.log('📩 Messaging event received:', JSON.stringify(msg).substring(0, 200));
      // Future: handle incoming DMs here
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
    .select('id, keywords, reply_text, dm_text, match_all_comments')
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
    if (auto.reply_text) {
      try {
        const replyRes = await axios.post(
          `${API_BASE}/${commentId}/replies`,
          null,
          { params: { message: auto.reply_text, access_token: TOKEN } }
        );
        console.log(`✅ Comment reply sent! Response:`, replyRes.data);
        replySent = true;
      } catch (err) {
        replyError = err.response?.data?.error?.message || err.message;
        console.error(`❌ Comment reply FAILED:`, err.response?.data || err.message);
      }
    }

    // ── Send DM (Private Reply to Comment) ──
    if (auto.dm_text && commenterId) {
      // Guard: check if user confirmed message access is enabled
      if (!account.message_access_enabled) {
        console.warn(`⚠️ Skipping DM — message access not enabled for @${account.username}. User must enable "Allow access to messages" in Instagram settings.`);
        dmError = 'Message access not enabled';
      } else {
        try {
          // Small delay to avoid rate limit
          await new Promise(r => setTimeout(r, 1000));

          // Private Reply to comment
          const dmParams = { access_token: TOKEN };
          // Only Facebook Graph API requires the platform=instagram parameter for sending IG messages
          if (API_BASE === GRAPH_API) {
            dmParams.platform = 'instagram';
          }

          const dmRes = await axios.post(
            `${API_BASE}/me/messages`,
            {
              recipient: { comment_id: commentId },
              message: { text: auto.dm_text },
            },
            { params: dmParams }
          );
          console.log(`✅ DM sent! Response:`, dmRes.data);
          dmSent = true;
        } catch (err) {
          dmError = err.response?.data?.error?.message || err.message;
          console.error(`❌ DM FAILED:`, err.response?.data || err.message);
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
        status: (replySent || dmSent) ? 'completed' : 'failed',
        reply_sent: replySent,
        dm_sent: dmSent,
        reply_error: replyError ? String(replyError).substring(0, 250) : null,
        dm_error: dmError ? String(dmError).substring(0, 250) : null,
        processed_at: new Date().toISOString(),
      });

      await supabase.rpc('increment_trigger_count', { automation_id: auto.id });
      console.log(`📊 Logged to DB — reply: ${replySent}, dm: ${dmSent}`);
    } catch (dbErr) {
      console.error('⚠️ DB log failed:', dbErr.message);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /webhook/test — Debug endpoint to verify webhook is reachable
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/test', (req, res) => {
  res.json({
    status: 'Webhook endpoint is reachable',
    timestamp: new Date().toISOString(),
    verify_token_set: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
  });
});

module.exports = router;
