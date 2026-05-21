/* ═══════════════════════════════════════════════════════════
   CommandCenter AI — Modal System
   window.Modal.show(title, bodyHTML, actions)
   window.Modal.confirm(title, message, onConfirm)
   window.Modal.close()
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const overlay   = () => document.getElementById('modal-overlay');
  const container = () => document.getElementById('modal-container');

  function show(title, bodyHTML, actions = []) {
    const actionsHTML = actions.map(a => {
      const cls = a.class || 'btn btn-secondary';
      return `<button class="${cls}" id="${a.id || ''}" data-action="${a.action || ''}">${a.label}</button>`;
    }).join('');

    container().innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${actionsHTML ? `<div class="modal-footer">${actionsHTML}</div>` : ''}
      </div>
    `;

    overlay().classList.add('active');
    container().classList.add('active');

    // Close handlers
    document.getElementById('modal-close-btn').addEventListener('click', close);
    overlay().addEventListener('click', close);

    // Action handlers
    actions.forEach(a => {
      if (a.id && a.onClick) {
        const btn = document.getElementById(a.id);
        if (btn) btn.addEventListener('click', a.onClick);
      }
    });

    // ESC key
    document.addEventListener('keydown', escHandler);
  }

  function confirm(title, message, onConfirm) {
    show(title, `<p style="color:var(--text-secondary);font-size:var(--font-sm);line-height:1.7">${message}</p>`, [
      { label: 'Cancel', class: 'btn btn-secondary', id: 'modal-cancel', onClick: close },
      { label: 'Confirm', class: 'btn btn-danger', id: 'modal-confirm', onClick: () => { close(); if (onConfirm) onConfirm(); } },
    ]);
  }

  function close() {
    overlay().classList.remove('active');
    container().classList.remove('active');
    document.removeEventListener('keydown', escHandler);
    setTimeout(() => { container().innerHTML = ''; }, 300);
  }

  function escHandler(e) {
    if (e.key === 'Escape') close();
  }

  window.Modal = { show, confirm, close };
})();
