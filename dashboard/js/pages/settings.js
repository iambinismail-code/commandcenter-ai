// Settings Page
(function () {
  'use strict';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header"><h2>⚙️ Settings</h2></div>

        <div class="settings-grid">
          <div class="glass-card" style="padding:1.5rem">
            <h3 style="margin-bottom:1.5rem">🔑 API Keys</h3>
            <p class="text-muted text-sm" style="margin-bottom:1rem">Configure your API keys. These are stored in the .env file on your server.</p>

            <div class="form-group">
              <label>Telegram Bot Token</label>
              <input type="password" class="form-input" id="setting-telegram-token" placeholder="Enter bot token from @BotFather">
            </div>
            <div class="form-group">
              <label>Telegram Owner ID</label>
              <input type="text" class="form-input" id="setting-telegram-owner" placeholder="Your Telegram user ID">
            </div>
            <div class="form-group">
              <label>Google Gemini API Key</label>
              <input type="password" class="form-input" id="setting-gemini-key" placeholder="Free key from aistudio.google.com">
            </div>
            <div class="form-group">
              <label>Groq API Key</label>
              <input type="password" class="form-input" id="setting-groq-key" placeholder="Free key from console.groq.com">
            </div>
            <div class="form-group">
              <label>Facebook Page Access Token</label>
              <input type="password" class="form-input" id="setting-fb-token" placeholder="From Meta Developer portal">
            </div>
            <div class="form-group">
              <label>Facebook Page ID</label>
              <input type="text" class="form-input" id="setting-fb-page-id" placeholder="Your Facebook page ID">
            </div>

            <button class="btn btn-primary" id="save-keys-btn" style="margin-top:1rem">💾 Save API Keys</button>
          </div>

          <div class="glass-card" style="padding:1.5rem">
            <h3 style="margin-bottom:1.5rem">📊 System Info</h3>
            <div id="system-info" class="text-muted">Loading...</div>

            <h3 style="margin:2rem 0 1rem">🎨 About</h3>
            <div style="text-align:center;padding:1rem">
              <div style="font-size:2.5rem;margin-bottom:0.5rem">🚀</div>
              <h2 style="background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.5rem">Bin Group</h2>
              <p class="text-muted" style="margin-top:0.5rem">v1.0.0</p>
              <p class="text-muted text-sm" style="margin-top:0.5rem">AI-Powered Business Management System</p>
              <p class="text-muted text-sm" style="margin-top:1rem">Built with Node.js, Express, SQLite, Telegraf</p>
              <p class="text-muted text-sm">Free AI: Google Gemini + Groq</p>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('save-keys-btn').addEventListener('click', saveKeys);
    loadSettings();
    loadSystemInfo();
  }

  async function loadSettings() {
    try {
      const res = await window.API.get('/api/settings');
      if (res.success) {
        const settings = res.data || {};
        const all = Array.isArray(settings) ? settings : Object.values(settings).flat();
        all.forEach(s => {
          const map = {
            telegram_token: 'setting-telegram-token',
            telegram_owner_id: 'setting-telegram-owner',
            gemini_api_key: 'setting-gemini-key',
            groq_api_key: 'setting-groq-key',
            fb_page_token: 'setting-fb-token',
            fb_page_id: 'setting-fb-page-id',
          };
          const el = document.getElementById(map[s.key]);
          if (el && s.value) el.value = s.value;
        });
      }
    } catch (e) {}
  }

  async function loadSystemInfo() {
    try {
      const res = await window.API.get('/api/health');
      const info = document.getElementById('system-info');
      if (res.success) {
        info.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:0.75rem">
            <div><span style="color:var(--text)">Status:</span> <span class="badge badge-success">${res.status}</span></div>
            <div><span style="color:var(--text)">Uptime:</span> ${formatUptime(res.uptime)}</div>
            <div><span style="color:var(--text)">Version:</span> ${res.version}</div>
            <div><span style="color:var(--text)">Server Time:</span> ${new Date(res.timestamp).toLocaleString()}</div>
          </div>`;
      }
    } catch (e) { document.getElementById('system-info').textContent = 'Server not reachable'; }
  }

  async function saveKeys() {
    const keys = [
      { key: 'telegram_token', value: document.getElementById('setting-telegram-token').value, category: 'api_keys' },
      { key: 'telegram_owner_id', value: document.getElementById('setting-telegram-owner').value, category: 'api_keys' },
      { key: 'gemini_api_key', value: document.getElementById('setting-gemini-key').value, category: 'api_keys' },
      { key: 'groq_api_key', value: document.getElementById('setting-groq-key').value, category: 'api_keys' },
      { key: 'fb_page_token', value: document.getElementById('setting-fb-token').value, category: 'api_keys' },
      { key: 'fb_page_id', value: document.getElementById('setting-fb-page-id').value, category: 'api_keys' },
    ].filter(k => k.value);

    try {
      const res = await window.API.post('/api/settings/bulk', { settings: keys });
      if (res.success) window.Toast.show('Settings saved!', 'success');
      else window.Toast.show(res.error || 'Failed', 'error');
    } catch(e) { window.Toast.show('Error saving settings', 'error'); }
  }

  function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  }

  window.SettingsPage = { render };
})();
