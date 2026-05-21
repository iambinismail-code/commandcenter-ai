/* ═══════════════════════════════════════════════════════════
   CommandCenter AI — API Client
   Fetch-based REST client for /api/* endpoints
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE = window.location.origin;

  async function request(method, path, data) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data && method !== 'GET') {
      opts.body = JSON.stringify(data);
    }
    try {
      const res = await fetch(`${BASE}${path}`, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      console.error(`[API] ${method} ${path} →`, err);
      throw err;
    }
  }

  window.API = {
    get:  (path)       => request('GET', path),
    post: (path, data) => request('POST', path, data),
    put:  (path, data) => request('PUT', path, data),
    del:  (path)       => request('DELETE', path),
  };
})();
