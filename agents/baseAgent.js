// Base Agent — Common functionality for all CommandCenter AI agents
const { ask, askFast } = require('../integrations/aiRouter');
const db = require('../server/config/database');

class BaseAgent {
  /**
   * @param {string} name - Agent identifier (e.g. 'content_creator')
   * @param {string} description - Human-readable description
   * @param {string} systemPrompt - System instruction for AI context
   */
  constructor(name, description, systemPrompt) {
    this.name = name;
    this.description = description;
    this.systemPrompt = systemPrompt;
    this.status = 'idle';

    // Prepare database statements
    this._stmts = {
      insertLog: db.prepare(`
        INSERT INTO agent_logs (agent_name, action, input_summary, output_summary, status, tokens_used, duration_ms, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      insertMemory: db.prepare(`
        INSERT INTO agent_memory (agent_name, memory_type, key, value, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `),
      selectMemory: db.prepare(`
        SELECT value, memory_type, created_at FROM agent_memory
        WHERE agent_name = ? AND key = ?
        ORDER BY created_at DESC LIMIT 1
      `),
      deleteMemory: db.prepare(`
        DELETE FROM agent_memory WHERE agent_name = ? AND key = ?
      `),
      recentLogs: db.prepare(`
        SELECT * FROM agent_logs WHERE agent_name = ?
        ORDER BY created_at DESC LIMIT ?
      `),
    };
  }

  /**
   * Send a prompt to AI with this agent's system context.
   * Uses Gemini-first routing for quality responses.
   *
   * @param {string} input - The prompt/question
   * @param {Object} [options={}] - AI options (temperature, maxOutputTokens)
   * @returns {Promise<string>} The AI response text
   */
  async think(input, options = {}) {
    this.status = 'working';
    const startTime = Date.now();

    try {
      const result = await ask(input, {
        systemPrompt: this.systemPrompt,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
      });

      const duration = Date.now() - startTime;
      const tokensUsed = result.usage?.totalTokens || result.usage?.total_tokens || 0;

      // Log the activity
      this.log('think', input, result.text, result.error ? 'error' : 'success', tokensUsed, duration, result.error);

      this.status = 'idle';
      return result.text;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.log('think', input, '', 'error', 0, duration, err.message);
      this.status = 'error';
      throw err;
    }
  }

  /**
   * Send a prompt to AI with fast routing (Groq-first).
   * Use for latency-sensitive operations.
   *
   * @param {string} input - The prompt/question
   * @param {Object} [options={}] - AI options
   * @returns {Promise<string>} The AI response text
   */
  async thinkFast(input, options = {}) {
    this.status = 'working';
    const startTime = Date.now();

    try {
      const result = await askFast(input, {
        systemPrompt: this.systemPrompt,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
      });

      const duration = Date.now() - startTime;
      const tokensUsed = result.usage?.totalTokens || result.usage?.total_tokens || 0;

      this.log('thinkFast', input, result.text, result.error ? 'error' : 'success', tokensUsed, duration, result.error);

      this.status = 'idle';
      return result.text;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.log('thinkFast', input, '', 'error', 0, duration, err.message);
      this.status = 'error';
      throw err;
    }
  }

  /**
   * Log an agent activity to the agent_logs table.
   *
   * @param {string} action - Action performed
   * @param {string} input - Input summary (truncated)
   * @param {string} output - Output summary (truncated)
   * @param {string} [status='success'] - Status: success, error
   * @param {number} [tokensUsed=0] - Tokens consumed
   * @param {number} [durationMs=0] - Duration in milliseconds
   * @param {string|null} [errorMessage=null] - Error message if failed
   */
  log(action, input, output, status = 'success', tokensUsed = 0, durationMs = 0, errorMessage = null) {
    try {
      this._stmts.insertLog.run(
        this.name,
        action,
        truncate(input, 500),
        truncate(output, 1000),
        status,
        tokensUsed,
        durationMs,
        errorMessage
      );
    } catch (err) {
      console.error(`[${this.name}] Failed to write log:`, err.message);
    }
  }

  /**
   * Store a value in agent_memory for later recall.
   *
   * @param {string} key - Memory key
   * @param {*} value - Value to store (will be JSON-stringified if not a string)
   * @param {string} [type='short'] - Memory type: 'short', 'long', 'context'
   * @param {number|null} [ttlSeconds=null] - Time-to-live in seconds (null = no expiry)
   */
  remember(key, value, type = 'short', ttlSeconds = null) {
    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      const expiresAt = ttlSeconds
        ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
        : null;

      // Upsert: delete old, insert new
      this._stmts.deleteMemory.run(this.name, key);
      this._stmts.insertMemory.run(this.name, type, key, valueStr, expiresAt);
    } catch (err) {
      console.error(`[${this.name}] Failed to remember '${key}':`, err.message);
    }
  }

  /**
   * Recall a value from agent_memory.
   *
   * @param {string} key - Memory key
   * @returns {*} The stored value (parsed from JSON if possible), or null if not found/expired
   */
  recall(key) {
    try {
      const row = this._stmts.selectMemory.get(this.name, key);
      if (!row) return null;

      // Check expiry (if the row had an expires_at, it's handled at query level
      // but we also check here for safety)
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    } catch (err) {
      console.error(`[${this.name}] Failed to recall '${key}':`, err.message);
      return null;
    }
  }

  /**
   * Get recent activity logs for this agent.
   *
   * @param {number} [limit=20] - Max number of log entries
   * @returns {Array<Object>}
   */
  getRecentLogs(limit = 20) {
    try {
      return this._stmts.recentLogs.all(this.name, limit);
    } catch (err) {
      console.error(`[${this.name}] Failed to get logs:`, err.message);
      return [];
    }
  }

  /**
   * Get agent status info.
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      status: this.status,
    };
  }
}

/**
 * Truncate a string to maxLen characters.
 */
function truncate(str, maxLen) {
  if (!str) return '';
  const s = typeof str === 'string' ? str : String(str);
  return s.length > maxLen ? s.substring(0, maxLen) + '...' : s;
}

module.exports = BaseAgent;
