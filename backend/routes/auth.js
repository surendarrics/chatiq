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
  'instagram_business_content_publish',
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
  const igAppId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  logger.info('🔗 GET /api/auth/instagram — redirecting to Instagram OAuth');
  logger.info(`  Redirect URI: ${redirectUri}`);
  logger.info(`  Instagram App ID: ${igAppId}`);
  logger.info(`  Scopes: ${IG_SCOPES}`);

  const params = new URLSearchParams({
    enable_fb_login: '0',           // Only show Instagram login (not Facebook)
    force_authentication: '1',      // Always show login screen
    client_id: igAppId,
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

  let currentStep = 'init';
  try {
    const redirectUri = getRedirectUri(req);

    // ─── Step 1: Exchange code for short-lived access token ───
    // Instagram uses POST with form-encoded body (NOT GET like Facebook)
    currentStep = 'exchange_code_for_short_lived_token';
    logger.info('Step 1: Exchanging code for short-lived token...');
    const igAppId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
    const igAppSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
    if (!igAppId || !igAppSecret) {
      throw new Error('Missing INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET (or META_APP_ID/SECRET fallback)');
    }
    const tokenResponse = await axios.post(IG_TOKEN_URL,
      new URLSearchParams({
        client_id: igAppId,
        client_secret: igAppSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const shortLivedToken = tokenResponse.data.access_token;
    const igUserId = tokenResponse.data.user_id;
    if (!shortLivedToken) {
      throw new Error(`No access_token in Step 1 response: ${JSON.stringify(tokenResponse.data)}`);
    }
    logger.info(`Got short-lived token for IG user: ${igUserId}`);

    // ─── Step 2: Try to exchange for long-lived token (60 days) ───
    // Meta's docs say this is a GET, but the /access_token endpoint on
    // graph.instagram.com returns "Unsupported request - method type: X" for
    // BOTH GET and POST on many app configurations — a known Meta bug. If
    // the exchange fails, we fall back to the short-lived token (~1 hour);
    // the user will just need to re-auth sooner. Don't block login over it.
    currentStep = 'exchange_for_long_lived_token';
    logger.info('Step 2: Exchanging for long-lived token...');
    const exchangeParams = {
      grant_type: 'ig_exchange_token',
      client_secret: igAppSecret,
      access_token: shortLivedToken,
    };

    const exchangeAttempts = [
      { method: 'get', url: `${IG_GRAPH_BASE}/access_token` },
      { method: 'post', url: `${IG_GRAPH_BASE}/access_token` },
      { method: 'get', url: `${IG_GRAPH_BASE}/v23.0/access_token` },
    ];

    let longLivedToken = shortLivedToken;
    let expiresIn = 3600; // short-lived default: 1 hour
    let exchangeSucceeded = false;

    for (const attempt of exchangeAttempts) {
      try {
        const res = attempt.method === 'get'
          ? await axios.get(attempt.url, { params: exchangeParams })
          : await axios.post(
              attempt.url,
              new URLSearchParams(exchangeParams).toString(),
              { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
        if (res.data?.access_token) {
          longLivedToken = res.data.access_token;
          expiresIn = res.data.expires_in || 5184000;
          exchangeSucceeded = true;
          logger.info(`✅ Long-lived token obtained via ${attempt.method.toUpperCase()} ${attempt.url} (expires in ${Math.round(expiresIn / 86400)} days)`);
          break;
        }
      } catch (err) {
        const msg = err.response?.data?.error?.message || err.message;
        logger.warn(`  ↳ ${attempt.method.toUpperCase()} ${attempt.url} failed: ${msg}`);
      }
    }

    if (!exchangeSucceeded) {
      logger.warn('⚠️ All long-lived token exchange attempts failed — using short-lived token (~1 hour). User will need to re-auth when it expires.');
    }

    // ─── Step 3: Get Instagram user profile ───
    // followers_count/name/profile_picture_url are Business/Creator-only, so
    // request conservative fields first; if that fails, fall back to the bare
    // minimum so personal accounts can still sign in.
    currentStep = 'fetch_profile';
    logger.info('Step 3: Fetching Instagram profile...');
    let profile;
    try {
      const profileResponse = await axios.get(`${IG_GRAPH_BASE}/me`, {
        params: {
          fields: 'user_id,username,account_type,name,profile_picture_url,followers_count',
          access_token: longLivedToken,
        },
      });
      profile = profileResponse.data;
    } catch (profileErr) {
      const pmsg = profileErr.response?.data?.error?.message || profileErr.message;
      logger.warn(`Step 3 full-fields /me failed ("${pmsg}") — retrying with minimal fields`);
      const minimal = await axios.get(`${IG_GRAPH_BASE}/me`, {
        params: {
          fields: 'user_id,username,account_type',
          access_token: longLivedToken,
        },
      });
      profile = minimal.data;
    }
    if (!profile?.user_id && !profile?.id) {
      throw new Error(`No user_id in profile response: ${JSON.stringify(profile)}`);
    }
    if (!profile.user_id) profile.user_id = profile.id;
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
    const { data: savedAccount, error: accountError } = await supabase
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
        // Instagram Login doesn't require a Facebook Page, but the DB may have these columns
        page_id: '',
        page_name: profile.username || '',
        page_access_token: longLivedToken,
      }, { onConflict: 'ig_account_id' })
      .select();

    if (accountError) {
      logger.error('❌ Instagram account save error:', accountError);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=db_error`);
    }

    logger.info(`✅ Saved IG account: @${profile.username}`, savedAccount);

    // ─── Step 6: Generate JWT and redirect to frontend ───
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    logger.info('✅ Auth flow complete — redirecting to frontend');

    // Redirect to /auth/callback with token — auto-connects, no picker needed
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);

  } catch (err) {
    logger.error('❌ OAuth callback error:', {
      step: currentStep,
      message: err.message,
      responseData: err.response?.data,
      responseStatus: err.response?.status,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    });
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?error=auth_failed&step=${encodeURIComponent(currentStep)}`
    );
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
