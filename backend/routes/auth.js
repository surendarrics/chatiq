const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const supabase = require('../utils/supabase');
const instagramApi = require('../services/instagramApi');
const logger = require('../utils/logger');

const META_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// ── Build the redirect URI with safety fallback ──────────────────────────────
// If INSTAGRAM_REDIRECT_URI is set and contains the full callback path, use it.
// Otherwise, auto-construct it from the request host at runtime.
const CALLBACK_PATH = '/api/auth/instagram/callback';

function getRedirectUri(req) {
  const envUri = process.env.INSTAGRAM_REDIRECT_URI;
  // Use the env var if it has the full callback path
  if (envUri && envUri.includes(CALLBACK_PATH)) {
    return envUri;
  }
  // Fallback: construct from request host (works on Railway, localhost, etc.)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const constructed = `${protocol}://${host}${CALLBACK_PATH}`;
  logger.warn(`⚠️ INSTAGRAM_REDIRECT_URI env var missing or invalid ("${envUri}"), using: ${constructed}`);
  return constructed;
}

/**
 * GET /api/auth/instagram
 * Redirects the browser to Meta's OAuth login page.
 * Frontend just does: window.location.href = "${BACKEND_URL}/api/auth/instagram"
 */
router.get('/instagram', (req, res) => {
  const redirectUri = getRedirectUri(req);
  logger.info('🔗 GET /api/auth/instagram — redirecting to Facebook OAuth');
  logger.info(`  Redirect URI: ${redirectUri}`);
  logger.info(`  App ID: ${process.env.META_APP_ID}`);

  const state = uuidv4();
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: redirectUri,
    scope: [
      'instagram_basic',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
    ].join(','),
    response_type: 'code',
    state,
  });

  const authUrl = `${META_AUTH_URL}?${params.toString()}`;
  logger.info(`  Redirecting to: ${authUrl.substring(0, 100)}...`);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/instagram/callback
 * Handle Meta OAuth callback — exchange code, fetch available accounts,
 * and redirect to frontend account picker (does NOT auto-connect).
 */
router.get('/instagram/callback', async (req, res) => {
  logger.info('🔁 GET /api/auth/instagram/callback — OAuth callback received');
  logger.info(`  Query params: ${JSON.stringify(req.query)}`);

  const { code, error } = req.query;

  if (error) {
    logger.warn('OAuth error from Meta:', error, req.query.error_description);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=oauth_denied`);
  }

  if (!code) {
    logger.warn('No code in callback query params');
    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=no_code`);
  }

  try {
    // ─── Step 1: Exchange code for short-lived user access token ───
    const redirectUri = getRedirectUri(req);
    logger.info(`Step 1: Exchanging code for short-lived token (redirect_uri: ${redirectUri})...`);
    const tokenResponse = await axios.get(META_TOKEN_URL, {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortLivedToken = tokenResponse.data.access_token;
    logger.info('Got short-lived token');

    // ─── Step 2: Exchange for long-lived user access token ───
    logger.info('Step 2: Exchanging for long-lived token...');
    const longLivedResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });

    const longLivedUserToken = longLivedResponse.data.access_token;
    logger.info('Got long-lived user token');

    // ─── Step 3: Get Facebook user info ───
    logger.info('Step 3: Fetching Facebook user info...');
    const meResponse = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: { fields: 'id,name,email', access_token: longLivedUserToken },
    });
    const fbUser = meResponse.data;
    logger.info(`Facebook user: ${fbUser.name} (${fbUser.id})`);

    // ─── Step 4: Get user's Facebook Pages ───
    logger.info('Step 4: Fetching Facebook Pages...');
    const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: longLivedUserToken,
      },
    });

    const pages = pagesResponse.data.data || [];
    logger.info(`Found ${pages.length} Facebook Page(s)`);

    if (pages.length === 0) {
      logger.warn('No Facebook Pages found');
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=no_pages`);
    }

    // ─── Step 5: Fetch IG profile for EACH page ───
    // Include ALL pages so the frontend can show which ones have IG linked and which don't
    logger.info('Step 5: Fetching Instagram profiles...');
    const availableAccounts = [];
    const pagesWithoutIG = [];

    for (const page of pages) {
      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;
        let profile = {};
        try {
          const profileRes = await axios.get(`${GRAPH_API_BASE}/${igId}`, {
            params: {
              fields: 'id,username,profile_picture_url,followers_count',
              access_token: page.access_token,
            },
          });
          profile = profileRes.data;
        } catch (e) {
          logger.warn(`⚠️ Failed to fetch IG profile for ${igId}:`, e.message);
        }

        availableAccounts.push({
          pageId: page.id,
          pageName: page.name,
          instagramId: igId,
          username: profile.username || '',
          profilePictureUrl: profile.profile_picture_url || '',
          followersCount: profile.followers_count || 0,
        });
      } else {
        // Page without Instagram linked — include so user can see it's missing
        pagesWithoutIG.push({
          pageId: page.id,
          pageName: page.name,
        });
      }
    }

    logger.info(`Found ${availableAccounts.length} IG account(s), ${pagesWithoutIG.length} page(s) without IG`);

    // ─── Step 6: Create a short-lived session JWT with all the data ───
    const sessionToken = jwt.sign({
      type: 'oauth_session',
      fbUser: { id: fbUser.id, name: fbUser.name, email: fbUser.email },
      longLivedUserToken,
      accounts: availableAccounts,
      pagesWithoutIG,
    }, process.env.JWT_SECRET, { expiresIn: '10m' }); // 10 minutes to pick

    // ─── Step 7: Redirect to frontend account picker ───
    logger.info('Redirecting to frontend account picker');
    res.redirect(`${process.env.FRONTEND_URL}/connect?session=${sessionToken}`);

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

/**
 * POST /api/auth/instagram/select
 * User picked ONE account from the list — save it to DB and return auth JWT.
 * Body: { sessionToken, pageId, instagramId }
 */
router.post('/instagram/select', async (req, res) => {
  const { sessionToken, pageId, instagramId } = req.body;

  if (!sessionToken || !pageId || !instagramId) {
    return res.status(400).json({ error: 'Missing sessionToken, pageId, or instagramId' });
  }

  try {
    // ─── Step 1: Verify session JWT ───
    const session = jwt.verify(sessionToken, process.env.JWT_SECRET);
    if (session.type !== 'oauth_session') {
      return res.status(400).json({ error: 'Invalid session token type' });
    }

    logger.info(`📥 POST /instagram/select — user: ${session.fbUser.name}, selected IG: ${instagramId}`);

    // ─── Step 2: Find the selected account in session data ───
    const selected = session.accounts.find(
      a => a.pageId === pageId && a.instagramId === instagramId
    );
    if (!selected) {
      return res.status(400).json({ error: 'Selected account not found in session' });
    }

    // ─── Step 3: Upsert user ───
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        facebook_id: session.fbUser.id,
        email: session.fbUser.email || `${session.fbUser.id}@facebook.com`,
        name: session.fbUser.name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facebook_id' })
      .select()
      .single();

    if (userError) {
      logger.error('User upsert error:', userError);
      return res.status(500).json({ error: 'Database error creating user' });
    }

    logger.info(`User upserted: ${user.id}`);

    // ─── Step 4: Get the page access token from Graph API ───
    // We re-fetch because the session token data doesn't store page access tokens
    const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: session.longLivedUserToken,
      },
    });
    const page = (pagesResponse.data.data || []).find(p => p.id === pageId);
    if (!page) {
      return res.status(400).json({ error: 'Facebook page not found. Please reconnect.' });
    }

    // ─── Step 5: Save the selected Instagram account ───
    const igProfile = await axios.get(`${GRAPH_API_BASE}/${instagramId}`, {
      params: {
        fields: 'id,username,profile_picture_url,followers_count',
        access_token: page.access_token,
      },
    });

    await supabase
      .from('instagram_accounts')
      .upsert({
        user_id: user.id,
        ig_account_id: instagramId,
        page_id: pageId,
        page_name: page.name,
        page_access_token: page.access_token,
        username: igProfile.data.username || '',
        profile_picture_url: igProfile.data.profile_picture_url || '',
        followers_count: igProfile.data.followers_count || 0,
        access_token: session.longLivedUserToken,
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ig_account_id' })
      .select();

    logger.info(`✅ Saved IG account: @${igProfile.data.username} (page: ${page.name})`);

    // ─── Step 6: Subscribe page to webhooks ───
    try {
      await axios.post(
        `${GRAPH_API_BASE}/${pageId}/subscribed_apps`,
        null,
        { params: { subscribed_fields: 'feed', access_token: page.access_token } }
      );
      logger.info(`✅ Page ${pageId} subscribed to webhooks`);
    } catch (subErr) {
      logger.warn(`⚠️ Webhook subscription failed for page ${pageId}:`, subErr.response?.data || subErr.message);
    }

    // ─── Step 7: Generate auth JWT ───
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    logger.info(`✅ /instagram/select complete — @${igProfile.data.username} connected`);

    res.json({
      success: true,
      token: jwtToken,
      account: {
        instagramId,
        username: igProfile.data.username,
        pageName: page.name,
        pageId,
        profilePictureUrl: igProfile.data.profile_picture_url || '',
        followersCount: igProfile.data.followers_count || 0,
      },
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please reconnect Instagram.' });
    }
    logger.error('❌ /instagram/select error:', {
      message: err.message,
      responseData: err.response?.data,
    });
    res.status(500).json({
      error: err.response?.data?.error?.message || 'Failed to connect selected account.',
    });
  }
});

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

/**
 * POST /api/auth/instagram/connect
 * Receives access token from FB SDK login (client-side), processes it server-side.
 * This is the endpoint for Meta App Review — reviewers connect their own IG account.
 */
router.post('/instagram/connect', async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    logger.warn('❌ /instagram/connect — missing accessToken in request body');
    return res.status(400).json({ error: 'Missing accessToken' });
  }

  logger.info('📥 /instagram/connect — received token from FB SDK');
  logger.info(`  Token preview: ${accessToken.substring(0, 20)}...`);
  logger.info(`  App ID: ${process.env.META_APP_ID}`);

  try {
    // ─── Step 1: Exchange for long-lived token ───
    const llRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: accessToken,
      },
    });
    const longLivedToken = llRes.data.access_token;
    logger.info('✅ Got long-lived token');

    // ─── Step 2: Get Facebook user info ───
    const fbUser = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: { fields: 'id,name,email', access_token: longLivedToken },
    });
    logger.info(`✅ FB User: ${fbUser.data.name} (${fbUser.data.id})`);

    // ─── Step 3: Upsert user in DB ───
    const { data: user } = await supabase
      .from('users')
      .upsert({
        facebook_id: fbUser.data.id,
        name: fbUser.data.name,
        email: fbUser.data.email || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facebook_id' })
      .select()
      .single();

    logger.info(`✅ User upserted: ${user.id}`);

    // ─── Step 4: Get Facebook Pages ───
    const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: longLivedToken,
      },
    });

    const pagesWithIG = (pagesRes.data.data || []).filter(
      (p) => p.instagram_business_account
    );

    logger.info(`📄 Found ${pagesRes.data.data?.length || 0} pages, ${pagesWithIG.length} with IG`);

    if (pagesWithIG.length === 0) {
      return res.status(400).json({
        error: 'No Instagram Business Account found linked to your Facebook Pages. Make sure your Instagram is a Professional (Business/Creator) account connected to a Facebook Page.',
      });
    }

    // ─── Step 5: Save each Instagram Business Account ───
    const connectedAccounts = [];

    for (const page of pagesWithIG) {
      const igAccountId = page.instagram_business_account.id;
      const pageAccessToken = page.access_token;

      // Get Instagram profile
      let profile = {};
      try {
        const profileRes = await axios.get(`${GRAPH_API_BASE}/${igAccountId}`, {
          params: {
            fields: 'id,username,profile_picture_url,followers_count',
            access_token: pageAccessToken,
          },
        });
        profile = profileRes.data;
      } catch (e) {
        logger.warn(`⚠️ Failed to fetch IG profile for ${igAccountId}:`, e.message);
      }

      await supabase
        .from('instagram_accounts')
        .upsert({
          user_id: user.id,
          ig_account_id: igAccountId,
          page_id: page.id,
          page_name: page.name,
          page_access_token: pageAccessToken,
          username: profile.username || '',
          profile_picture_url: profile.profile_picture_url || '',
          followers_count: profile.followers_count || 0,
          access_token: longLivedToken,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'ig_account_id' })
        .select();

      logger.info(`✅ Saved IG account: @${profile.username} (page: ${page.name})`);

      // Subscribe page to webhooks
      try {
        await axios.post(
          `${GRAPH_API_BASE}/${page.id}/subscribed_apps`,
          null,
          { params: { subscribed_fields: 'feed', access_token: pageAccessToken } }
        );
        logger.info(`✅ Page ${page.id} subscribed to webhooks`);
      } catch (subErr) {
        logger.warn(`⚠️ Webhook subscription failed for page ${page.id}:`, subErr.response?.data || subErr.message);
      }

      connectedAccounts.push({
        igAccountId,
        username: profile.username || igAccountId,
        pageName: page.name,
        pageId: page.id,
      });
    }

    // ─── Step 6: Generate JWT ───
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    logger.info(`✅ /instagram/connect complete — ${connectedAccounts.length} account(s) connected`);

    res.json({
      success: true,
      token: jwtToken,
      accounts: connectedAccounts,
    });

  } catch (err) {
    logger.error('❌ /instagram/connect error:', {
      message: err.message,
      responseData: err.response?.data,
      responseStatus: err.response?.status,
      url: err.config?.url,
    });
    res.status(500).json({
      error: err.response?.data?.error?.message || 'Failed to connect Instagram account.',
    });
  }
});

module.exports = router;
