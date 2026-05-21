// Leads API Routes — Full CRUD + Pipeline
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /pipeline — Leads grouped by stage with counts and totals ──
router.get('/pipeline', (req, res) => {
  try {
    const stages = db.prepare(`
      SELECT
        stage,
        COUNT(*) as count,
        COALESCE(SUM(value), 0) as total_value,
        COALESCE(AVG(value), 0) as avg_value
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

    const totalLeads = stages.reduce((sum, s) => sum + s.count, 0);
    const totalValue = stages.reduce((sum, s) => sum + s.total_value, 0);

    res.json({
      success: true,
      data: {
        stages,
        summary: { totalLeads, totalValue },
      },
    });
  } catch (error) {
    console.error('GET /leads/pipeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET / — List leads with filters and pagination ──
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, stage, priority } = req.query;

    let where = [];
    let params = [];

    if (search) {
      where.push(`(l.title LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`);
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (stage) {
      where.push(`l.stage = ?`);
      params.push(stage);
    }
    if (priority) {
      where.push(`l.priority = ?`);
      params.push(priority);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      ${whereClause}
    `).get(...params).count;

    const leads = db.prepare(`
      SELECT l.*, c.name as contact_name, c.email as contact_email, c.company as contact_company
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /leads error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id — Single lead ──
router.get('/:id', (req, res) => {
  try {
    const lead = db.prepare(`
      SELECT l.*, c.name as contact_name, c.email as contact_email, c.company as contact_company
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.id = ?
    `).get(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Also grab associated deals
    const deals = db.prepare(
      'SELECT * FROM deals WHERE lead_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);

    res.json({ success: true, data: { ...lead, deals } });
  } catch (error) {
    console.error('GET /leads/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST / — Create a lead ──
router.post('/', (req, res) => {
  try {
    const { contact_id, title, value, stage, priority, assigned_agent, source, notes, expected_close } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Verify contact exists if provided
    if (contact_id) {
      const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contact_id);
      if (!contact) {
        return res.status(400).json({ success: false, error: 'Contact not found' });
      }
    }

    const result = db.prepare(`
      INSERT INTO leads (contact_id, title, value, stage, priority, assigned_agent, source, notes, expected_close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contact_id || null,
      title.trim(),
      value || 0,
      stage || 'new',
      priority || 'medium',
      assigned_agent || null,
      source || null,
      notes || null,
      expected_close || null
    );

    const lead = db.prepare(`
      SELECT l.*, c.name as contact_name, c.email as contact_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    console.error('POST /leads error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id — Update a lead ──
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const { contact_id, title, value, stage, priority, assigned_agent, source, notes, expected_close } = req.body;

    db.prepare(`
      UPDATE leads SET
        contact_id = ?, title = ?, value = ?, stage = ?, priority = ?,
        assigned_agent = ?, source = ?, notes = ?, expected_close = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      contact_id !== undefined ? contact_id : existing.contact_id,
      (title && title.trim()) || existing.title,
      value !== undefined ? value : existing.value,
      stage || existing.stage,
      priority || existing.priority,
      assigned_agent !== undefined ? assigned_agent : existing.assigned_agent,
      source !== undefined ? source : existing.source,
      notes !== undefined ? notes : existing.notes,
      expected_close !== undefined ? expected_close : existing.expected_close,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT l.*, c.name as contact_name, c.email as contact_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.id = ?
    `).get(req.params.id);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /leads/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id/stage — Quick stage change ──
router.put('/:id/stage', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const { stage } = req.body;
    if (!stage) {
      return res.status(400).json({ success: false, error: 'Stage is required' });
    }

    const validStages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
      });
    }

    db.prepare(`
      UPDATE leads SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(stage, req.params.id);

    const updated = db.prepare(`
      SELECT l.*, c.name as contact_name, c.email as contact_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.id = ?
    `).get(req.params.id);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /leads/:id/stage error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /:id — Delete a lead ──
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Lead deleted', id: parseInt(req.params.id) } });
  } catch (error) {
    console.error('DELETE /leads/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
