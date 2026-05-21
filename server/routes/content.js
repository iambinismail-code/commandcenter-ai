// Content API Routes — Full CRUD + Calendar + Publish
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /calendar — Content grouped by date for calendar view ──
router.get('/calendar', (req, res) => {
  try {
    const { month, year } = req.query;
    // Default to current month/year
    const now = new Date();
    const targetYear = parseInt(year) || now.getFullYear();
    const targetMonth = parseInt(month) || (now.getMonth() + 1);

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const endYear = targetMonth === 12 ? targetYear + 1 : targetYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const items = db.prepare(`
      SELECT id, title, type, platform, status, scheduled_at, published_at, created_at
      FROM content
      WHERE
        (scheduled_at >= ? AND scheduled_at < ?)
        OR (published_at >= ? AND published_at < ?)
        OR (scheduled_at IS NULL AND published_at IS NULL AND created_at >= ? AND created_at < ?)
      ORDER BY COALESCE(scheduled_at, published_at, created_at) ASC
    `).all(startDate, endDate, startDate, endDate, startDate, endDate);

    // Group by date
    const calendar = {};
    items.forEach(item => {
      const date = (item.scheduled_at || item.published_at || item.created_at || '').substring(0, 10);
      if (!calendar[date]) calendar[date] = [];
      calendar[date].push(item);
    });

    res.json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        calendar,
        totalItems: items.length,
      },
    });
  } catch (error) {
    console.error('GET /content/calendar error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET / — List content with filters and pagination ──
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, status, type, platform } = req.query;

    let where = [];
    let params = [];

    if (search) {
      where.push(`(title LIKE ? OR body LIKE ?)`);
      const q = `%${search}%`;
      params.push(q, q);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(status);
    }
    if (type) {
      where.push(`type = ?`);
      params.push(type);
    }
    if (platform) {
      where.push(`platform = ?`);
      params.push(platform);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM content ${whereClause}`).get(...params).count;

    const content = db.prepare(`
      SELECT * FROM content ${whereClause}
      ORDER BY COALESCE(scheduled_at, created_at) DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const data = content.map(c => ({
      ...c,
      media_urls: JSON.parse(c.media_urls || '[]'),
      engagement_data: JSON.parse(c.engagement_data || '{}'),
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
    console.error('GET /content error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id — Single content item ──
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    item.media_urls = JSON.parse(item.media_urls || '[]');
    item.engagement_data = JSON.parse(item.engagement_data || '{}');

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('GET /content/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST / — Create content ──
router.post('/', (req, res) => {
  try {
    const { title, body, type, platform, status, media_urls, scheduled_at, created_by, agent_name } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO content (title, body, type, platform, status, media_urls, scheduled_at, created_by, agent_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      body || null,
      type || 'post',
      platform || 'facebook',
      status || 'draft',
      JSON.stringify(media_urls || []),
      scheduled_at || null,
      created_by || 'user',
      agent_name || null
    );

    const item = db.prepare('SELECT * FROM content WHERE id = ?').get(result.lastInsertRowid);
    item.media_urls = JSON.parse(item.media_urls || '[]');
    item.engagement_data = JSON.parse(item.engagement_data || '{}');

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('POST /content error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id — Update content ──
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    const { title, body, type, platform, status, media_urls, scheduled_at, engagement_data, created_by, agent_name } = req.body;

    db.prepare(`
      UPDATE content SET
        title = ?, body = ?, type = ?, platform = ?, status = ?,
        media_urls = ?, scheduled_at = ?, engagement_data = ?,
        created_by = ?, agent_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      (title && title.trim()) || existing.title,
      body !== undefined ? body : existing.body,
      type || existing.type,
      platform || existing.platform,
      status || existing.status,
      media_urls ? JSON.stringify(media_urls) : existing.media_urls,
      scheduled_at !== undefined ? scheduled_at : existing.scheduled_at,
      engagement_data ? JSON.stringify(engagement_data) : existing.engagement_data,
      created_by || existing.created_by,
      agent_name !== undefined ? agent_name : existing.agent_name,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
    updated.media_urls = JSON.parse(updated.media_urls || '[]');
    updated.engagement_data = JSON.parse(updated.engagement_data || '{}');

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /content/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /:id/publish — Trigger publish (mark as published) ──
router.post('/:id/publish', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    if (existing.status === 'published') {
      return res.status(400).json({ success: false, error: 'Content is already published' });
    }

    const publishedAt = new Date().toISOString();
    const fbPostId = req.body.fb_post_id || null;

    db.prepare(`
      UPDATE content SET
        status = 'published',
        published_at = ?,
        fb_post_id = COALESCE(?, fb_post_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(publishedAt, fbPostId, req.params.id);

    const updated = db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id);
    updated.media_urls = JSON.parse(updated.media_urls || '[]');
    updated.engagement_data = JSON.parse(updated.engagement_data || '{}');

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('POST /content/:id/publish error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /:id — Delete content ──
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM content WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Content deleted', id: parseInt(req.params.id) } });
  } catch (error) {
    console.error('DELETE /content/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
