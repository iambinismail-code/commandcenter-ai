// Deals Management Page
(function () {
  'use strict';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header">
          <h2>Deals</h2>
          <button class="btn btn-primary" id="add-deal-btn">+ Add Deal</button>
        </div>
        <div class="stats-grid" id="deal-summary"></div>
        <div class="glass-card table-container">
          <table class="data-table">
            <thead><tr><th>Title</th><th>Contact</th><th>Amount</th><th>Stage</th><th>Due Date</th><th>Actions</th></tr></thead>
            <tbody id="deals-tbody"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>`;
    document.getElementById('add-deal-btn').addEventListener('click', showAddModal);
    loadDeals();
  }

  async function loadDeals() {
    try {
      // Summary
      const sumRes = await window.API.get('/api/deals/summary');
      if (sumRes.success) {
        const s = sumRes.data;
        document.getElementById('deal-summary').innerHTML = `
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Total Revenue</span><span class="stat-value" style="color:var(--success)">৳${(s.totalRevenue||0).toLocaleString()}</span></div></div>
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Pending</span><span class="stat-value" style="color:var(--warning)">${s.pendingCount||0}</span></div></div>
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Completed</span><span class="stat-value" style="color:var(--success)">${s.completedCount||0}</span></div></div>
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Cancelled</span><span class="stat-value" style="color:var(--error)">${s.cancelledCount||0}</span></div></div>`;
      }

      // Table
      const res = await window.API.get('/api/deals?limit=50');
      const deals = res.success ? (res.data || []) : [];
      const tbody = document.getElementById('deals-tbody');
      const stageColors = { pending: 'warning', in_progress: 'primary', completed: 'success', cancelled: 'danger' };
      tbody.innerHTML = deals.length ? deals.map(d => `
        <tr class="table-row-hover">
          <td><strong>${esc(d.title)}</strong></td>
          <td>${esc(d.contact_name || '—')}</td>
          <td style="color:var(--success);font-weight:600">৳${Number(d.amount||0).toLocaleString()}</td>
          <td><span class="badge badge-${stageColors[d.stage]||'default'}">${d.stage}</span></td>
          <td>${d.due_date ? new Date(d.due_date).toLocaleDateString() : '—'}</td>
          <td><button class="btn btn-sm btn-danger" onclick="DealsPage.del(${d.id})">🗑</button></td>
        </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">No deals yet</td></tr>';
    } catch (e) {}
  }

  function showAddModal() {
    window.Modal.show('Add Deal', `
      <form id="add-deal-form">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input" name="title" required></div>
        <div class="form-group"><label>Amount (৳) *</label><input type="number" class="form-input" name="amount" required></div>
        <div class="form-group"><label>Stage</label>
          <select class="form-select" name="stage"><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select>
        </div>
        <div class="form-group"><label>Due Date</label><input type="date" class="form-input" name="due_date"></div>
        <div class="form-group"><label>Notes</label><textarea class="form-input" name="notes" rows="2"></textarea></div>
      </form>
    `, [
      { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
      { label: 'Add Deal', class: 'btn btn-primary', onclick: async () => {
        const data = Object.fromEntries(new FormData(document.getElementById('add-deal-form')));
        if (!data.title || !data.amount) { window.Toast.show('Title and amount required', 'error'); return; }
        try { const r = await window.API.post('/api/deals', data); if (r.success) { window.Modal.close(); window.Toast.show('Deal added!','success'); loadDeals(); } else { window.Toast.show(r.error,'error'); } } catch(e) { window.Toast.show('Error','error'); }
      }},
    ]);
  }

  async function del(id) {
    if (!confirm('Delete this deal?')) return;
    try { const r = await window.API.del(`/api/deals/${id}`); if (r.success) { window.Toast.show('Deleted','success'); loadDeals(); } } catch(e) {}
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.DealsPage = { render, del };
})();
