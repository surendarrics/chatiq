# ChatIQ — Complete Setup & Deployment Guide

## Overview

ChatIQ is a production-ready Instagram automation SaaS that:
- Detects comments on Instagram posts via Meta webhooks
- Auto-replies to comments matching keywords
- Sends DMs to commenters automatically

---

## Part 1: Meta Developer App Setup

### Step 1: Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Choose **Business** as the app type
4. Fill in app name (e.g. "ChatIQ"), contact email
5. Click **Create App**

### Step 2: Add Instagram Products

In your App Dashboard:
1. Click **Add Product** on the left sidebar
2. Find **Instagram Graph API** → click **Set Up**
3. Find **Webhooks** → click **Set Up**
4. Find **Instagram Messaging** → click **Set Up** (for DMs)

### Step 3: Configure OAuth

1. Go to **App Settings** → **Basic**
2. Copy your **App ID** and **App Secret** → save for `.env`
3. Go to **Facebook Login** → **Settings**
4. Add **Valid OAuth Redirect URIs**:
   ```
   https://yourdomain.com/api/auth/instagram/callback
   http://localhost:3001/api/auth/instagram/callback   ← for dev
   ```
5. Save changes

### Step 4: Request Permissions

Go to **App Review** → **Permissions and Features**, request:
- `instagram_basic` — Read profile/media
- `instagram_manage_comments` — Reply to comments ⚠️ **Requires review**
- `instagram_manage_messages` — Send DMs ⚠️ **Requires review**
- `pages_show_list` — List Facebook Pages
- `pages_read_engagement` — Read Page data
- `pages_manage_metadata` — Subscribe pages to webhooks

> **Note**: For development/testing, you can use your own Instagram Business account without review. Production use requires Meta App Review.

### Step 5: Set Up Webhooks

1. Go to **Webhooks** in your app dashboard
2. Click **Subscribe to this object** → choose **Instagram**
3. Set:
   - **Callback URL**: `https://yourdomain.com/webhook/instagram`
   - **Verify Token**: same value as `META_WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**
5. Subscribe to fields:
   - `comments` ✅
   - `messages` ✅ (for DM events)

> You need a public HTTPS URL for webhooks. Use [ngrok](https://ngrok.com) for local dev.

---

## Part 2: Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose organization, name your project (e.g. "chatiq")
3. Set a strong database password — **save it**
4. Choose region closest to your users
5. Click **Create new project**

### Step 2: Run Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Open `database/schema.sql` from this repo
3. Paste the entire contents
4. Click **Run**
5. Verify tables were created: users, instagram_accounts, automations, automation_logs

### Step 3: Get API Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_KEY`

> ⚠️ Never expose `service_role` key to the frontend. Backend only.

---

## Part 3: Local Development

### Step 1: Clone & Install

```bash
git clone https://github.com/yourname/chatiq.git
cd chatiq

# Backend
cd backend
npm install
cp .env.example .env
# Fill in .env values

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env
# Fill in .env values
```

### Step 2: Fill Environment Variables

**backend/.env:**
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

META_APP_ID=1234567890
META_APP_SECRET=abc123yoursecret
META_WEBHOOK_VERIFY_TOKEN=my_random_token_abc123
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/auth/instagram/callback

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

JWT_SECRET=a-very-long-random-secret-string-min-32-chars
```

**frontend/.env:**
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_BACKEND_URL=http://localhost:3001
```

### Step 3: Start Development Servers

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm start
```

### Step 4: Expose Webhook with ngrok

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001

# You'll get a URL like: https://abc123.ngrok.io
# Update Meta webhook URL to: https://abc123.ngrok.io/webhook/instagram
```

---

## Part 4: Deployment

### Backend → Railway / Render / Fly.io

**Option A: Railway (recommended)**

```bash
# Install Railway CLI
npm install -g @railway/cli

cd backend
railway login
railway init
railway up
```

Set env vars in Railway dashboard or CLI:
```bash
railway variables set META_APP_ID=xxx META_APP_SECRET=xxx ...
```

**Option B: Render**

1. Connect GitHub repo to Render
2. New **Web Service** → select `backend/` folder
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all environment variables

### Frontend → Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

Set env vars in Vercel dashboard:
```
REACT_APP_API_URL=https://your-backend.railway.app/api
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

### After Deployment

1. Update Meta App → **Valid OAuth Redirect URIs** with your production backend URL
2. Update webhook URL in Meta dashboard to production backend URL
3. Update `FRONTEND_URL` in backend env to your Vercel URL
4. Update `INSTAGRAM_REDIRECT_URI` to production callback URL

---

## Part 5: Instagram Account Linking

### Requirements
- Instagram **Business** or **Creator** account (not personal)
- Instagram account connected to a **Facebook Page**
- You must be an Admin of the Facebook Page

### How to Convert to Business Account
1. Open Instagram app → Profile → Hamburger menu → Settings
2. **Account** → **Switch to Professional Account**
3. Choose **Business** → connect to Facebook Page

### Linking Flow
1. Open ChatIQ → click **Connect Instagram**
2. Log in with the Facebook account that manages your Page
3. Approve requested permissions
4. You'll be redirected back to ChatIQ dashboard

---

## Part 6: Meta App Review (for Production)

To use ChatIQ with accounts other than your own, you need Meta App Review.

### Submit for Review

1. Go to **App Review** → **Requests**
2. For each permission:
   - `instagram_manage_comments`: Provide a video showing comment reply use case
   - `instagram_manage_messages`: Explain DM use case and policy compliance
3. In **Verification**, verify your business
4. Submit review (takes 5-30 business days)

### Policies to Follow
- Users must opt-in (you handle this via your UI)
- No spam: rate limiting is built into ChatIQ
- No promotional DMs without user interaction first (comments trigger DMs ✅)
- Comply with Instagram's Platform Policy

---

## Part 7: Example API Requests

### Connect Instagram Account
```
GET /api/auth/instagram
Response: { authUrl: "https://facebook.com/dialog/oauth?..." }
```

### Get Connected Accounts
```
GET /api/instagram/accounts
Headers: Authorization: Bearer <jwt>
Response: { accounts: [{ id, username, followers_count, ... }] }
```

### Get Posts for Account
```
GET /api/instagram/accounts/:accountId/posts?limit=20
Response: { data: [{ id, caption, media_url, permalink, ... }] }
```

### Create Automation
```
POST /api/automations
Body: {
  instagram_account_id: "uuid",
  post_id: "17841400123456789",
  name: "Summer Sale DMs",
  keywords: ["link", "price", "send"],
  reply_text: "Check your DMs! 👀",
  dm_text: "Hey! Here's the link: https://mysite.com/sale 🎉",
  match_all_comments: false
}
Response: { automation: { id, status: "active", ... } }
```

### Toggle Automation
```
PATCH /api/automations/:id/toggle
Response: { automation: { status: "paused" | "active" } }
```

### Webhook Verification (Meta calls this)
```
GET /webhook/instagram?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=yyy
Response: "yyy" (challenge string)
```

### Webhook Event (Meta sends this)
```json
POST /webhook/instagram
{
  "object": "instagram",
  "entry": [{
    "id": "ig-account-id",
    "time": 1234567890,
    "changes": [{
      "field": "comments",
      "value": {
        "id": "comment-id-123",
        "text": "send me the link please!",
        "from": { "id": "user-ig-id", "username": "johndoe" },
        "media": { "id": "post-id-456", "media_product_type": "FEED" }
      }
    }]
  }]
}
```

---

## Part 8: Architecture Overview

```
User Browser
    │
    ▼
React Frontend (Vercel)
    │ REST API calls (JWT auth)
    ▼
Express Backend (Railway)
    ├── /api/auth          ← OAuth flow
    ├── /api/instagram     ← Account & posts
    ├── /api/automations   ← CRUD
    ├── /api/dashboard     ← Stats
    └── /webhook/instagram ← Meta events
         │
         ▼
    Automation Engine
    ├── Keyword matching
    ├── Dedup check (Supabase)
    ├── sendCommentReply()
    └── sendInstagramDM()
         │
         ▼
    Meta Instagram Graph API
         │
         ▼
    Supabase (PostgreSQL)
    ├── users
    ├── instagram_accounts
    ├── automations
    └── automation_logs
```

---

## Troubleshooting

### Webhook not receiving events
- Ensure webhook is verified in Meta dashboard
- Check server logs for signature validation errors
- Make sure your URL is HTTPS and publicly accessible
- Re-subscribe page: `POST /{page-id}/subscribed_apps`

### Token expired errors
- Long-lived tokens last 60 days; re-connect account to refresh
- Future: implement automatic token refresh with cron job

### DMs not sending
- User must have DMs open to non-followers (Instagram setting)
- `instagram_manage_messages` permission required
- Some accounts cannot receive DMs from Pages

### Comment reply failing
- Verify `instagram_manage_comments` permission is approved
- Cannot reply to replies (only top-level comments)
- Comment must belong to your Instagram account's post
