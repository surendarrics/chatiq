-- ============================================================
-- ChatIQ Database Schema for Supabase (PostgreSQL)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facebook_id   TEXT UNIQUE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  plan          TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Instagram Accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ig_account_id         TEXT UNIQUE NOT NULL,        -- Instagram Business Account ID
  page_id               TEXT NOT NULL,               -- Facebook Page ID
  page_name             TEXT,
  page_access_token     TEXT NOT NULL,               -- Page-level access token
  access_token          TEXT NOT NULL,               -- User access token (long-lived)
  token_expires_at      TIMESTAMPTZ,
  username              TEXT,
  profile_picture_url   TEXT,
  followers_count       INTEGER DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  message_access_enabled BOOLEAN DEFAULT FALSE,   -- User confirmed they enabled IG message access
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user_id ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_ig_id ON instagram_accounts(ig_account_id);

-- ── Automations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id  UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  post_id               TEXT NOT NULL,              -- Instagram Media ID
  post_url              TEXT,                        -- Permalink to the post
  post_thumbnail        TEXT,                        -- Thumbnail URL
  keywords              TEXT[] DEFAULT '{}',         -- Trigger keywords
  match_all_comments    BOOLEAN DEFAULT FALSE,        -- Bypass keyword check
  reply_text            TEXT,                         -- Comment reply message
  dm_text               TEXT,                         -- DM message
  status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  trigger_count         INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_post_id ON automations(post_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);

-- ── Automation Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id     UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  comment_id        TEXT NOT NULL,                    -- Instagram Comment ID
  commenter_ig_id   TEXT,                             -- Commenter's Instagram user ID
  comment_text      TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reply_sent        BOOLEAN DEFAULT FALSE,
  dm_sent           BOOLEAN DEFAULT FALSE,
  reply_error       TEXT,
  dm_error          TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_comment_id ON automation_logs(comment_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- Prevent duplicate processing of same comment for same automation
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_logs_dedup 
ON automation_logs(automation_id, comment_id);

-- ── RPC Function: increment trigger count ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_trigger_count(automation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE automations
  SET trigger_count = trigger_count + 1,
      updated_at = NOW()
  WHERE id = automation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Updated At Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instagram_accounts_updated_at
  BEFORE UPDATE ON instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Note: We use service role key in backend, so RLS is for additional protection
-- If you use anon key anywhere, enable RLS policies below

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- ── Sample Data (optional) ────────────────────────────────────────────────────
-- INSERT INTO users (email, name, facebook_id)
-- VALUES ('demo@chatiq.app', 'Demo User', '123456789');
