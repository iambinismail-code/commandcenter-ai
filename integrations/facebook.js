// Facebook / Meta Graph API Wrapper — Native Node.js https
const https = require('https');
const config = require('../server/config/env');

/**
 * Make an HTTPS request to the Facebook Graph API.
 * @param {string} method - HTTP method
 * @param {string} urlPath - Path after graph.facebook.com/v21.0
 * @param {Object|null} body - JSON body (for POST/DELETE)
 * @param {Object} [queryParams={}] - URL query parameters
 * @returns {Promise<Object>}
 */
function graphRequest(method, urlPath, body = null, queryParams = {}) {
  return new Promise((resolve, reject) => {
    // Build query string
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const version = config.facebook.graphApiVersion || 'v21.0';
    const fullPath = `/${version}${urlPath}${qs ? '?' + qs : ''}`;

    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: fullPath,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(raw);
          resolve({ statusCode: res.statusCode, body: json });
        } catch {
          resolve({ statusCode: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy(new Error('Facebook Graph API request timed out after 30s'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Check Graph API response for errors and throw if found.
 * @param {Object} response - The HTTP response object
 * @param {string} context - Description of the operation for error messages
 * @returns {Object} response.body on success
 */
function handleResponse(response, context) {
  if (response.body?.error) {
    const err = response.body.error;

    // Check for specific error types
    if (err.code === 190) {
      throw new Error(`[Facebook] ${context}: Access token expired or invalid. Please refresh your FB_PAGE_ACCESS_TOKEN.`);
    }
    if (err.code === 4 || err.code === 32) {
      throw new Error(`[Facebook] ${context}: Rate limit reached. Please wait before trying again.`);
    }
    if (err.code === 10 || err.code === 200) {
      throw new Error(`[Facebook] ${context}: Insufficient permissions. Check your app permissions.`);
    }

    throw new Error(`[Facebook] ${context}: (${err.code}) ${err.message}`);
  }

  if (response.statusCode >= 400) {
    throw new Error(`[Facebook] ${context}: HTTP ${response.statusCode} — ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

/**
 * Publish a text post to a Facebook Page.
 * @param {string} pageId - The Facebook Page ID
 * @param {string} message - Post text content
 * @param {string} accessToken - Page Access Token
 * @returns {Promise<{id: string}>} The created post ID
 */
async function publishPost(pageId, message, accessToken) {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');
  if (!pageId) throw new Error('[Facebook] Page ID is required.');

  const response = await graphRequest('POST', `/${pageId}/feed`, null, {
    message,
    access_token: token,
  });

  return handleResponse(response, 'publishPost');
}

/**
 * Publish a photo post to a Facebook Page.
 * @param {string} pageId - The Facebook Page ID
 * @param {string} imageUrl - Public URL of the image
 * @param {string} caption - Photo caption
 * @param {string} accessToken - Page Access Token
 * @returns {Promise<{id: string, post_id: string}>}
 */
async function publishPhoto(pageId, imageUrl, caption, accessToken) {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');
  if (!pageId) throw new Error('[Facebook] Page ID is required.');

  const response = await graphRequest('POST', `/${pageId}/photos`, null, {
    url: imageUrl,
    caption: caption || '',
    access_token: token,
  });

  return handleResponse(response, 'publishPhoto');
}

/**
 * Get recent posts from a Facebook Page.
 * @param {string} pageId - The Facebook Page ID
 * @param {string} accessToken - Page Access Token
 * @param {number} [limit=25] - Number of posts to retrieve
 * @returns {Promise<{data: Array}>}
 */
async function getPagePosts(pageId, accessToken, limit = 25) {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');

  const response = await graphRequest('GET', `/${pageId}/posts`, null, {
    fields: 'id,message,created_time,story,full_picture,permalink_url',
    limit: String(limit),
    access_token: token,
  });

  return handleResponse(response, 'getPagePosts');
}

/**
 * Get insights/metrics for a specific post.
 * @param {string} postId - The Facebook Post ID
 * @param {string} accessToken - Page Access Token
 * @returns {Promise<{data: Array}>}
 */
async function getPostInsights(postId, accessToken) {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');

  const response = await graphRequest('GET', `/${postId}/insights`, null, {
    metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_reactions_like_total',
    access_token: token,
  });

  return handleResponse(response, 'getPostInsights');
}

/**
 * Get insights/metrics for a Facebook Page.
 * @param {string} pageId - The Facebook Page ID
 * @param {string} accessToken - Page Access Token
 * @param {string} [period='day'] - Metric period: day, week, days_28
 * @returns {Promise<{data: Array}>}
 */
async function getPageInsights(pageId, accessToken, period = 'day') {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');

  const response = await graphRequest('GET', `/${pageId}/insights`, null, {
    metric: 'page_views_total,page_fan_adds,page_engaged_users,page_impressions,page_post_engagements',
    period,
    access_token: token,
  });

  return handleResponse(response, 'getPageInsights');
}

/**
 * Delete a Facebook post.
 * @param {string} postId - The Facebook Post ID to delete
 * @param {string} accessToken - Page Access Token
 * @returns {Promise<{success: boolean}>}
 */
async function deletePost(postId, accessToken) {
  const token = accessToken || config.facebook.pageAccessToken;
  if (!token) throw new Error('[Facebook] No access token configured. Set FB_PAGE_ACCESS_TOKEN in .env.');
  if (!postId) throw new Error('[Facebook] Post ID is required.');

  const response = await graphRequest('DELETE', `/${postId}`, null, {
    access_token: token,
  });

  return handleResponse(response, 'deletePost');
}

/**
 * Check if Facebook integration is available (access token configured).
 * @returns {boolean}
 */
function isAvailable() {
  return !!(config.facebook.pageAccessToken && config.facebook.pageId);
}

module.exports = {
  publishPost,
  publishPhoto,
  getPagePosts,
  getPostInsights,
  getPageInsights,
  deletePost,
  isAvailable,
};
