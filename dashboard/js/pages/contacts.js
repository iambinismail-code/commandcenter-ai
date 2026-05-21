// Contacts Management Page
(function () {
  'use strict';
  let currentPage = 1;
  let searchQuery = '';
  let statusFilter = '';

  async function render() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="page-container fade-in">
        <div class="page-header">
          <div class="page-header-left">
            <h2>Contacts</h2>
            <span class="text-muted" id="contacts-count">Loading...</span>
          </div>
          <button class="btn btn-primary" id="add-contact-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Contact
          </button>
        </div>

        <div class="filters-bar glass-card">
          <input type="text" class="form-input" id="contact-search" placeholder="Search contacts..." value="${searchQuery}">
          <select class="form-select" id="contact-status-filter">
            <option value="">All Status</option>
            <option value="active" ${statusFilter==='active'?'selected':''}>Active</option>
            <option value="inactive" ${statusFilter==='inactive'?'selected':''}>Inactive</option>
            <option value="archived" ${statusFilter==='archived'?'selected':''}>Archived</option>
          </select>
        </div>

        <div class="glass-card table-container">
          <table class="data-table" id="contacts-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Source</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="contacts-tbody"><tr><td colspan="7" class="text-center text-muted">Loading...</td></tr></tbody>
          </table>
          <div class="pagination" id="contacts-pagination"></div>
        </div>
      </div>`;

    document.getElementById('add-contact-btn').addEventListener('click', showAddModal);
    document.getElementById('contact-search').addEventListener('input', debounce((e) => {
      searchQuery = e.target.value; currentPage = 1; loadContacts();
    }, 300));
    document.getElementById('contact-status-filter').addEventListener('change', (e) => {
      statusFilter = e.target.value; currentPage = 1; loadContacts();
    });
    loadContacts();
  }

  async function loadContacts() {
    try {
      let url = `/api/contacts?page=${currentPage}&limit=15`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await window.API.get(url);
      if (!res.success) throw new Error(res.error);

      const contacts = res.data || [];
      const total = res.pagination?.total || contacts.length;
      document.getElementById('contacts-count').textContent = `${total} contact${total !== 1 ? 's' : ''}`;

      const tbody = document.getElementById('contacts-tbody');
      if (contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No contacts found</td></tr>';
        return;
      }

      tbody.innerHTML = contacts.map(c => `
        <tr class="table-row-hover">
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.email || '—')}</td>
          <td>${esc(c.phone || '—')}</td>
          <td>${esc(c.company || '—')}</td>
          <td><span class="badge">${c.source || 'manual'}</span></td>
          <td><span class="badge badge-${c.status === 'active' ? 'success' : 'default'}">${c.status}</span></td>
          <td class="actions-cell">
            <button class="btn btn-sm" onclick="ContactsPage.edit(${c.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="ContactsPage.del(${c.id},'${esc(c.name)}')">🗑</button>
          </td>
        </tr>`).join('');

      // Pagination
      if (res.pagination) {
        const { page, totalPages } = res.pagination;
        const pag = document.getElementById('contacts-pagination');
        let html = '';
        if (page > 1) html += `<button class="btn btn-sm" onclick="ContactsPage.goPage(${page-1})">← Prev</button>`;
        html += `<span class="text-muted" style="margin:0 1rem">Page ${page} of ${totalPages}</span>`;
        if (page < totalPages) html += `<button class="btn btn-sm" onclick="ContactsPage.goPage(${page+1})">Next →</button>`;
        pag.innerHTML = html;
      }
    } catch (e) {
      document.getElementById('contacts-tbody').innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error loading contacts</td></tr>`;
    }
  }

  function showAddModal() {
    window.Modal.show('Add Contact', `
      <form id="add-contact-form">
        <div class="form-group"><label>Name *</label><input type="text" class="form-input" name="name" required></div>
        <div class="form-group"><label>Email</label><input type="email" class="form-input" name="email"></div>
        <div class="form-group"><label>Phone</label><input type="text" class="form-input" name="phone"></div>
        <div class="form-group"><label>Company</label><input type="text" class="form-input" name="company"></div>
        <div class="form-group"><label>Source</label>
          <select class="form-select" name="source">
            <option value="manual">Manual</option><option value="website">Website</option>
            <option value="referral">Referral</option><option value="facebook">Facebook</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group"><label>Notes</label><textarea class="form-input" name="notes" rows="3"></textarea></div>
      </form>
    `, [
      { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
      { label: 'Add Contact', class: 'btn btn-primary', onclick: () => submitAdd() },
    ]);
  }

  async function submitAdd() {
    const form = document.getElementById('add-contact-form');
    const data = Object.fromEntries(new FormData(form));
    if (!data.name) { window.Toast.show('Name is required', 'error'); return; }
    try {
      const res = await window.API.post('/api/contacts', data);
      if (res.success) {
        window.Modal.close();
        window.Toast.show('Contact added!', 'success');
        loadContacts();
      } else { window.Toast.show(res.error || 'Failed', 'error'); }
    } catch (e) { window.Toast.show('Error adding contact', 'error'); }
  }

  async function editContact(id) {
    try {
      const res = await window.API.get(`/api/contacts/${id}`);
      if (!res.success) return;
      const c = res.data;
      window.Modal.show('Edit Contact', `
        <form id="edit-contact-form">
          <div class="form-group"><label>Name *</label><input type="text" class="form-input" name="name" value="${esc(c.name)}" required></div>
          <div class="form-group"><label>Email</label><input type="email" class="form-input" name="email" value="${esc(c.email||'')}"></div>
          <div class="form-group"><label>Phone</label><input type="text" class="form-input" name="phone" value="${esc(c.phone||'')}"></div>
          <div class="form-group"><label>Company</label><input type="text" class="form-input" name="company" value="${esc(c.company||'')}"></div>
          <div class="form-group"><label>Status</label>
            <select class="form-select" name="status">
              <option value="active" ${c.status==='active'?'selected':''}>Active</option>
              <option value="inactive" ${c.status==='inactive'?'selected':''}>Inactive</option>
              <option value="archived" ${c.status==='archived'?'selected':''}>Archived</option>
            </select>
          </div>
          <div class="form-group"><label>Notes</label><textarea class="form-input" name="notes" rows="3">${esc(c.notes||'')}</textarea></div>
        </form>
      `, [
        { label: 'Cancel', class: 'btn', onclick: () => window.Modal.close() },
        { label: 'Save', class: 'btn btn-primary', onclick: () => submitEdit(id) },
      ]);
    } catch (e) { window.Toast.show('Error loading contact', 'error'); }
  }

  async function submitEdit(id) {
    const form = document.getElementById('edit-contact-form');
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await window.API.put(`/api/contacts/${id}`, data);
      if (res.success) { window.Modal.close(); window.Toast.show('Contact updated!', 'success'); loadContacts(); }
      else { window.Toast.show(res.error || 'Failed', 'error'); }
    } catch (e) { window.Toast.show('Error updating contact', 'error'); }
  }

  async function deleteContact(id, name) {
    if (!confirm(`Delete contact "${name}"?`)) return;
    try {
      const res = await window.API.del(`/api/contacts/${id}`);
      if (res.success) { window.Toast.show('Contact deleted', 'success'); loadContacts(); }
      else { window.Toast.show(res.error || 'Failed', 'error'); }
    } catch (e) { window.Toast.show('Error deleting contact', 'error'); }
  }

  function goPage(p) { currentPage = p; loadContacts(); }
  function esc(s) { return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  window.ContactsPage = { render, edit: editContact, del: deleteContact, goPage };
})();
