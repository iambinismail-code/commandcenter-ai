// Analytics API Routes — Read-Only Dashboard Data
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /overview — Dashboard summary counts + recent growth ──
router.get('/overview', (req, res) => {
  try {
    const contacts = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
    const leads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const deals = db.prepare('SELECT COUNT(*) as count FROM deals').get().count;
    const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const content = db.prepare('SELECT COUNT(*) as count FROM content').get().count;

    // Growth: new records in the last 7 days
    const recentContacts = db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE created_at >= datetime('now', '-7 days')"
    ).get().count;
    const recentLeads = db.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-7 days')"
    ).get().count;
    const recentDeals = db.prepare(
      "SELECT COUNT(*) as count FROM deals WHERE created_at >= datetime('now', '-7 days')"
    ).get().count;
    const recentTasks = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE created_at >= datetime('now', '-7 days')"
    ).get().count;

    // Revenue totals
    const revenue = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN stage = 'completed' OR stage = 'paid' THEN amount ELSE 0 END), 0) as collected,
        COALESCE(SUM(CASE WHEN stage = 'pending' THEN amount ELSE 0 END), 0) as pending
      FROM deals
    `).get();

    // Task completion rate
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const doneTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'").get().count;
    const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        totals: { contacts, leads, deals, tasks, content },
        growth: {
          contacts: recentContacts,
          leads: recentLeads,
          deals: recentDeals,
          tasks: recentTasks,
        },
        revenue,
        taskCompletionRate,
      },
    });
  } catch (error) {
    console.error('GET /analytics/overview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /pipeline — Lead pipeline summary ──
router.get('/pipeline', (req, res) => {
  try {
    const stages = db.prepare(`
      SELECT
        stage,
        COUNT(*) as count,
        COALESCE(SUM(value), 0) as total_value
      FROM leads
      GROUP BY stage
      ORDER BY
        CASE stage
          WHEN 'new' THEN 1
          WHEN 'contacted' THEN 2
          WHEN 'qualified' THEN 3
          WHEN 'proposal' THEN 4
          WHEN 'negotiation' THEN 5
          WHEN 'won' THEN 6
          WHEN 'lost' THEN 7
          ELSE 8
        END
    `).all();

    const conversionRate = (() => {
      const total = stages.reduce((s, st) => s + st.count, 0);
      const won = stages.find(s => s.stage === 'won');
      return total > 0 ? Math.round(((won ? won.count : 0) / total) * 100) : 0;
    })();

    res.json({
      success: true,
      data: { stages, conversionRate },
    });
  } catch (error) {
    console.error('GET /analytics/pipeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /revenue — Revenue by month ──
router.get('/revenue', (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as deal_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN stage = 'completed' OR stage = 'paid' THEN amount ELSE 0 END), 0) as collected
      FROM deals
      WHERE created_at >= datetime('now', ? || ' months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `).all(`-${months}`);

    // Overall totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_deals,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN stage = 'completed' OR stage = 'paid' THEN amount ELSE 0 END), 0) as total_collected
      FROM deals
    `).get();

    res.json({
      success: true,
      data: { monthly, totals },
    });
  } catch (error) {
    console.error('GET /analytics/revenue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /agents — Agent activity summary ──
router.get('/agents', (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT
        agent_name,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
        MAX(created_at) as last_active
      FROM agent_logs
      GROUP BY agent_name
      ORDER BY total_actions DESC
    `).all();

    // Recent agent activity (last 24h)
    const recentActivity = db.prepare(`
      SELECT
        agent_name,
        COUNT(*) as actions_24h
      FROM agent_logs
      WHERE created_at >= datetime('now', '-1 day')
      GROUP BY agent_name
    `).all();

    const recentMap = {};
    recentActivity.forEach(r => { recentMap[r.agent_name] = r.actions_24h; });

    const data = agents.map(a => ({
      ...a,
      avg_duration_ms: Math.round(a.avg_duration_ms),
      actions_24h: recentMap[a.agent_name] || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('GET /analytics/agents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /activity — Recent activity feed across all modules ──
router.get('/activity', (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const activities = [];

    // Recent contacts
    const recentContacts = db.prepare(`
      SELECT id, name as title, 'contact' as type, 'Contact added' as action, created_at as timestamp
      FROM contacts ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentContacts);

    // Recent leads
    const recentLeads = db.prepare(`
      SELECT id, title, 'lead' as type, ('Lead — ' || stage) as action, created_at as timestamp
      FROM leads ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentLeads);

    // Recent deals
    const recentDeals = db.prepare(`
      SELECT id, title, 'deal' as type, ('Deal — ' || stage || ' — ' || amount) as action, created_at as timestamp
      FROM deals ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentDeals);

    // Recent tasks
    const recentTasks = db.prepare(`
      SELECT id, title, 'task' as type, ('Task — ' || status) as action, created_at as timestamp
      FROM tasks ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentTasks);

    // Recent content
    const recentContent = db.prepare(`
      SELECT id, title, 'content' as type, ('Content — ' || status) as action, created_at as timestamp
      FROM content ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentContent);

    // Recent agent actions
    const recentAgents = db.prepare(`
      SELECT id, agent_name as title, 'agent' as type, action, created_at as timestamp
      FROM agent_logs ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    activities.push(...recentAgents);

    // Sort all by timestamp descending, take top N
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const feed = activities.slice(0, limit);

    res.json({ success: true, data: feed });
  } catch (error) {
    console.error('GET /analytics/activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
