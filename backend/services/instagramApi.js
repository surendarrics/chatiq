const axios = require('axios');
const logger = require('../utils/logger');

// ═════════════════════════════════════════════════════════════════════════════
// Instagram API Service
// Supports BOTH Instagram Login tokens (graph.instagram.com)
// and legacy Facebook Login tokens (graph.facebook.com)
// ═════════════════════════════════════════════════════════════════════════════

const IG_GRAPH_BASE = 'https://graph.instagram.com/v21.0';
const FB_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Determine which API base URL to use based on the token type.
 * Instagram Login tokens work with graph.instagram.com
 * Facebook Login tokens work with graph.facebook.com
 * We try Instagram first, fall back to Facebook.
 */
function getApiBase(account) {
  // If page_id is empty or missing, it's an Instagram Login token
  if (!account.page_id || account.page_id === '') {
    return IG_GRAPH_BASE;
  }
  return FB_GRAPH_BASE;
}

/**
 * Get the best access token for an account.
 * Instagram Login: use the account's access_token directly
 * Facebook Login: use page_access_token
 */
function getToken(account) {
  if (!account.page_id || account.page_id === '') {
    return account.access_token;
  }
  return account.page_access_token || account.access_token;
}

/**
 * Get Instagram profile info
 */
async function getInstagramProfile(igAccountId, accessToken) {
  try {
    // Try Instagram Graph API first
    const response = await axios.get(`${IG_GRAPH_BASE}/me`, {
      params: {
        fields: 'user_id,username,name,account_type,profile_picture_url,followers_count,media_count',
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (err) {
    logger.warn('IG Graph API /me failed, trying FB Graph API...', err.response?.data?.error?.message);
    // Fallback to Facebook Graph API
    const response = await axios.get(`${FB_GRAPH_BASE}/${igAccountId}`, {
      params: {
        fields: 'id,name,username,profile_picture_url,followers_count,media_count',
        access_token: accessToken,
      },
    });
    return response.data;
  }
}

/**
 * Get posts/reels for an Instagram account
 * Works with both Instagram Login and Facebook Login tokens
 */
async function getInstagramPosts(account, limit = 20) {
  const accessToken = getToken(account);
  const apiBase = getApiBase(account);
  const igId = account.ig_account_id;

  try {
    let url;
    if (apiBase === IG_GRAPH_BASE) {
      // Instagram Login: use /me/media
      url = `${IG_GRAPH_BASE}/me/media`;
    } else {
      // Facebook Login: use /{ig-user-id}/media
      url = `${FB_GRAPH_BASE}/${igId}/media`;
    }

    const response = await axios.get(url, {
      params: {
        fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink',
        limit,
        access_token: accessToken,
      },
    });

    // Post-process: for VIDEO/REEL posts missing thumbnail_url, try fetching individually
    const posts = response.data?.data || [];
    for (const post of posts) {
      if ((post.media_type === 'VIDEO') && !post.thumbnail_url) {
        try {
          const detailRes = await axios.get(`${apiBase}/${post.id}`, {
            params: {
              fields: 'thumbnail_url',
              access_token: accessToken,
            },
          });
          if (detailRes.data?.thumbnail_url) {
            post.thumbnail_url = detailRes.data.thumbnail_url;
          }
        } catch (e) {
          // Silent fail — just won't have a thumbnail
          logger.warn(`Could not fetch thumbnail for post ${post.id}: ${e.message}`);
        }
      }
    }

    logger.info(`Fetched ${posts.length} posts for account ${igId}`);
    return response.data;
  } catch (error) {
    logger.error('Get posts error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch posts: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Reply to a comment on Instagram
 */
async function sendCommentReply(commentId, replyText, accessToken, account) {
  const apiBase = account ? getApiBase(account) : FB_GRAPH_BASE;
  try {
    const response = await axios.post(
      `${apiBase}/${commentId}/replies`,
      null,
      {
        params: {
          message: replyText,
          access_token: accessToken,
        },
      }
    );
    logger.info(`Comment reply sent to ${commentId}`);
    return response.data;
  } catch (error) {
    logger.error('Comment reply error:', error.response?.data || error.message);
    throw new Error(`Failed to reply to comment: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Send a Direct Message via Instagram Messaging API
 * Requires instagram_business_manage_messages permission
 */
async function sendInstagramDM(igAccountId, recipientIgId, messageText, accessToken, account) {
  const apiBase = account ? getApiBase(account) : FB_GRAPH_BASE;
  try {
    const response = await axios.post(
      `${apiBase}/${igAccountId}/messages`,
      {
        recipient: { id: recipientIgId },
        message: { text: messageText },
      },
      {
        params: { access_token: accessToken },
      }
    );
    logger.info(`DM sent to user ${recipientIgId}`);
    return response.data;
  } catch (error) {
    logger.error('DM send error:', error.response?.data || error.message);
    // Don't throw - user may have DMs disabled, log and continue
    return { error: error.response?.data?.error?.message || 'DM failed' };
  }
}

/**
 * Get comment details
 */
async function getCommentDetails(commentId, accessToken, account) {
  const apiBase = account ? getApiBase(account) : FB_GRAPH_BASE;
  try {
    const response = await axios.get(`${apiBase}/${commentId}`, {
      params: {
        fields: 'id,text,username,from,timestamp,media',
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Get comment error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Validate token is still active
 */
async function validateToken(accessToken) {
  try {
    // Try Instagram Graph API
    const response = await axios.get(`${IG_GRAPH_BASE}/me`, {
      params: {
        fields: 'user_id,username',
        access_token: accessToken,
      },
    });
    return { valid: true, data: response.data };
  } catch (err) {
    // Fallback to Facebook Graph API
    try {
      const response = await axios.get(`${FB_GRAPH_BASE}/me`, {
        params: { access_token: accessToken },
      });
      return { valid: true, data: response.data };
    } catch (error) {
      return { valid: false, error: error.response?.data };
    }
  }
}

async function subscribePageToWebhook(account) {
  const isIgLogin = !account.page_id || account.page_id === '';
  const token = isIgLogin ? account.access_token : account.page_access_token;
  const targetId = isIgLogin ? account.ig_account_id : account.page_id;
  const apiBase = isIgLogin ? IG_GRAPH_BASE : FB_GRAPH_BASE;
  const fields = isIgLogin ? 'comments,messages' : 'feed,comments,messages,message_reactions';

  // For Instagram Login, subscribing an app is handled exclusively in the Meta App Dashboard under Instagram.
  // There is no /subscribed_apps endpoint for Instagram user IDs.
  if (isIgLogin) {
    logger.info(`ℹ️ IG Login account detected (@${account.username}). Skipping /subscribed_apps API call; Webhooks configure automatically if App Dashboard is set up.`);
    return { success: true, method: 'app_dashboard_only' };
  }

  try {
    const response = await axios.post(
      `${apiBase}/${targetId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: fields,
          access_token: token,
        },
      }
    );
    return response.data;
  } catch (error) {
    logger.error('Webhook subscribe error:', error.response?.data || error.message);
    throw new Error('Failed to subscribe account to webhook');
  }
}

// Legacy functions (kept for backward compatibility)
async function exchangeForLongLivedToken(shortLivedToken) {
  try {
    const response = await axios.get(`${FB_GRAPH_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange access token');
  }
}

async function getInstagramBusinessAccount(pageId, pageAccessToken) {
  try {
    const response = await axios.get(`${FB_GRAPH_BASE}/${pageId}`, {
      params: {
        fields: 'instagram_business_account',
        access_token: pageAccessToken,
      },
    });
    return response.data.instagram_business_account;
  } catch (error) {
    logger.error('Get IG account error:', error.response?.data || error.message);
    throw new Error('Failed to fetch Instagram Business Account');
  }
}

async function getUserPages(userAccessToken) {
  try {
    const response = await axios.get(`${FB_GRAPH_BASE}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: userAccessToken,
      },
    });
    return response.data.data;
  } catch (error) {
    logger.error('Get pages error:', error.response?.data || error.message);
    throw new Error('Failed to fetch Facebook Pages');
  }
}

module.exports = {
  exchangeForLongLivedToken,
  getInstagramBusinessAccount,
  getUserPages,
  getInstagramProfile,
  getInstagramPosts,
  sendCommentReply,
  sendInstagramDM,
  subscribePageToWebhook,
  getCommentDetails,
  validateToken,
  getApiBase,
  getToken,
};
