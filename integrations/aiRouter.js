// AI Provider Router — Tries Gemini first, falls back to Groq (or vice versa)
const gemini = require('./gemini');
const groq = require('./groq');

/**
 * Ask AI using Gemini first, falling back to Groq on failure.
 * This is the primary method for quality-focused responses.
 *
 * @param {string} prompt - The user prompt
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.systemPrompt] - System instruction for context
 * @param {number} [options.temperature=0.7] - Sampling temperature
 * @param {number} [options.maxOutputTokens=2048] - Max tokens in response
 * @returns {Promise<{text: string, provider: string, error: string|null}>}
 */
async function ask(prompt, options = {}) {
  const startTime = Date.now();
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    return {
      text: getFallbackResponse(prompt),
      provider: 'fallback',
      error: 'NO_PROVIDERS',
      duration: Date.now() - startTime,
    };
  }

  // Try Gemini first
  if (gemini.isAvailable()) {
    const result = await gemini.generateContent(prompt, {
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });

    if (!result.error) {
      logCall('ask', 'gemini', true, Date.now() - startTime);
      return {
        text: result.text,
        provider: 'gemini',
        usage: result.usage,
        error: null,
        duration: Date.now() - startTime,
      };
    }

    // Gemini failed, log and try fallback
    logCall('ask', 'gemini', false, Date.now() - startTime, result.error);
    console.log(`⚠️  [aiRouter] Gemini failed (${result.error}), falling back to Groq...`);
  }

  // Fall back to Groq
  if (groq.isAvailable()) {
    const messages = buildGroqMessages(prompt, options.systemPrompt);
    const result = await groq.chatCompletion(messages, {
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
    });

    if (!result.error) {
      logCall('ask', 'groq', true, Date.now() - startTime);
      return {
        text: result.text,
        provider: 'groq',
        usage: result.usage,
        error: null,
        duration: Date.now() - startTime,
      };
    }

    logCall('ask', 'groq', false, Date.now() - startTime, result.error);
    console.log(`⚠️  [aiRouter] Groq also failed (${result.error}).`);
  }

  // Both providers failed — use fallback
  return {
    text: getFallbackResponse(prompt),
    provider: 'fallback',
    error: 'ALL_PROVIDERS_FAILED',
    duration: Date.now() - startTime,
  };
}

/**
 * Ask AI using Groq first for speed, falling back to Gemini.
 * Use this for latency-sensitive operations (e.g. customer support).
 *
 * @param {string} prompt - The user prompt
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.systemPrompt] - System instruction for context
 * @param {number} [options.temperature=0.7] - Sampling temperature
 * @param {number} [options.maxOutputTokens=2048] - Max tokens in response
 * @returns {Promise<{text: string, provider: string, error: string|null}>}
 */
async function askFast(prompt, options = {}) {
  const startTime = Date.now();
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    return {
      text: getFallbackResponse(prompt),
      provider: 'fallback',
      error: 'NO_PROVIDERS',
      duration: Date.now() - startTime,
    };
  }

  // Try Groq first (faster inference)
  if (groq.isAvailable()) {
    const messages = buildGroqMessages(prompt, options.systemPrompt);
    const result = await groq.chatCompletion(messages, {
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
    });

    if (!result.error) {
      logCall('askFast', 'groq', true, Date.now() - startTime);
      return {
        text: result.text,
        provider: 'groq',
        usage: result.usage,
        error: null,
        duration: Date.now() - startTime,
      };
    }

    logCall('askFast', 'groq', false, Date.now() - startTime, result.error);
    console.log(`⚠️  [aiRouter] Groq failed (${result.error}), falling back to Gemini...`);
  }

  // Fall back to Gemini
  if (gemini.isAvailable()) {
    const result = await gemini.generateContent(prompt, {
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });

    if (!result.error) {
      logCall('askFast', 'gemini', true, Date.now() - startTime);
      return {
        text: result.text,
        provider: 'gemini',
        usage: result.usage,
        error: null,
        duration: Date.now() - startTime,
      };
    }

    logCall('askFast', 'gemini', false, Date.now() - startTime, result.error);
    console.log(`⚠️  [aiRouter] Gemini also failed (${result.error}).`);
  }

  // Both providers failed
  return {
    text: getFallbackResponse(prompt),
    provider: 'fallback',
    error: 'ALL_PROVIDERS_FAILED',
    duration: Date.now() - startTime,
  };
}

// ── Helpers ──

/**
 * Build Groq-compatible messages array from prompt + optional system prompt.
 */
function buildGroqMessages(prompt, systemPrompt) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  return messages;
}

/**
 * Get list of available AI providers.
 */
function getAvailableProviders() {
  const available = [];
  if (gemini.isAvailable()) available.push('gemini');
  if (groq.isAvailable()) available.push('groq');
  return available;
}

/**
 * Generate a fallback response when no AI providers are available.
 */
function getFallbackResponse(prompt) {
  const lower = (prompt || '').toLowerCase();

  if (lower.includes('help') || lower.includes('what can you do')) {
    return '🤖 I\'m CommandCenter AI. I can help with content creation, social media management, ' +
      'customer support, analytics, and task management. However, AI features require API keys to be configured. ' +
      'Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.';
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return '👋 Hello! I\'m CommandCenter AI. My AI capabilities are currently offline — ' +
      'please configure GEMINI_API_KEY or GROQ_API_KEY in your .env file to enable smart features.';
  }

  return '⚠️ No AI providers are currently configured. Please add GEMINI_API_KEY or GROQ_API_KEY ' +
    'to your .env file to enable AI-powered responses. I can still help with basic database operations.';
}

/**
 * Log an AI call for debugging and monitoring.
 */
function logCall(method, provider, success, durationMs, error = null) {
  const status = success ? '✓' : '✗';
  const msg = `[aiRouter] ${method} → ${provider} ${status} (${durationMs}ms)${error ? ' — ' + error : ''}`;

  if (success) {
    console.log(`  🧠 ${msg}`);
  } else {
    console.log(`  ⚠️  ${msg}`);
  }
}

module.exports = { ask, askFast, getAvailableProviders, getFallbackResponse };
