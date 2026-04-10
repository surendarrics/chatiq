const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../utils/supabase');

/**
 * GET /api/dashboard/stats
 * Get overview stats for dashboard
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Parallel queries
    const [automationsRes, logsRes, accountsRes] = await Promise.all([
      supabase
        .from('automations')
        .select('id, status, trigger_count')
        .eq('user_id', userId),
      supabase
        .from('automation_logs')
        .select('id, reply_sent, dm_sent, status, created_at')
        .eq('automation_id', supabase.from('automations').select('id').eq('user_id', userId))
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('instagram_accounts')
        .select('id')
        .eq('user_id', userId),
    ]);

    const automations = automationsRes.data || [];
    const logs = logsRes.data || [];

    const stats = {
      total_automations: automations.length,
      active_automations: automations.filter((a) => a.status === 'active').length,
      total_triggers: automations.reduce((sum, a) => sum + (a.trigger_count || 0), 0),
      connected_accounts: (accountsRes.data || []).length,
      this_week: {
        triggers: logs.length,
        replies_sent: logs.filter((l) => l.reply_sent).length,
        dms_sent: logs.filter((l) => l.dm_sent).length,
      },
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/dashboard/activity
 * Recent activity feed
 */
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    // Get user's automation IDs first
    const { data: automationIds } = await supabase
      .from('automations')
      .select('id')
      .eq('user_id', req.user.id);

    if (!automationIds || automationIds.length === 0) {
      return res.json({ activity: [] });
    }

    const ids = automationIds.map((a) => a.id);

    const { data, error } = await supabase
      .from('automation_logs')
      .select(`
        *,
        automations (
          name,
          post_id
        )
      `)
      .in('automation_id', ids)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ activity: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

/**
 * GET /api/dashboard/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
