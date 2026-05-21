// Contacts API Routes — Full CRUD
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET / — List contacts with search, filter, pagination ──
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, status, source } = req.query;

    let where = [];
    let params = [];

    if (search) {
      where.push(`(name LIKE ? OR email LIKE ? OR company LIKE ? OR phone LIKE ?)`);
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(status);
    }
    if (source) {
      where.push(`source = ?`);
      params.push(source);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM contacts ${whereClause}`).get(...params).count;
    const contacts = db.prepare(
      `SELECT * FROM contacts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    // Parse JSON fields
    const data = contacts.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
    }));

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
    console.error('GET /contacts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id — Single contact with related leads & deals ──
router.get('/:id', (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    contact.tags = JSON.parse(contact.tags || '[]');

    const leads = db.prepare(
      'SELECT * FROM leads WHERE contact_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);

    const deals = db.prepare(
      'SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);

    res.json({
      success: true,
      data: { ...contact, leads, deals },
    });
  } catch (error) {
    console.error('GET /contacts/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id/timeline — Activity timeline for a contact ──
router.get('/:id/timeline', (req, res) => {
  try {
    const contact = db.prepare('SELECT id, name FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const timeline = [];

    // Leads created
    const leads = db.prepare(
      'SELECT id, title, stage, value, created_at FROM leads WHERE contact_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);
    leads.forEach(l => {
      timeline.push({
        type: 'lead',
        action: 'Lead created',
        title: l.title,
        detail: `Stage: ${l.stage}, Value: ${l.value}`,
        ref_id: l.id,
        timestamp: l.created_at,
      });
    });

    // Deals created
    const deals = db.prepare(
      'SELECT id, title, amount, stage, created_at FROM deals WHERE contact_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);
    deals.forEach(d => {
      timeline.push({
        type: 'deal',
        action: 'Deal created',
        title: d.title,
        detail: `Amount: ${d.amount}, Stage: ${d.stage}`,
        ref_id: d.id,
        timestamp: d.created_at,
      });
    });

    // Sort everything by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error('GET /contacts/:id/timeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST / — Create a contact ──
router.post('/', (req, res) => {
  try {
    const { name, email, phone, company, source, status, tags, notes, avatar_url } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO contacts (name, email, phone, company, source, status, tags, notes, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      email || null,
      phone || null,
      company || null,
      source || 'manual',
      status || 'active',
      JSON.stringify(tags || []),
      notes || null,
      avatar_url || null
    );

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    contact.tags = JSON.parse(contact.tags || '[]');

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    console.error('POST /contacts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id — Update a contact ──
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const { name, email, phone, company, source, status, tags, notes, avatar_url } = req.body;

    db.prepare(`
      UPDATE contacts SET
        name = ?, email = ?, phone = ?, company = ?, source = ?,
        status = ?, tags = ?, notes = ?, avatar_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      (name && name.trim()) || existing.name,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      company !== undefined ? company : existing.company,
      source || existing.source,
      status || existing.status,
      tags ? JSON.stringify(tags) : existing.tags,
      notes !== undefined ? notes : existing.notes,
      avatar_url !== undefined ? avatar_url : existing.avatar_url,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    updated.tags = JSON.parse(updated.tags || '[]');

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /contacts/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /:id — Delete a contact ──
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Contact deleted', id: parseInt(req.params.id) } });
  } catch (error) {
    console.error('DELETE /contacts/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
