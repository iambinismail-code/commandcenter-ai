// Deals API Routes — Full CRUD + Summary
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /summary — Revenue summary ──
router.get('/summary', (req, res) => {
  try {
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_deals,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN stage = 'completed' OR stage = 'paid' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN stage = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COUNT(CASE WHEN stage = 'completed' OR stage = 'paid' THEN 1 END) as completed_count,
        COUNT(CASE WHEN stage = 'pending' THEN 1 END) as pending_count
      FROM deals
    `).get();

    const byStage = db.prepare(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM deals
      GROUP BY stage
      ORDER BY total DESC
    `).all();

    res.json({
      success: true,
      data: { ...totals, byStage },
    });
  } catch (error) {
    console.error('GET /deals/summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET / — List deals with filters and pagination ──
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, stage } = req.query;

    let where = [];
    let params = [];

    if (search) {
      where.push(`(d.title LIKE ? OR c.name LIKE ? OR d.invoice_number LIKE ?)`);
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (stage) {
      where.push(`d.stage = ?`);
      params.push(stage);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      ${whereClause}
    `).get(...params).count;

    const deals = db.prepare(`
      SELECT d.*,
        c.name as contact_name, c.email as contact_email,
        l.title as lead_title
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      success: true,
      data: deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /deals error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id — Single deal ──
router.get('/:id', (req, res) => {
  try {
    const deal = db.prepare(`
      SELECT d.*,
        c.name as contact_name, c.email as contact_email, c.company as contact_company,
        l.title as lead_title, l.stage as lead_stage
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    console.error('GET /deals/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST / — Create a deal ──
router.post('/', (req, res) => {
  try {
    const { lead_id, contact_id, title, amount, currency, stage, invoice_number, due_date, paid_at, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Verify foreign keys if provided
    if (contact_id) {
      const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contact_id);
      if (!contact) {
        return res.status(400).json({ success: false, error: 'Contact not found' });
      }
    }
    if (lead_id) {
      const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(lead_id);
      if (!lead) {
        return res.status(400).json({ success: false, error: 'Lead not found' });
      }
    }

    const result = db.prepare(`
      INSERT INTO deals (lead_id, contact_id, title, amount, currency, stage, invoice_number, due_date, paid_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead_id || null,
      contact_id || null,
      title.trim(),
      amount || 0,
      currency || 'BDT',
      stage || 'pending',
      invoice_number || null,
      due_date || null,
      paid_at || null,
      notes || null
    );

    const deal = db.prepare(`
      SELECT d.*, c.name as contact_name, l.title as lead_title
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    console.error('POST /deals error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id — Update a deal ──
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const { lead_id, contact_id, title, amount, currency, stage, invoice_number, due_date, paid_at, notes } = req.body;

    db.prepare(`
      UPDATE deals SET
        lead_id = ?, contact_id = ?, title = ?, amount = ?, currency = ?,
        stage = ?, invoice_number = ?, due_date = ?, paid_at = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      lead_id !== undefined ? lead_id : existing.lead_id,
      contact_id !== undefined ? contact_id : existing.contact_id,
      (title && title.trim()) || existing.title,
      amount !== undefined ? amount : existing.amount,
      currency || existing.currency,
      stage || existing.stage,
      invoice_number !== undefined ? invoice_number : existing.invoice_number,
      due_date !== undefined ? due_date : existing.due_date,
      paid_at !== undefined ? paid_at : existing.paid_at,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT d.*, c.name as contact_name, l.title as lead_title
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      WHERE d.id = ?
    `).get(req.params.id);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /deals/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /:id — Delete a deal ──
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM deals WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Deal deleted', id: parseInt(req.params.id) } });
  } catch (error) {
    console.error('DELETE /deals/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
