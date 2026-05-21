// Settings API Routes — CRUD + Bulk Upsert
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET / — All settings grouped by category ──
router.get('/', (req, res) => {
  try {
    const settings = db.prepare(
      'SELECT * FROM settings ORDER BY category ASC, key ASC'
    ).all();

    // Group by category
    const grouped = {};
    settings.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];

      // Try to parse JSON values
      let parsedValue = s.value;
      try {
        parsedValue = JSON.parse(s.value);
      } catch {
        // Keep as string
      }

      grouped[s.category].push({
        key: s.key,
        value: parsedValue,
        updated_at: s.updated_at,
      });
    });

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('GET /settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:key — Single setting by key ──
router.get('/:key', (req, res) => {
  try {
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    // Try to parse JSON value
    let parsedValue = setting.value;
    try {
      parsedValue = JSON.parse(setting.value);
    } catch {
      // Keep as string
    }

    res.json({
      success: true,
      data: {
        key: setting.key,
        value: parsedValue,
        category: setting.category,
        updated_at: setting.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /settings/:key error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:key — Upsert a single setting ──
router.put('/:key', (req, res) => {
  try {
    const { value, category } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Serialize objects/arrays to JSON
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    db.prepare(`
      INSERT INTO settings (key, value, category, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = COALESCE(excluded.category, settings.category),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.params.key,
      serializedValue,
      category || 'general'
    );

    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

    let parsedValue = setting.value;
    try {
      parsedValue = JSON.parse(setting.value);
    } catch {
      // Keep as string
    }

    res.json({
      success: true,
      data: {
        key: setting.key,
        value: parsedValue,
        category: setting.category,
        updated_at: setting.updated_at,
      },
    });
  } catch (error) {
    console.error('PUT /settings/:key error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /bulk — Bulk upsert settings ──
router.post('/bulk', (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Settings must be a non-empty array of { key, value, category? } objects',
      });
    }

    // Validate each item
    for (const item of settings) {
      if (!item.key || item.value === undefined || item.value === null) {
        return res.status(400).json({
          success: false,
          error: `Each setting must have a "key" and "value". Invalid item: ${JSON.stringify(item)}`,
        });
      }
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, category, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = COALESCE(excluded.category, settings.category),
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertMany = db.transaction((items) => {
      const results = [];
      for (const item of items) {
        const serializedValue = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
        upsert.run(item.key, serializedValue, item.category || 'general');
        results.push(item.key);
      }
      return results;
    });

    const updatedKeys = upsertMany(settings);

    // Fetch all updated settings
    const placeholders = updatedKeys.map(() => '?').join(', ');
    const updated = db.prepare(
      `SELECT * FROM settings WHERE key IN (${placeholders}) ORDER BY category ASC, key ASC`
    ).all(...updatedKeys);

    const data = updated.map(s => {
      let parsedValue = s.value;
      try {
        parsedValue = JSON.parse(s.value);
      } catch {
        // Keep as string
      }
      return {
        key: s.key,
        value: parsedValue,
        category: s.category,
        updated_at: s.updated_at,
      };
    });

    res.json({
      success: true,
      data,
      message: `${updatedKeys.length} setting(s) saved`,
    });
  } catch (error) {
    console.error('POST /settings/bulk error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
