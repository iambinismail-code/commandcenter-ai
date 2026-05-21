// Google Gemini API Client — Native Node.js https (NO external HTTP libs)
const https = require('https');
const config = require('../server/config/env');

/**
 * Make an HTTPS request and return the parsed JSON response.
 * @param {Object} options - https.request options
 * @param {string|Buffer} body - Request body
 * @returns {Promise<Object>}
 */
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(raw);
          resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: raw });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy(new Error('Gemini API request timed out after 30s'));
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Generate content using Google Gemini API.
 * @param {string} prompt - The text prompt to send
 * @param {Object} [options={}] - Optional configuration
 * @param {number} [options.temperature=0.7] - Sampling temperature (0-2)
 * @param {number} [options.maxOutputTokens=2048] - Max tokens in response
 * @param {string} [options.model] - Override model (default from config)
 * @param {string} [options.systemPrompt] - System instruction prepended to prompt
 * @returns {Promise<{text: string, usage: Object|null, raw: Object}>}
 */
async function generateContent(prompt, options = {}) {
  const apiKey = config.gemini.apiKey;

  // Graceful degradation when API key is missing
  if (!apiKey) {
    return {
      text: '[Gemini] API key not configured. Please set GEMINI_API_KEY in your .env file.',
      usage: null,
      raw: null,
      provider: 'gemini',
      error: 'NO_API_KEY',
    };
  }

  const model = options.model || config.gemini.model || 'gemini-2.0-flash';
  const temperature = options.temperature ?? 0.7;
  const maxOutputTokens = options.maxOutputTokens ?? 2048;

  // Build the request body
  const contents = [];

  // If a system prompt is provided, add it as a separate "model" turn first
  if (options.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: options.systemPrompt }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will follow those instructions.' }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  const requestBody = JSON.stringify({
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  });

  const urlPath = `/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestOptions = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: urlPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    },
  };

  try {
    const response = await httpsRequest(requestOptions, requestBody);

    // Handle HTTP-level errors
    if (response.statusCode === 429) {
      return {
        text: '[Gemini] Rate limit exceeded. Please wait a moment and try again.',
        usage: null,
        raw: response.body,
        provider: 'gemini',
        error: 'RATE_LIMITED',
      };
    }

    if (response.statusCode === 401 || response.statusCode === 403) {
      return {
        text: '[Gemini] Invalid API key. Please check your GEMINI_API_KEY.',
        usage: null,
        raw: response.body,
        provider: 'gemini',
        error: 'AUTH_ERROR',
      };
    }

    if (response.statusCode !== 200) {
      const errMsg = response.body?.error?.message || JSON.stringify(response.body);
      return {
        text: `[Gemini] API error (${response.statusCode}): ${errMsg}`,
        usage: null,
        raw: response.body,
        provider: 'gemini',
        error: 'API_ERROR',
      };
    }

    // Parse successful response
    const data = response.body;

    // Check for blocked content
    if (data.promptFeedback?.blockReason) {
      return {
        text: `[Gemini] Content blocked: ${data.promptFeedback.blockReason}`,
        usage: null,
        raw: data,
        provider: 'gemini',
        error: 'CONTENT_BLOCKED',
      };
    }

    // Extract text from candidates
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      '[Gemini] No text in response';

    const usage = data.usageMetadata || null;

    return {
      text,
      usage,
      raw: data,
      provider: 'gemini',
      error: null,
    };
  } catch (err) {
    return {
      text: `[Gemini] Request failed: ${err.message}`,
      usage: null,
      raw: null,
      provider: 'gemini',
      error: 'NETWORK_ERROR',
    };
  }
}

/**
 * Check if Gemini is available (API key is configured).
 * @returns {boolean}
 */
function isAvailable() {
  return !!config.gemini.apiKey;
}

module.exports = { generateContent, isAvailable };
