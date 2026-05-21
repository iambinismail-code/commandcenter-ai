// Groq API Client — Native Node.js https (NO external HTTP libs)
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
      req.destroy(new Error('Groq API request timed out after 30s'));
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Send a chat completion request to Groq API (OpenAI-compatible format).
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} [options={}] - Optional configuration
 * @param {number} [options.temperature=0.7] - Sampling temperature (0-2)
 * @param {number} [options.max_tokens=2048] - Max tokens in response
 * @param {string} [options.model] - Override model (default from config)
 * @returns {Promise<{text: string, usage: Object|null, raw: Object}>}
 */
async function chatCompletion(messages, options = {}) {
  const apiKey = config.groq.apiKey;

  // Graceful degradation when API key is missing
  if (!apiKey) {
    return {
      text: '[Groq] API key not configured. Please set GROQ_API_KEY in your .env file.',
      usage: null,
      raw: null,
      provider: 'groq',
      error: 'NO_API_KEY',
    };
  }

  const model = options.model || config.groq.model || 'llama-3.3-70b-versatile';
  const temperature = options.temperature ?? 0.7;
  const max_tokens = options.max_tokens ?? 2048;

  const requestBody = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens,
  });

  const requestOptions = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    },
  };

  try {
    const response = await httpsRequest(requestOptions, requestBody);

    // Handle HTTP-level errors
    if (response.statusCode === 429) {
      const retryAfter = response.headers['retry-after'];
      return {
        text: `[Groq] Rate limit exceeded.${retryAfter ? ` Retry after ${retryAfter}s.` : ' Please wait a moment.'}`,
        usage: null,
        raw: response.body,
        provider: 'groq',
        error: 'RATE_LIMITED',
      };
    }

    if (response.statusCode === 401 || response.statusCode === 403) {
      return {
        text: '[Groq] Invalid API key. Please check your GROQ_API_KEY.',
        usage: null,
        raw: response.body,
        provider: 'groq',
        error: 'AUTH_ERROR',
      };
    }

    if (response.statusCode !== 200) {
      const errMsg =
        response.body?.error?.message ||
        (typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
      return {
        text: `[Groq] API error (${response.statusCode}): ${errMsg}`,
        usage: null,
        raw: response.body,
        provider: 'groq',
        error: 'API_ERROR',
      };
    }

    // Parse successful response (OpenAI-compatible format)
    const data = response.body;
    const text =
      data.choices?.[0]?.message?.content ||
      '[Groq] No text in response';

    const usage = data.usage || null;

    return {
      text,
      usage,
      raw: data,
      provider: 'groq',
      error: null,
    };
  } catch (err) {
    return {
      text: `[Groq] Request failed: ${err.message}`,
      usage: null,
      raw: null,
      provider: 'groq',
      error: 'NETWORK_ERROR',
    };
  }
}

/**
 * Check if Groq is available (API key is configured).
 * @returns {boolean}
 */
function isAvailable() {
  return !!config.groq.apiKey;
}

module.exports = { chatCompletion, isAvailable };
