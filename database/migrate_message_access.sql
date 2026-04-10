-- Run this in Supabase SQL Editor to add the message_access_enabled column
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS message_access_enabled BOOLEAN DEFAULT FALSE;
