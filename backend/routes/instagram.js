const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../utils/supabase');
const instagramApi = require('../services/instagramApi');
const logger = require('../utils/logger');

/**
 * GET /api/instagram/accounts
 * Get connected Instagram accounts for logged-in user
 */
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('instagram_accounts')
      .select('id, ig_account_id, username, profile_picture_url, followers_count, page_name, message_access_enabled, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ accounts: data });
  } catch (err) {
    logger.error('Get accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

/**
 * DELETE /api/instagram/accounts/:id
 * Disconnect an Instagram account
 */
router.delete('/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('instagram_accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

/**
 * GET /api/instagram/accounts/:accountId/posts
 * Get posts for a specific Instagram account
 */
router.get('/accounts/:accountId/posts', authenticateToken, async (req, res) => {
  try {
    // Verify account belongs to user
    const { data: account, error: accError } = await supabase
      .from('instagram_accounts')
      .select('ig_account_id, page_access_token')
      .eq('id', req.params.accountId)
      .eq('user_id', req.user.id)
      .single();

    if (accError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const posts = await instagramApi.getInstagramPosts(
      account.ig_account_id,
      account.page_access_token,
      limit
    );

    res.json(posts);
  } catch (err) {
    logger.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * GET /api/instagram/accounts/:accountId/validate
 * Validate that the access token is still active
 */
router.get('/accounts/:accountId/validate', authenticateToken, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('page_access_token')
      .eq('id', req.params.accountId)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    const result = await instagramApi.validateToken(account.page_access_token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * POST /api/instagram/accounts/:accountId/subscribe
 * Manually subscribe a page to webhooks (for debugging / re-subscribing)
 */
router.post('/accounts/:accountId/subscribe', authenticateToken, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('page_id, page_access_token, page_name')
      .eq('id', req.params.accountId)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    const axios = require('axios');
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${account.page_id}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'feed,comments,messages,message_reactions',
          access_token: account.page_access_token,
        },
      }
    );

    console.log(`✅ Manually subscribed page ${account.page_id} (${account.page_name}):`, response.data);
    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error('Subscribe error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Subscription failed', details: err.response?.data });
  }
});

/**
 * PATCH /api/instagram/accounts/:accountId/message-access
 * Update message_access_enabled status
 */
router.patch('/accounts/:accountId/message-access', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;

    const { data, error } = await supabase
      .from('instagram_accounts')
      .update({ message_access_enabled: !!enabled })
      .eq('id', req.params.accountId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Account not found' });

    console.log(`📬 Message access ${enabled ? 'ENABLED' : 'DISABLED'} for account ${data.username}`);
    res.json({ success: true, message_access_enabled: data.message_access_enabled });
  } catch (err) {
    console.error('Message access update error:', err);
    res.status(500).json({ error: 'Failed to update message access status' });
  }
});

module.exports = router;
