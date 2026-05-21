// Tasks API Routes — Full CRUD + Board View
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /board — Tasks grouped by status (Kanban board view) ──
router.get('/board', (req, res) => {
  try {
    const statuses = ['todo', 'in_progress', 'review', 'done'];
    const board = {};

    for (const status of statuses) {
      board[status] = db.prepare(`
        SELECT * FROM tasks WHERE status = ? ORDER BY
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          due_date ASC NULLS LAST,
          created_at DESC
      `).all(status).map(t => ({
        ...t,
        tags: JSON.parse(t.tags || '[]'),
      }));
    }

    const counts = {};
    for (const status of statuses) {
      counts[status] = board[status].length;
    }

    res.json({
      success: true,
      data: { board, counts },
    });
  } catch (error) {
    console.error('GET /tasks/board error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET / — List tasks with filters and pagination ──
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { search, status, priority, category, assigned_to } = req.query;

    let where = [];
    let params = [];

    if (search) {
      where.push(`(title LIKE ? OR description LIKE ?)`);
      const q = `%${search}%`;
      params.push(q, q);
    }
    if (status) {
      where.push(`status = ?`);
      params.push(status);
    }
    if (priority) {
      where.push(`priority = ?`);
      params.push(priority);
    }
    if (category) {
      where.push(`category = ?`);
      params.push(category);
    }
    if (assigned_to) {
      where.push(`assigned_to = ?`);
      params.push(assigned_to);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM tasks ${whereClause}`).get(...params).count;

    const tasks = db.prepare(`
      SELECT * FROM tasks ${whereClause}
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        due_date ASC NULLS LAST,
        created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const data = tasks.map(t => ({
      ...t,
      tags: JSON.parse(t.tags || '[]'),
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
    console.error('GET /tasks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /:id — Single task ──
router.get('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    task.tags = JSON.parse(task.tags || '[]');

    // Get subtasks
    const subtasks = db.prepare(
      'SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC'
    ).all(req.params.id).map(t => ({
      ...t,
      tags: JSON.parse(t.tags || '[]'),
    }));

    res.json({ success: true, data: { ...task, subtasks } });
  } catch (error) {
    console.error('GET /tasks/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST / — Create a task ──
router.post('/', (req, res) => {
  try {
    const { title, description, category, priority, status, assigned_to, due_date, parent_task_id, tags } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Verify parent task exists if provided
    if (parent_task_id) {
      const parent = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_task_id);
      if (!parent) {
        return res.status(400).json({ success: false, error: 'Parent task not found' });
      }
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, category, priority, status, assigned_to, due_date, parent_task_id, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description || null,
      category || 'general',
      priority || 'medium',
      status || 'todo',
      assigned_to || 'user',
      due_date || null,
      parent_task_id || null,
      JSON.stringify(tags || [])
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    task.tags = JSON.parse(task.tags || '[]');

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('POST /tasks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id — Update a task ──
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const { title, description, category, priority, status, assigned_to, due_date, completed_at, parent_task_id, tags } = req.body;

    db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, category = ?, priority = ?, status = ?,
        assigned_to = ?, due_date = ?, completed_at = ?, parent_task_id = ?, tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      (title && title.trim()) || existing.title,
      description !== undefined ? description : existing.description,
      category || existing.category,
      priority || existing.priority,
      status || existing.status,
      assigned_to !== undefined ? assigned_to : existing.assigned_to,
      due_date !== undefined ? due_date : existing.due_date,
      completed_at !== undefined ? completed_at : existing.completed_at,
      parent_task_id !== undefined ? parent_task_id : existing.parent_task_id,
      tags ? JSON.stringify(tags) : existing.tags,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    updated.tags = JSON.parse(updated.tags || '[]');

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /tasks/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PUT /:id/status — Quick status change ──
router.put('/:id/status', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const validStatuses = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Auto-set completed_at when marking done
    const completed_at = status === 'done' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE tasks SET status = ?, completed_at = COALESCE(?, completed_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, completed_at, req.params.id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    updated.tags = JSON.parse(updated.tags || '[]');

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /tasks/:id/status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /:id — Delete a task ──
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Task deleted', id: parseInt(req.params.id) } });
  } catch (error) {
    console.error('DELETE /tasks/:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
