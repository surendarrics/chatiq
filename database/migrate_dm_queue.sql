-- Run this in Supabase SQL Editor to enable the DM queue.
-- Comments that hit the per-account hourly cap or transient Meta errors
-- get parked with status='queued' and a queued_until timestamp; the
-- backend worker (services/dmQueue.js) picks them up and retries.
-- Items that age past Meta's 7-day Private Reply window become 'expired'.

ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_status_check;

ALTER TABLE automation_logs
  ADD CONSTRAINT automation_logs_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'queued', 'expired'));

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS queued_until TIMESTAMPTZ;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Fast polling: pull next batch of items whose backoff has expired.
CREATE INDEX IF NOT EXISTS idx_automation_logs_queue_ready
  ON automation_logs(queued_until)
  WHERE status = 'queued';
