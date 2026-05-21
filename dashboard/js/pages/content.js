// Content Management Page
(function () {
  'use strict';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header">
          <h2>Content Manager</h2>
          <div class="page-header-actions">
            <button class="btn btn-secondary" id="ai-generate-btn">🤖 AI Generate</button>
            <button class="btn btn-primary" id="add-content-btn">+ New Content</button>
          </div>
        </div>
        <div class="filters-bar glass-card">
          <select class="form-select" id="content-status-filter"><option value="">All Status</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select>
          <select class="form-select" id="content-type-filter"><option value="">All Types</option><option value="post">Post</option><option value="article">Article</option><option value="caption">Caption</option><option value="ad">Ad</option></select>
        </div>
        <div class="glass-card table-container">
          <table class="data-table"><thead><tr><th>Title</th><th>Type</th><th>Platform</th><th>Status</th><th>Scheduled</th><th>Actions</th></tr></thead>
            <tbody id="content-tbody"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>`;
    document.getElementById('add-content-btn').addEventListener('click', showAddModal);
    document.getElementById('ai-generate-btn').addEventListener('click', showAIModal);
    document.getElementById('content-status-filter').addEventListener('change', loadContent);
    document.getElementById('content-type-filter').addEventListener('change', loadContent);
    loadContent();
  }

  async function loadContent() {
    try {
      const status = document.getElementById('content-status-filter')?.value || '';
      const type = document.getElementById('content-type-filter')?.value || '';
      let url = '/api/content?limit=50';
      if (status) url += `&status=${status}`;
      if (type) url += `&type=${type}`;
      const res = await window.API.get(url);
      const items = res.success ? (res.data || []) : [];
      const tbody = document.getElementById('content-tbody');
      const statusColors = { draft: 'default', scheduled: 'warning', published: 'success', failed: 'danger' };
      tbody.innerHTML = items.length ? items.map(c => `
        <tr class="table-row-hover">
          <td><strong>${esc(c.title)}</strong>${c.body ? `<div class="text-muted text-sm" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.body.substring(0,80))}</div>` : ''}</td>
          <td><span class="badge">${c.type}</span></td>
          <td>${c.platform}</td>
          <td><span class="badge badge-${statusColors[c.status]||'default'}">${c.status}</span></td>
          <td>${c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : '—'}</td>
          <td class="actions-cell">
            ${c.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="ContentPage.publish(${c.id})">Publish</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="ContentPage.del(${c.id})">🗑</button>
          </td>
        </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">No content yet. Create one or use AI Generate!</td></tr>';
    } catch (e) {}
  }

  function showAddModal() {
    window.Modal.show('New Content', `
      <form id="add-content-form">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input" name="title" required></div>
        <div class="form-group"><label>Body</label><textarea class="form-input" name="body" rows="5" placeholder="Write your content here..."></textarea></div>
        <div class="form-group"><label>Type</label><select class="form-select" name="type"><option value="post">Post</option><option value="article">Article</option><option value="caption">Caption</option><option value="ad">Ad</option></select></div>
        <div class="form-group"><label>Platform</label><select class="form-select" name="platform"><option value="facebook">Facebook</option><option value="all">All</option></select></div>
      </form>
    `, [
      { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
      { label: 'Save Draft', class: 'btn btn-primary', onclick: async () => {
        const data = Object.fromEntries(new FormData(document.getElementById('add-content-form')));
        if (!data.title) { window.Toast.show('Title required', 'error'); return; }
        try { const r = await window.API.post('/api/content', { ...data, status: 'draft' }); if (r.success) { window.Modal.close(); window.Toast.show('Content saved!', 'success'); loadContent(); } } catch(e) { window.Toast.show('Error', 'error'); }
      }},
    ]);
  }

  function showAIModal() {
    window.Modal.show('🤖 AI Content Generator', `
      <form id="ai-content-form">
        <div class="form-group"><label>Topic / Prompt *</label><textarea class="form-input" name="question" rows="3" placeholder="E.g., Write a Facebook post about our new product launch..."></textarea></div>
      </form>
      <div id="ai-result" style="display:none" class="glass-card" style="margin-top:1rem;padding:1rem"><pre id="ai-result-text" style="white-space:pre-wrap;color:var(--text)"></pre></div>
    `, [
      { label: 'Close', class: 'btn', onclick: () => window.Modal.close() },
      { label: '✨ Generate', class: 'btn btn-primary', onclick: async () => {
        const q = document.querySelector('#ai-content-form [name="question"]')?.value;
        if (!q) { window.Toast.show('Enter a topic', 'error'); return; }
        window.Toast.show('Generating content...', 'info');
        try {
          const r = await window.API.post('/api/agents/ask', { question: `Create a social media post about: ${q}` });
          const resultDiv = document.getElementById('ai-result');
          const resultText = document.getElementById('ai-result-text');
          if (resultDiv && resultText) { resultDiv.style.display = 'block'; resultText.textContent = r.data?.response || r.data?.output_summary || 'Content generated! Check the content list.'; }
          window.Toast.show('Content generated!', 'success');
        } catch(e) { window.Toast.show('AI generation failed', 'error'); }
      }},
    ]);
  }

  async function publish(id) {
    try { const r = await window.API.post(`/api/content/${id}/publish`); if (r.success) { window.Toast.show('Published!', 'success'); loadContent(); } else { window.Toast.show(r.error || 'Failed', 'error'); } } catch(e) { window.Toast.show('Error', 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete this content?')) return;
    try { const r = await window.API.del(`/api/content/${id}`); if (r.success) { window.Toast.show('Deleted', 'success'); loadContent(); } } catch(e) {}
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.ContentPage = { render, publish, del };
})();
