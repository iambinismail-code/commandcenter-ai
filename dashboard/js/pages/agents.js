// AI Agents Monitor Page
(function () {
  'use strict';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header"><h2>🤖 AI Agents</h2></div>

        <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="margin-bottom:1rem">💬 Ask Your AI Team</h3>
          <div style="display:flex;gap:0.75rem">
            <input type="text" class="form-input" id="agent-question" placeholder="Ask anything... e.g., 'Create a post about summer sale'" style="flex:1">
            <button class="btn btn-primary" id="agent-ask-btn">🚀 Ask</button>
          </div>
          <div id="agent-response" class="glass-card" style="margin-top:1rem;padding:1rem;display:none">
            <div id="agent-response-header" class="text-muted text-sm" style="margin-bottom:0.5rem"></div>
            <pre id="agent-response-text" style="white-space:pre-wrap;color:var(--text);font-family:inherit;margin:0"></pre>
          </div>
        </div>

        <div class="stats-grid" id="agent-cards"></div>

        <div class="glass-card" style="margin-top:1.5rem">
          <h3 style="padding:1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.05)">📋 Recent Agent Activity</h3>
          <div id="agent-logs" style="max-height:400px;overflow-y:auto;padding:1rem"></div>
        </div>
      </div>`;

    document.getElementById('agent-ask-btn').addEventListener('click', askAgent);
    document.getElementById('agent-question').addEventListener('keypress', (e) => { if (e.key === 'Enter') askAgent(); });
    loadAgents();
  }

  async function loadAgents() {
    try {
      const res = await window.API.get('/api/agents');
      const agents = res.success ? (res.data || []) : [];

      const icons = { orchestrator: '🧠', content_creator: '🎨', social_media: '📱', customer_support: '🎧', analytics: '📊', task_manager: '📋' };
      const statusDots = { idle: 'var(--text-muted)', working: 'var(--success)', error: 'var(--error)' };

      document.getElementById('agent-cards').innerHTML = agents.map(a => `
        <div class="glass-card stat-card" style="cursor:pointer" onclick="AgentsPage.showLogs('${a.name}')">
          <div style="display:flex;align-items:center;gap:1rem;width:100%">
            <div style="font-size:2rem">${icons[a.name] || '🤖'}</div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:0.5rem">
                <strong>${a.display || a.name}</strong>
                <div style="width:8px;height:8px;border-radius:50%;background:${statusDots[a.status] || statusDots.idle}"></div>
              </div>
              <div class="text-muted text-sm">${a.description || ''}</div>
              <div class="text-muted text-sm" style="margin-top:0.25rem">${a.totalActions || 0} actions ${a.lastActivity ? '• Last: ' + timeAgo(a.lastActivity) : ''}</div>
            </div>
          </div>
        </div>`).join('');

      // Load recent logs
      const logsRes = await window.API.get('/api/agents/orchestrator/logs?limit=20');
      const allLogs = logsRes.success ? (logsRes.data || []) : [];
      const logsDiv = document.getElementById('agent-logs');
      logsDiv.innerHTML = allLogs.length ? allLogs.map(l => `
        <div class="activity-item" style="padding:0.75rem;border-bottom:1px solid rgba(255,255,255,0.03)">
          <span class="badge badge-${l.status === 'success' ? 'success' : 'danger'}" style="min-width:70px;text-align:center">${l.status}</span>
          <div style="flex:1;margin-left:0.75rem">
            <strong>${l.agent_name}</strong> → ${esc(l.action)}
            ${l.input_summary ? `<div class="text-muted text-sm">${esc(l.input_summary.substring(0,100))}</div>` : ''}
          </div>
          <span class="text-muted text-sm">${timeAgo(l.created_at)}</span>
        </div>`).join('') : '<p class="text-muted text-center">No agent activity yet</p>';
    } catch (e) {}
  }

  async function askAgent() {
    const input = document.getElementById('agent-question');
    const question = input.value.trim();
    if (!question) { window.Toast.show('Type a question first', 'error'); return; }

    window.Toast.show('🤖 Processing your request...', 'info');
    const respDiv = document.getElementById('agent-response');
    const respHeader = document.getElementById('agent-response-header');
    const respText = document.getElementById('agent-response-text');
    respDiv.style.display = 'block';
    respHeader.textContent = 'Thinking...';
    respText.textContent = '';

    try {
      const res = await window.API.post('/api/agents/ask', { question });
      if (res.success) {
        respHeader.textContent = `Agent: ${res.data?.agent_name || 'orchestrator'} • ${res.data?.status || 'done'}`;
        respText.textContent = res.data?.output_summary || res.data?.response || 'Done!';
        window.Toast.show('Response received!', 'success');
        input.value = '';
        loadAgents(); // Refresh logs
      } else {
        respText.textContent = res.error || 'Failed to get response';
      }
    } catch (e) {
      respText.textContent = 'Error communicating with agents. Make sure AI API keys are configured.';
      window.Toast.show('Agent error', 'error');
    }
  }

  async function showLogs(agentName) {
    try {
      const res = await window.API.get(`/api/agents/${agentName}/logs?limit=20`);
      const logs = res.success ? (res.data || []) : [];
      window.Modal.show(`${agentName} Activity Log`, logs.length ?
        `<div style="max-height:400px;overflow-y:auto">${logs.map(l => `
          <div style="padding:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${esc(l.action)}</strong>
              <span class="badge badge-${l.status === 'success' ? 'success' : 'danger'}">${l.status}</span>
            </div>
            ${l.input_summary ? `<div class="text-muted text-sm" style="margin-top:0.25rem">📥 ${esc(l.input_summary.substring(0,150))}</div>` : ''}
            ${l.output_summary ? `<div class="text-sm" style="margin-top:0.25rem;color:var(--text)">📤 ${esc(l.output_summary.substring(0,150))}</div>` : ''}
            <div class="text-muted text-sm" style="margin-top:0.25rem">${timeAgo(l.created_at)} ${l.duration_ms ? `• ${l.duration_ms}ms` : ''}</div>
          </div>`).join('')}</div>` :
        '<p class="text-muted text-center">No activity for this agent yet</p>',
        [{ label: 'Close', class: 'btn', onclick: () => window.Modal.close() }]
      );
    } catch (e) { window.Toast.show('Error loading logs', 'error'); }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    // DB stores UTC without timezone suffix — append Z so browser parses as UTC
    const utcTs = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
    const diff = Date.now() - new Date(utcTs).getTime();
    if (diff < 0) return 'Just now';
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    return new Date(utcTs).toLocaleDateString();
  }

  function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window.AgentsPage = { render, showLogs };
})();
