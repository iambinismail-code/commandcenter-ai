// Dashboard Overview Page
(function () {
  'use strict';

  function animateCounter(el, target, duration = 1500) {
    let start = 0;
    const step = target / (duration / 16);
    function tick() {
      start += step;
      if (start >= target) { el.textContent = Math.round(target).toLocaleString(); return; }
      el.textContent = Math.round(start).toLocaleString();
      requestAnimationFrame(tick);
    }
    tick();
  }

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="stats-grid">
          <div class="stat-card glass-card" style="--accent: var(--primary)">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea33, #667eea11)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Total Contacts</span>
              <span class="stat-value" id="stat-contacts">0</span>
            </div>
          </div>
          <div class="stat-card glass-card" style="--accent: var(--accent)">
            <div class="stat-icon" style="background: linear-gradient(135deg, #00d2ff33, #00d2ff11)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d2ff" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Active Leads</span>
              <span class="stat-value" id="stat-leads">0</span>
            </div>
          </div>
          <div class="stat-card glass-card" style="--accent: var(--success)">
            <div class="stat-icon" style="background: linear-gradient(135deg, #10b98133, #10b98111)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Revenue</span>
              <span class="stat-value" id="stat-revenue">$0</span>
            </div>
          </div>
          <div class="stat-card glass-card" style="--accent: var(--warning)">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b33, #f59e0b11)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div class="stat-info">
              <span class="stat-label">Pending Tasks</span>
              <span class="stat-value" id="stat-tasks">0</span>
            </div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="glass-card chart-card">
            <h3>Revenue Overview</h3>
            <canvas id="revenue-chart" height="250"></canvas>
          </div>
          <div class="glass-card chart-card">
            <h3>Lead Pipeline</h3>
            <canvas id="pipeline-chart" height="250"></canvas>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="glass-card">
            <h3>🤖 Agent Status</h3>
            <div id="agent-status-list" class="agent-status-list"></div>
          </div>
          <div class="glass-card">
            <h3>📋 Recent Activity</h3>
            <div id="activity-feed" class="activity-feed"></div>
          </div>
        </div>
      </div>`;

    // Fetch data
    try {
      const data = await window.API.get('/api/analytics/overview');
      if (data.success) {
        const d = data.data;
        animateCounter(document.getElementById('stat-contacts'), d.contacts || 0);
        animateCounter(document.getElementById('stat-leads'), d.activeLeads || d.leads || 0);
        const revEl = document.getElementById('stat-revenue');
        if (revEl) { animateCounter(revEl, d.revenue || 0); revEl.textContent = '৳' + (d.revenue || 0).toLocaleString(); }
        animateCounter(document.getElementById('stat-tasks'), d.pendingTasks || d.tasks || 0);
      }
    } catch (e) { console.log('Dashboard data not available yet'); }

    // Revenue chart
    try {
      const revData = await window.API.get('/api/analytics/revenue');
      if (revData.success && revData.data?.length && window.Charts) {
        window.Charts.BarChart(document.getElementById('revenue-chart'), {
          labels: revData.data.map(r => r.month),
          values: revData.data.map(r => r.total),
          color: '#667eea',
        });
      } else if (window.Charts) {
        window.Charts.BarChart(document.getElementById('revenue-chart'), {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          values: [0, 0, 0, 0, 0],
          color: '#667eea',
        });
      }
    } catch (e) {}

    // Pipeline chart
    try {
      const pipeData = await window.API.get('/api/analytics/pipeline');
      if (pipeData.success && pipeData.data?.stages?.length && window.Charts) {
        window.Charts.DoughnutChart(document.getElementById('pipeline-chart'), {
          labels: pipeData.data.stages.map(s => s.stage),
          values: pipeData.data.stages.map(s => s.count),
          colors: ['#667eea', '#00d2ff', '#7c3aed', '#f59e0b', '#f97316', '#10b981', '#ef4444'],
        });
      } else if (window.Charts) {
        window.Charts.DoughnutChart(document.getElementById('pipeline-chart'), {
          labels: ['New', 'Contacted', 'Qualified', 'Won'],
          values: [0, 0, 0, 0],
          colors: ['#667eea', '#00d2ff', '#7c3aed', '#10b981'],
        });
      }
    } catch (e) {}

    // Agent statuses
    try {
      const agentData = await window.API.get('/api/agents');
      const list = document.getElementById('agent-status-list');
      if (agentData.success && list) {
        list.innerHTML = (agentData.data || []).map(a => `
          <div class="agent-status-item">
            <div class="agent-dot ${a.status || 'idle'}"></div>
            <div class="agent-info">
              <strong>${a.display || a.name}</strong>
              <span class="text-muted">${a.lastAction || 'No activity yet'}</span>
            </div>
            <span class="badge badge-${a.status === 'working' ? 'success' : a.status === 'error' ? 'danger' : 'default'}">${a.status || 'idle'}</span>
          </div>`).join('');
      }
    } catch (e) {}

    // Activity feed
    try {
      const actData = await window.API.get('/api/analytics/activity');
      const feed = document.getElementById('activity-feed');
      if (actData.success && feed) {
        const items = actData.data || [];
        feed.innerHTML = items.length ? items.slice(0, 10).map(a => `
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
              <span>${a.action || a.type || 'Activity'}</span>
              <span class="text-muted">${a.summary || a.title || ''}</span>
            </div>
            <span class="text-muted text-sm">${formatTime(a.created_at || a.time)}</span>
          </div>`).join('') : '<p class="text-muted" style="padding:1rem">No recent activity</p>';
      }
    } catch (e) {}
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
  }

  window.DashboardPage = { render };
})();
