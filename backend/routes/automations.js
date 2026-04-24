const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../utils/supabase');
const logger = require('../utils/logger');

/**
 * GET /api/automations
 * List all automations for the logged-in user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('automations')
      .select(`
        *,
        instagram_accounts (
          id,
          username,
          profile_picture_url,
          ig_account_id
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ automations: data });
  } catch (err) {
    logger.error('List automations error:', err);
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

/**
 * POST /api/automations
 * Create a new automation
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    instagram_account_id,
    post_id,
    post_url,
    post_thumbnail,
    name,
    keywords,
    reply_text,
    dm_text,
    match_all_comments,
    require_follow,
    follow_gate_message,
    follow_button_label,
  } = req.body;

  if (!instagram_account_id || !post_id) {
    return res.status(400).json({ error: 'instagram_account_id and post_id are required' });
  }

  if (!reply_text && !dm_text) {
    return res.status(400).json({ error: 'At least one of reply_text or dm_text is required' });
  }

  // Validate keywords
  const parsedKeywords = Array.isArray(keywords) ? keywords.filter(Boolean) : [];
  if (!match_all_comments && parsedKeywords.length === 0) {
    return res.status(400).json({ error: 'Keywords are required unless match_all_comments is true' });
  }

  try {
    // Verify account belongs to user
    const { data: account } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('id', instagram_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) {
      return res.status(403).json({ error: 'Instagram account not found or unauthorized' });
    }

    const { data, error } = await supabase
      .from('automations')
      .insert({
        user_id: req.user.id,
        instagram_account_id,
        post_id,
        post_url,
        post_thumbnail,
        name: name || `Automation for post ${post_id}`,
        keywords: parsedKeywords,
        reply_text: reply_text || null,
        dm_text: dm_text || null,
        match_all_comments: match_all_comments || false,
        require_follow: !!require_follow,
        follow_gate_message: follow_gate_message || null,
        follow_button_label: follow_button_label || null,
        status: 'active',
        trigger_count: 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ automation: data });
  } catch (err) {
    logger.error('Create automation error:', err);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

/**
 * PUT /api/automations/:id
 * Update an automation
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const {
    name, keywords, reply_text, dm_text, status, match_all_comments,
    require_follow, follow_gate_message, follow_button_label,
  } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (keywords !== undefined) updates.keywords = keywords;
    if (reply_text !== undefined) updates.reply_text = reply_text;
    if (dm_text !== undefined) updates.dm_text = dm_text;
    if (status !== undefined) updates.status = status;
    if (match_all_comments !== undefined) updates.match_all_comments = match_all_comments;
    if (require_follow !== undefined) updates.require_follow = !!require_follow;
    if (follow_gate_message !== undefined) updates.follow_gate_message = follow_gate_message;
    if (follow_button_label !== undefined) updates.follow_button_label = follow_button_label;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Automation not found' });

    res.json({ automation: data });
  } catch (err) {
    logger.error('Update automation error:', err);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

/**
 * PATCH /api/automations/:id/toggle
 * Toggle automation on/off
 */
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { data: current } = await supabase
      .from('automations')
      .select('status')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!current) return res.status(404).json({ error: 'Automation not found' });

    const newStatus = current.status === 'active' ? 'paused' : 'active';

    const { data, error } = await supabase
      .from('automations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ automation: data });
  } catch (err) {
    logger.error('Toggle automation error:', err);
    res.status(500).json({ error: 'Failed to toggle automation' });
  }
});

/**
 * DELETE /api/automations/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete automation error:', err);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

/**
 * GET /api/automations/:id/logs
 * Get activity logs for an automation
 */
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    // Verify ownership
    const { data: automation } = await supabase
      .from('automations')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!automation) return res.status(404).json({ error: 'Automation not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('automation_logs')
      .select('*', { count: 'exact' })
      .eq('automation_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ logs: data, total: count, page, limit });
  } catch (err) {
    logger.error('Get logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
