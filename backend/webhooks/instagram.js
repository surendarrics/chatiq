const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const supabase = require('../utils/supabase');

const GRAPH_API = 'https://graph.facebook.com/v19.0';

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
  console.log(JSON.stringify(body, null, 2));
  console.log('═══════════════════════════════════════════\n');

  try {
    // Write raw webhook to a file locally so we can inspect it!
    const fs = require('fs');
    fs.appendFileSync('webhook_inspect.log', JSON.stringify({time: new Date().toISOString(), body}) + '\n');
  } catch(e){}

  // Accept both 'instagram' and 'page' object types
  if (body.object !== 'instagram' && body.object !== 'page') {
    console.log(`⏭️ Ignoring object type: ${body.object}`);
    return;
  }

  for (const entry of body.entry || []) {
    const entryId = entry.id; // This is the Page ID or IG Account ID

    for (const change of entry.changes || []) {
      console.log(`📌 Change field: ${change.field}`);

      if (change.field === 'comments') {
        handleComment(entryId, change.value).catch(err =>
          console.error('❌ handleComment error:', err.message)
        );
      }
    }
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE: Handle incoming comment
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleComment(entryId, value) {
  const commentId = value.id;
  const commentText = (value.text || '').trim();
  const commenterId = value.from?.id;
  const postId = value.media?.id;

  console.log(`\n💬 Comment received:`);
  console.log(`   Text: "${commentText}"`);
  console.log(`   Comment ID: ${commentId}`);
  console.log(`   Commenter ID: ${commenterId}`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   Entry ID: ${entryId}`);

  if (!commentId || !commentText) {
    console.log('⏭️ Skipping: missing commentId or text');
    return;
  }

  // ── Find the Instagram account in DB (try ig_account_id first, then page_id) ──
  let account = null;

  const { data: byIg } = await supabase
    .from('instagram_accounts')
    .select('id, ig_account_id, page_access_token, message_access_enabled, username')
    .eq('ig_account_id', entryId)
    .single();

  if (byIg) {
    account = byIg;
  } else {
    const { data: byPage } = await supabase
      .from('instagram_accounts')
      .select('id, ig_account_id, page_access_token, message_access_enabled, username')
      .eq('page_id', entryId)
      .single();
    account = byPage;
  }

  if (!account) {
    console.log(`⚠️ No account found for entry ID: ${entryId}`);
    return;
  }

  console.log(`✅ Matched account: ${account.ig_account_id}`);

  const PAGE_TOKEN = account.page_access_token;

  // ── Skip if the commenter is the page itself (don't reply to yourself) ──
  // if (commenterId === account.ig_account_id) {
  //  console.log('⏭️ Skipping: commenter is the page owner');
  //  return;
  // }

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

    // ── Reply to comment ──
    if (auto.reply_text) {
      try {
        const replyRes = await axios.post(
          `${GRAPH_API}/${commentId}/replies`,
          null,
          { params: { message: auto.reply_text, access_token: PAGE_TOKEN } }
        );
        console.log(`✅ Comment reply sent! Response:`, replyRes.data);
      } catch (err) {
        console.error(`❌ Comment reply FAILED:`, err.response?.data || err.message);
      }
    }

    // ── Send DM (Private Reply to Comment) ──
    if (auto.dm_text && commenterId) {
      // Guard: check if user confirmed message access is enabled
      if (!account.message_access_enabled) {
        console.warn(`⚠️ Skipping DM — message access not enabled for @${account.username}. User must enable "Allow access to messages" in Instagram settings.`);
      } else {
        try {
          // Small delay to avoid rate limit
          await new Promise(r => setTimeout(r, 1000));

          // Use /me/messages with platform=instagram for Private Replies
          const dmRes = await axios.post(
            `${GRAPH_API}/me/messages`,
            {
              recipient: { comment_id: commentId },
              message: { text: auto.dm_text },
            },
            { params: { access_token: PAGE_TOKEN, platform: 'instagram' } }
          );
          console.log(`✅ DM sent! Response:`, dmRes.data);
        } catch (err) {
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
        status: 'completed',
        reply_sent: !!auto.reply_text,
        dm_sent: !!auto.dm_text,
        processed_at: new Date().toISOString(),
      });

      await supabase.rpc('increment_trigger_count', { automation_id: auto.id });
      console.log(`📊 Logged to DB`);
    } catch (dbErr) {
      console.error('⚠️ DB log failed:', dbErr.message);
    }
  }
}

module.exports = router;
