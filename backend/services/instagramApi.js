const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Exchange short-lived token for long-lived token
 */
async function exchangeForLongLivedToken(shortLivedToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    return response.data; // { access_token, token_type, expires_in }
  } catch (error) {
    logger.error('Token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange access token');
  }
}

/**
 * Get Instagram Business Account connected to Facebook Page
 */
async function getInstagramBusinessAccount(pageId, pageAccessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
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

/**
 * Get user's Facebook pages
 */
async function getUserPages(userAccessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
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

/**
 * Get Instagram profile info
 */
async function getInstagramProfile(igAccountId, accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/${igAccountId}`, {
      params: {
        fields: 'id,name,username,profile_picture_url,followers_count,media_count',
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Get IG profile error:', error.response?.data || error.message);
    throw new Error('Failed to fetch Instagram profile');
  }
}

/**
 * Get posts for an Instagram account
 */
async function getInstagramPosts(igAccountId, accessToken, limit = 20) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/${igAccountId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink',
        limit,
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Get posts error:', error.response?.data || error.message);
    throw new Error('Failed to fetch Instagram posts');
  }
}

/**
 * Reply to a comment on Instagram
 */
async function sendCommentReply(commentId, replyText, accessToken) {
  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${commentId}/replies`,
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
 * Requires instagram_manage_messages permission
 */
async function sendInstagramDM(igAccountId, recipientIgId, messageText, accessToken) {
  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${igAccountId}/messages`,
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
 * Subscribe page to webhook events
 */
async function subscribePageToWebhook(pageId, pageAccessToken) {
  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'feed,comments,messages,message_reactions',
          access_token: pageAccessToken,
        },
      }
    );
    return response.data;
  } catch (error) {
    logger.error('Webhook subscribe error:', error.response?.data || error.message);
    throw new Error('Failed to subscribe page to webhook');
  }
}

/**
 * Get comment details
 */
async function getCommentDetails(commentId, accessToken) {
  try {
    const response = await axios.get(`${GRAPH_API_BASE}/${commentId}`, {
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
    const response = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: { access_token: accessToken },
    });
    return { valid: true, data: response.data };
  } catch (error) {
    return { valid: false, error: error.response?.data };
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
};
