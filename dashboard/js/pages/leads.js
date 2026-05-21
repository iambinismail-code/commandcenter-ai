// Lead Pipeline Page — Kanban Board
(function () {
  'use strict';
  const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const STAGE_COLORS = { new: '#667eea', contacted: '#00d2ff', qualified: '#7c3aed', proposal: '#f59e0b', negotiation: '#f97316', won: '#10b981', lost: '#ef4444' };

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header">
          <h2>Lead Pipeline</h2>
          <button class="btn btn-primary" id="add-lead-btn">+ Add Lead</button>
        </div>
        <div class="kanban-board" id="kanban-board"></div>
      </div>`;
    document.getElementById('add-lead-btn').addEventListener('click', showAddModal);
    loadPipeline();
  }

  async function loadPipeline() {
    const board = document.getElementById('kanban-board');
    try {
      const res = await window.API.get('/api/leads/pipeline');
      const pipeline = res.success ? (res.data?.stages || res.data || []) : [];

      // Also fetch all leads for card details
      const leadsRes = await window.API.get('/api/leads?limit=100');
      const allLeads = leadsRes.success ? (leadsRes.data || []) : [];

      board.innerHTML = STAGES.map(stage => {
        const stageData = pipeline.find(s => s.stage === stage) || { stage, count: 0, total_value: 0 };
        const leads = allLeads.filter(l => l.stage === stage);
        return `
          <div class="kanban-column">
            <div class="kanban-header" style="border-top: 3px solid ${STAGE_COLORS[stage]}">
              <span class="kanban-title">${stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
              <span class="badge">${stageData.count || leads.length}</span>
            </div>
            <div class="kanban-cards">
              ${leads.length ? leads.map(l => `
                <div class="kanban-card glass-card" onclick="LeadsPage.viewLead(${l.id})">
                  <div class="kanban-card-title">${esc(l.title)}</div>
                  ${l.contact_name ? `<div class="text-muted text-sm">👤 ${esc(l.contact_name)}</div>` : ''}
                  <div class="kanban-card-footer">
                    <span class="badge badge-${l.priority === 'high' || l.priority === 'urgent' ? 'danger' : l.priority === 'medium' ? 'warning' : 'default'}">${l.priority || 'medium'}</span>
                    ${l.value ? `<span class="text-sm" style="color: var(--success)">৳${Number(l.value).toLocaleString()}</span>` : ''}
                  </div>
                </div>`).join('') : '<div class="text-muted text-sm" style="padding:1rem;text-align:center">No leads</div>'}
            </div>
          </div>`;
      }).join('');
    } catch (e) { board.innerHTML = '<p class="text-muted">Error loading pipeline</p>'; }
  }

  async function viewLead(id) {
    try {
      const res = await window.API.get(`/api/leads/${id}`);
      if (!res.success) return;
      const l = res.data;
      window.Modal.show(`Lead: ${l.title}`, `
        <div class="lead-detail">
          <p><strong>Stage:</strong> <span class="badge" style="background:${STAGE_COLORS[l.stage]}">${l.stage}</span></p>
          <p><strong>Priority:</strong> ${l.priority}</p>
          <p><strong>Value:</strong> ৳${Number(l.value || 0).toLocaleString()}</p>
          ${l.notes ? `<p><strong>Notes:</strong> ${esc(l.notes)}</p>` : ''}
          <p><strong>Created:</strong> ${new Date(l.created_at).toLocaleDateString()}</p>
          <hr style="border-color:rgba(255,255,255,0.1);margin:1rem 0">
          <label style="color:var(--text-muted);font-size:0.85rem">Move to Stage:</label>
          <div class="stage-buttons" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            ${STAGES.filter(s => s !== l.stage).map(s =>
              `<button class="btn btn-sm" style="border-color:${STAGE_COLORS[s]};color:${STAGE_COLORS[s]}" onclick="LeadsPage.moveStage(${l.id},'${s}')">${s}</button>`
            ).join('')}
          </div>
        </div>
      `, [{ label: 'Close', class: 'btn', onclick: () => window.Modal.close() }]);
    } catch (e) { window.Toast.show('Error loading lead', 'error'); }
  }

  async function moveStage(id, newStage) {
    try {
      const res = await window.API.put(`/api/leads/${id}/stage`, { stage: newStage });
      if (res.success) { window.Modal.close(); window.Toast.show(`Lead moved to ${newStage}`, 'success'); loadPipeline(); }
      else { window.Toast.show(res.error || 'Failed', 'error'); }
    } catch (e) { window.Toast.show('Error moving lead', 'error'); }
  }

  function showAddModal() {
    window.Modal.show('Add Lead', `
      <form id="add-lead-form">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input" name="title" required></div>
        <div class="form-group"><label>Value (৳)</label><input type="number" class="form-input" name="value" value="0"></div>
        <div class="form-group"><label>Priority</label>
          <select class="form-select" name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        </div>
        <div class="form-group"><label>Notes</label><textarea class="form-input" name="notes" rows="3"></textarea></div>
      </form>
    `, [
      { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
      { label: 'Add Lead', class: 'btn btn-primary', onclick: async () => {
        const form = document.getElementById('add-lead-form');
        const data = Object.fromEntries(new FormData(form));
        if (!data.title) { window.Toast.show('Title is required', 'error'); return; }
        try {
          const res = await window.API.post('/api/leads', data);
          if (res.success) { window.Modal.close(); window.Toast.show('Lead added!', 'success'); loadPipeline(); }
          else { window.Toast.show(res.error || 'Failed', 'error'); }
        } catch (e) { window.Toast.show('Error adding lead', 'error'); }
      }},
    ]);
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.LeadsPage = { render, viewLead, moveStage };
})();
