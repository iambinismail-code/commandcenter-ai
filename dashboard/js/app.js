// SPA Router — Hash-based routing for the dashboard
(function () {
  'use strict';

  const routes = {
    '/dashboard': () => window.DashboardPage?.render(),
    '/contacts': () => window.ContactsPage?.render(),
    '/leads': () => window.LeadsPage?.render(),
    '/deals': () => window.DealsPage?.render(),
    '/content': () => window.ContentPage?.render(),
    '/social': () => window.SocialPage?.render(),
    '/tasks': () => window.TasksPage?.render(),
    '/agents': () => window.AgentsPage?.render(),
    '/settings': () => window.SettingsPage?.render(),
  };

  function navigate(hash) {
    const path = hash.replace('#', '') || '/dashboard';
    const content = document.getElementById('app-content');
    if (!content) return;

    // Add page transition
    content.classList.add('page-exit');

    setTimeout(() => {
      const routeHandler = routes[path];
      if (routeHandler) {
        routeHandler();
      } else {
        content.innerHTML = `<div class="page-container"><div class="glass-card" style="padding:3rem;text-align:center"><h2>404 — Page Not Found</h2><p class="text-muted">The page "${path}" doesn't exist.</p></div></div>`;
      }

      // Update active nav
      document.querySelectorAll('.nav-item').forEach((link) => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + path) {
          link.classList.add('active');
        }
      });

      // Update page title in header
      const titles = {
        '/dashboard': 'Dashboard',
        '/contacts': 'Contacts',
        '/leads': 'Lead Pipeline',
        '/deals': 'Deals',
        '/content': 'Content Manager',
        '/social': 'Social Media',
        '/tasks': 'Task Board',
        '/agents': 'AI Agents',
        '/settings': 'Settings',
      };
      const titleEl = document.getElementById('header-title');
      if (titleEl) titleEl.textContent = titles[path] || 'CommandCenter AI';

      content.classList.remove('page-exit');
      content.classList.add('page-enter');
      setTimeout(() => content.classList.remove('page-enter'), 400);
    }, 150);
  }

  // Listen for hash changes
  window.addEventListener('hashchange', () => navigate(location.hash));

  // Initialize on load
  window.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) location.hash = '#/dashboard';
    navigate(location.hash);

    // Nav link click handler
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
      });
    });
  });

  window.App = { navigate, routes };
})();
