# ChatIQ 🤖 — Instagram Comment Automation

> Like ManyChat — auto-reply to Instagram comments and send DMs when keywords trigger.

![ChatIQ](https://img.shields.io/badge/status-production--ready-brightgreen)
![Meta API](https://img.shields.io/badge/Meta%20API-v19.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)

## What ChatIQ Does

When someone comments **"send me the link"** on your Instagram post → ChatIQ:
1. **Replies to the comment**: "Check your DMs! 👀"
2. **Sends a DM**: "Hey! Here's your link: https://..."

All powered by the official **Meta Instagram Graph API** — no scraping.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Frontend | React 18 |
| Database | Supabase (PostgreSQL) |
| Auth | Meta OAuth 2.0 + JWT |
| Real-time | Meta Webhooks |
| Hosting | Railway + Vercel |

## Project Structure

```
chatiq/
├── backend/
│   ├── server.js              # Express app entry
│   ├── routes/
│   │   ├── auth.js            # Meta OAuth flow
│   │   ├── instagram.js       # Accounts & posts
│   │   ├── automations.js     # CRUD for automations
│   │   └── dashboard.js       # Stats & activity
│   ├── webhooks/
│   │   └── instagram.js       # Meta webhook handler
│   ├── services/
│   │   ├── instagramApi.js    # Graph API wrapper
│   │   └── automationEngine.js # Core trigger logic
│   ├── middleware/
│   │   └── auth.js            # JWT middleware
│   └── utils/
│       ├── supabase.js        # DB client
│       └── logger.js          # Winston logger
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── Dashboard.jsx
│       │   ├── AutomationsPage.jsx
│       │   ├── NewAutomationPage.jsx
│       │   ├── ActivityPage.jsx
│       │   └── ConnectPage.jsx
│       ├── components/
│       │   └── Layout.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       └── utils/
│           └── api.js
└── database/
    └── schema.sql             # Complete Supabase schema
```

## Quick Start

```bash
# 1. Clone
git clone https://github.com/yourname/chatiq

# 2. Backend setup
cd chatiq/backend
npm install
cp .env.example .env   # fill in values

# 3. Frontend setup
cd ../frontend
npm install
cp .env.example .env   # fill in values

# 4. Run database schema in Supabase SQL Editor

# 5. Start dev
cd ../backend && npm run dev
cd ../frontend && npm start
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for the complete step-by-step guide including:
- Meta Developer App setup
- Webhook configuration  
- Instagram account linking
- Deployment to Railway + Vercel
- App Review for production

## Key Features

- ✅ **Official Meta API** — No scraping, fully compliant
- ✅ **Keyword triggers** — Only fire on matching comments
- ✅ **Auto comment reply** — Public reply to the comment
- ✅ **Auto DM** — Private message to the commenter
- ✅ **Real-time webhooks** — No polling, instant response
- ✅ **Deduplication** — Never process the same comment twice
- ✅ **Activity logs** — Full audit trail
- ✅ **JWT authentication** — Secure user sessions
- ✅ **Webhook signature validation** — Verify all Meta requests
- ✅ **Rate limit handling** — Respects Meta API limits

## License

MIT
