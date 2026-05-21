/* ═══════════════════════════════════════════════════════════
   CommandCenter AI — Sidebar Component
   Toggle, active highlighting, mobile overlay
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const openBtn  = document.getElementById('hamburger-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');

    if (openBtn) openBtn.addEventListener('click', () => open());
    if (closeBtn) closeBtn.addEventListener('click', () => close());
    if (overlay) overlay.addEventListener('click', () => close());

    highlightActive();
  }

  function open() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
  }

  function close() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  function highlightActive() {
    const hash = window.location.hash || '#/dashboard';
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      item.classList.toggle('active', href === hash);
    });
  }

  window.Sidebar = { init, highlightActive, open, close };
})();
