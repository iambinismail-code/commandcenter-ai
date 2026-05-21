// Agents API Routes — Agent Management
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET / — List all agents with status summary ──
router.get('/', (req, res) => {
  try {
    // Derive agent list from agent_logs (all known agents)
    const agents = db.prepare(`
      SELECT
        agent_name as name,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        MAX(created_at) as last_active,
        CASE
          WHEN MAX(created_at) >= datetime('now', '-5 minutes') THEN 'active'
          WHEN MAX(created_at) >= datetime('now', '-1 hour') THEN 'idle'
          ELSE 'inactive'
        END as status
      FROM agent_logs
      GROUP BY agent_name
      ORDER BY last_active DESC
    `).all();

    // Also check for agents with memory but no logs
    const memoryAgents = db.prepare(`
      SELECT DISTINCT agent_name as name FROM agent_memory
      WHERE agent_name NOT IN (SELECT DISTINCT agent_name FROM agent_logs)
    `).all();

    const allAgents = [
      ...agents,
      ...memoryAgents.map(a => ({
        name: a.name,
        total_actions: 0,
        successful: 0,
        errors: 0,
        total_tokens: 0,
        last_active: null,
        status: 'registered',
      })),
    ];

    res.json({ success: true, data: allAgents });
  } catch (error) {
    console.error('GET /agents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:name/logs — Activity logs for a specific agent ──
router.get('/:name/logs', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let where = ['agent_name = ?'];
    let params = [req.params.name];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM agent_logs ${whereClause}`
    ).get(...params).count;

    const logs = db.prepare(`
      SELECT * FROM agent_logs ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /agents/:name/logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /ask — Send a question to the AI orchestrator (stub) ──
router.post('/ask', (req, res) => {
  try {
    const { question, context, agent_name } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    // Store the question as an agent log entry for now
    // The AI orchestrator will be wired in later to process these
    const result = db.prepare(`
      INSERT INTO agent_logs (agent_name, action, input_summary, output_summary, status)
      VALUES (?, 'ask', ?, 'Queued for processing — AI orchestrator not yet connected', 'pending')
    `).run(
      agent_name || 'orchestrator',
      question.trim()
    );

    const logEntry = db.prepare('SELECT * FROM agent_logs WHERE id = ?').get(result.lastInsertRowid);

    res.status(202).json({
      success: true,
      data: {
        id: logEntry.id,
        status: 'queued',
        message: 'Question queued. AI orchestrator will process it when connected.',
        question: question.trim(),
      },
    });
  } catch (error) {
    console.error('POST /agents/ask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /memory/:name — Agent memory for a specific agent ──
router.get('/memory/:name', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { memory_type } = req.query;

    let where = ['agent_name = ?'];
    let params = [req.params.name];

    if (memory_type) {
      where.push('memory_type = ?');
      params.push(memory_type);
    }

    // Exclude expired memory
    where.push("(expires_at IS NULL OR expires_at > datetime('now'))");

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM agent_memory ${whereClause}`
    ).get(...params).count;

    const memory = db.prepare(`
      SELECT * FROM agent_memory ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Parse JSON values where possible
    const data = memory.map(m => {
      try {
        return { ...m, value: JSON.parse(m.value) };
      } catch {
        return m;
      }
    });

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /agents/memory/:name error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
