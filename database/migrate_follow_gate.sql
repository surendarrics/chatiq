-- Run this in Supabase SQL Editor to enable the "follow gate" feature.
-- An automation with require_follow=TRUE will check if the commenter follows
-- the IG account before sending the link DM. If not, it sends follow_gate_message
-- with a "Following" quick-reply button; clicking the button re-checks status.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS require_follow BOOLEAN DEFAULT FALSE;

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS follow_gate_message TEXT
    DEFAULT '🔔 The Workflow is exclusively for Followers. Follow to gain access to the AI tool! 🔔';

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS follow_button_label TEXT DEFAULT 'Following';

-- Track follow-gate state per (automation, commenter) so postbacks know what
-- automation/dm_text to deliver after the user confirms following.
ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS follow_gate_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS follow_gate_unlocked BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_automation_logs_commenter_pending
  ON automation_logs(commenter_ig_id, follow_gate_sent, follow_gate_unlocked);
