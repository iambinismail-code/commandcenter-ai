// Social Media Hub Page
(function () {
  'use strict';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header"><h2>Social Media Hub</h2></div>

        <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin-bottom:1rem">📝 Quick Post to Facebook</h3>
          <textarea class="form-input" id="quick-post-text" rows="3" placeholder="What's on your mind? Write a post for your Facebook page..."></textarea>
          <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
            <button class="btn btn-primary" id="publish-post-btn">📤 Publish Now</button>
            <button class="btn btn-secondary" id="save-draft-btn">💾 Save Draft</button>
          </div>
        </div>

        <div class="stats-grid" style="margin-bottom:1.5rem">
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Published Posts</span><span class="stat-value" id="published-count">0</span></div></div>
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Scheduled</span><span class="stat-value" id="scheduled-count">0</span></div></div>
          <div class="stat-card glass-card"><div class="stat-info"><span class="stat-label">Drafts</span><span class="stat-value" id="draft-count">0</span></div></div>
        </div>

        <div class="glass-card">
          <h3 style="padding:1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.05)">Recent Posts</h3>
          <div id="social-posts-list" style="padding:1rem"></div>
        </div>
      </div>`;

    document.getElementById('publish-post-btn').addEventListener('click', publishQuickPost);
    document.getElementById('save-draft-btn').addEventListener('click', saveDraft);
    loadSocialData();
  }

  async function loadSocialData() {
    try {
      const res = await window.API.get('/api/content?platform=facebook&limit=20');
      const items = res.success ? (res.data || []) : [];

      const published = items.filter(i => i.status === 'published').length;
      const scheduled = items.filter(i => i.status === 'scheduled').length;
      const drafts = items.filter(i => i.status === 'draft').length;

      document.getElementById('published-count').textContent = published;
      document.getElementById('scheduled-count').textContent = scheduled;
      document.getElementById('draft-count').textContent = drafts;

      const list = document.getElementById('social-posts-list');
      list.innerHTML = items.length ? items.map(p => `
        <div class="activity-item" style="padding:1rem;border-bottom:1px solid rgba(255,255,255,0.03)">
          <div style="flex:1">
            <strong>${esc(p.title)}</strong>
            ${p.body ? `<p class="text-muted text-sm" style="margin-top:0.25rem">${esc(p.body.substring(0, 120))}${p.body.length > 120 ? '...' : ''}</p>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="badge badge-${p.status === 'published' ? 'success' : p.status === 'scheduled' ? 'warning' : 'default'}">${p.status}</span>
            <span class="text-muted text-sm">${p.published_at ? new Date(p.published_at).toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
          </div>
        </div>`).join('') : '<p class="text-muted text-center">No posts yet. Write your first post above!</p>';
    } catch (e) {}
  }

  async function publishQuickPost() {
    const text = document.getElementById('quick-post-text').value.trim();
    if (!text) { window.Toast.show('Write something first!', 'error'); return; }
    try {
      const res = await window.API.post('/api/content', { title: text.substring(0, 50), body: text, type: 'post', platform: 'facebook', status: 'published', published_at: new Date().toISOString() });
      if (res.success) { document.getElementById('quick-post-text').value = ''; window.Toast.show('Published!', 'success'); loadSocialData(); }
    } catch(e) { window.Toast.show('Publish failed', 'error'); }
  }

  async function saveDraft() {
    const text = document.getElementById('quick-post-text').value.trim();
    if (!text) { window.Toast.show('Write something first!', 'error'); return; }
    try {
      const res = await window.API.post('/api/content', { title: text.substring(0, 50), body: text, type: 'post', platform: 'facebook', status: 'draft' });
      if (res.success) { document.getElementById('quick-post-text').value = ''; window.Toast.show('Saved as draft', 'success'); loadSocialData(); }
    } catch(e) { window.Toast.show('Save failed', 'error'); }
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.SocialPage = { render };
})();
