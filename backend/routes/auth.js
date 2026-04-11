const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const supabase = require('../utils/supabase');
const logger = require('../utils/logger');

// ═════════════════════════════════════════════════════════════════════════════
// Instagram Login API endpoints (NOT Facebook Login)
// This gives direct Instagram auth — no Facebook Page needed.
// Same approach as ManyChat, Later, etc.
// ═════════════════════════════════════════════════════════════════════════════
const IG_AUTH_URL = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH_BASE = 'https://graph.instagram.com';

// Instagram Business Login permissions (different from Facebook Login permissions)
const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',');

// ── Build the redirect URI with safety fallback ──────────────────────────────
const CALLBACK_PATH = '/api/auth/instagram/callback';

function getRedirectUri(req) {
  const envUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (envUri && envUri.includes(CALLBACK_PATH)) {
    return envUri;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const constructed = `${protocol}://${host}${CALLBACK_PATH}`;
  logger.warn(`⚠️ INSTAGRAM_REDIRECT_URI missing or invalid ("${envUri}"), using: ${constructed}`);
  return constructed;
}

// ═════════════════════════════════════════════════════════════════════════════
// INSTAGRAM AUTH ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/instagram
 * Redirects the browser to Instagram's OAuth login page.
 * User logs in with their Instagram credentials directly (like ManyChat).
 * No Facebook Page required.
 */
router.get('/instagram', (req, res) => {
  const redirectUri = getRedirectUri(req);
  logger.info('🔗 GET /api/auth/instagram — redirecting to Instagram OAuth');
  logger.info(`  Redirect URI: ${redirectUri}`);
  logger.info(`  App ID: ${process.env.META_APP_ID}`);
  logger.info(`  Scopes: ${IG_SCOPES}`);

  const params = new URLSearchParams({
    enable_fb_login: '0',           // Only show Instagram login (not Facebook)
    force_authentication: '1',      // Always show login screen
    client_id: process.env.META_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_SCOPES,
  });

  const authUrl = `${IG_AUTH_URL}?${params.toString()}`;
  logger.info(`  Redirecting to: ${authUrl.substring(0, 120)}...`);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/instagram/callback
 * Handle Instagram OAuth callback — exchange code, get profile, auto-connect.
 * Flow: Instagram login → exchange code → get profile → save to DB → redirect with JWT.
 * NO account picker needed — the user already logged in with a specific IG account.
 */
router.get('/instagram/callback', async (req, res) => {
  logger.info('🔁 GET /api/auth/instagram/callback — OAuth callback received');
  logger.info(`  Query params: ${JSON.stringify(req.query)}`);

  const { code, error, error_reason } = req.query;

  if (error) {
    logger.warn('OAuth error from Instagram:', error, error_reason);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=oauth_denied`);
  }

  if (!code) {
    logger.warn('No code in callback query params');
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=no_code`);
  }

  try {
    const redirectUri = getRedirectUri(req);

    // ─── Step 1: Exchange code for short-lived access token ───
    // Instagram uses POST with form-encoded body (NOT GET like Facebook)
    logger.info('Step 1: Exchanging code for short-lived token...');
    const tokenResponse = await axios.post(IG_TOKEN_URL,
      new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const shortLivedToken = tokenResponse.data.access_token;
    const igUserId = tokenResponse.data.user_id;
    logger.info(`Got short-lived token for IG user: ${igUserId}`);

    // ─── Step 2: Exchange for long-lived token (60 days) ───
    logger.info('Step 2: Exchanging for long-lived token...');
    const longLivedResponse = await axios.get(`${IG_GRAPH_BASE}/access_token`, {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: process.env.META_APP_SECRET,
        access_token: shortLivedToken,
      },
    });

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in; // seconds
    logger.info(`Got long-lived token (expires in ${Math.round(expiresIn / 86400)} days)`);

    // ─── Step 3: Get Instagram user profile ───
    logger.info('Step 3: Fetching Instagram profile...');
    const profileResponse = await axios.get(`${IG_GRAPH_BASE}/me`, {
      params: {
        fields: 'user_id,username,name,account_type,profile_picture_url,followers_count',
        access_token: longLivedToken,
      },
    });

    const profile = profileResponse.data;
    logger.info(`Instagram profile: @${profile.username} (${profile.account_type}), ${profile.followers_count || 0} followers`);

    // ─── Step 4: Upsert user in database ───
    // Use Instagram user_id as identifier (stored in facebook_id column for compatibility)
    logger.info('Step 4: Upserting user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        facebook_id: String(profile.user_id),
        name: profile.name || profile.username,
        email: `ig_${profile.user_id}@instagram.local`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facebook_id' })
      .select()
      .single();

    if (userError) {
      logger.error('User upsert error:', userError);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=db_error`);
    }
    logger.info(`User upserted: ${user.id}`);

    // ─── Step 5: Save Instagram account ───
    logger.info('Step 5: Saving Instagram account...');
    await supabase
      .from('instagram_accounts')
      .upsert({
        user_id: user.id,
        ig_account_id: String(profile.user_id),
        username: profile.username || '',
        profile_picture_url: profile.profile_picture_url || '',
        followers_count: profile.followers_count || 0,
        access_token: longLivedToken,
        token_expires_at: new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        // page_id and page_access_token are null — not needed with Instagram Login
      }, { onConflict: 'ig_account_id' })
      .select();

    logger.info(`✅ Saved IG account: @${profile.username}`);

    // ─── Step 6: Generate JWT and redirect to frontend ───
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    logger.info('✅ Auth flow complete — redirecting to frontend');

    // Redirect to /auth/callback with token — auto-connects, no picker needed
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);

  } catch (err) {
    logger.error('❌ OAuth callback error:', {
      message: err.message,
      responseData: err.response?.data,
      responseStatus: err.response?.status,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=auth_failed`);
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// GENERAL AUTH ROUTES (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    const newToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token: newToken });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (err) {
    console.error('GET /me error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
