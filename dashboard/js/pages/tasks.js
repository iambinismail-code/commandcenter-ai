// Task Board Page — Kanban style
(function () {
  'use strict';
  const STATUSES = ['todo', 'in_progress', 'review', 'done'];
  const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  const STATUS_COLORS = { todo: '#667eea', in_progress: '#00d2ff', review: '#f59e0b', done: '#10b981' };
  const PRIORITY_COLORS = { low: 'default', medium: 'warning', high: 'danger', urgent: 'danger' };

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header">
          <h2>Task Board</h2>
          <button class="btn btn-primary" id="add-task-btn">+ Add Task</button>
        </div>
        <div class="kanban-board" id="task-board"></div>
      </div>`;
    document.getElementById('add-task-btn').addEventListener('click', showAddModal);
    loadBoard();
  }

  async function loadBoard() {
    const board = document.getElementById('task-board');
    try {
      const res = await window.API.get('/api/tasks/board');
      const boardData = res.success ? (res.data || {}) : {};

      board.innerHTML = STATUSES.map(status => {
        const tasks = boardData[status] || [];
        return `
          <div class="kanban-column">
            <div class="kanban-header" style="border-top:3px solid ${STATUS_COLORS[status]}">
              <span class="kanban-title">${STATUS_LABELS[status]}</span>
              <span class="badge">${tasks.length}</span>
            </div>
            <div class="kanban-cards">
              ${tasks.length ? tasks.map(t => `
                <div class="kanban-card glass-card">
                  <div class="kanban-card-title">${esc(t.title)}</div>
                  ${t.description ? `<div class="text-muted text-sm">${esc(t.description.substring(0,60))}</div>` : ''}
                  <div class="kanban-card-footer">
                    <span class="badge badge-${PRIORITY_COLORS[t.priority]||'default'}">${t.priority}</span>
                    ${t.due_date ? `<span class="text-sm text-muted">📅 ${new Date(t.due_date).toLocaleDateString()}</span>` : ''}
                  </div>
                  <div style="display:flex;gap:0.25rem;margin-top:0.5rem;flex-wrap:wrap">
                    ${STATUSES.filter(s => s !== status).map(s => `<button class="btn btn-sm" style="font-size:0.7rem;padding:0.2rem 0.5rem" onclick="TasksPage.move(${t.id},'${s}')">${STATUS_LABELS[s]}</button>`).join('')}
                    <button class="btn btn-sm btn-danger" style="font-size:0.7rem;padding:0.2rem 0.5rem;margin-left:auto" onclick="TasksPage.del(${t.id})">🗑</button>
                  </div>
                </div>`).join('') : '<div class="text-muted text-sm" style="padding:1rem;text-align:center">No tasks</div>'}
            </div>
          </div>`;
      }).join('');
    } catch (e) { board.innerHTML = '<p class="text-muted">Error loading tasks</p>'; }
  }

  async function moveTask(id, newStatus) {
    try {
      const res = await window.API.put(`/api/tasks/${id}/status`, { status: newStatus });
      if (res.success) { window.Toast.show(`Task moved to ${STATUS_LABELS[newStatus]}`, 'success'); loadBoard(); }
    } catch(e) { window.Toast.show('Error', 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete this task?')) return;
    try { const r = await window.API.del(`/api/tasks/${id}`); if (r.success) { window.Toast.show('Deleted', 'success'); loadBoard(); } } catch(e) {}
  }

  function showAddModal() {
    window.Modal.show('Add Task', `
      <form id="add-task-form">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input" name="title" required></div>
        <div class="form-group"><label>Description</label><textarea class="form-input" name="description" rows="3"></textarea></div>
        <div class="form-group"><label>Priority</label><select class="form-select" name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
        <div class="form-group"><label>Category</label><select class="form-select" name="category"><option value="general">General</option><option value="crm">CRM</option><option value="social">Social</option><option value="content">Content</option><option value="support">Support</option></select></div>
        <div class="form-group"><label>Due Date</label><input type="date" class="form-input" name="due_date"></div>
      </form>
    `, [
      { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
      { label: 'Add Task', class: 'btn btn-primary', onclick: async () => {
        const data = Object.fromEntries(new FormData(document.getElementById('add-task-form')));
        if (!data.title) { window.Toast.show('Title required', 'error'); return; }
        try { const r = await window.API.post('/api/tasks', data); if (r.success) { window.Modal.close(); window.Toast.show('Task added!', 'success'); loadBoard(); } } catch(e) { window.Toast.show('Error', 'error'); }
      }},
    ]);
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.TasksPage = { render, move: moveTask, del };
})();
