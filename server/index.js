// CommandCenter AI — Main Server Entry Point
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/env');
const db = require('./config/database');
const { errorHandler, notFound, auth, requestLogger } = require('./middleware');

const app = express();

// ── Core Middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(auth);

// ── Serve Dashboard (Static Files) ──
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ── API Routes ──
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/content', require('./routes/content'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/settings', require('./routes/settings'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// ── SPA Fallback (serve index.html for non-API routes) ──
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
});

// ── Error Handling ──
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──
const PORT = config.port;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       🚀 CommandCenter AI — Running         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Dashboard:  http://localhost:${PORT}            ║`);
  console.log(`║  API:        http://localhost:${PORT}/api         ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Show config warnings
  const warnings = config.validate();
  if (warnings.length > 0) {
    console.log('⚠️  Configuration warnings:');
    warnings.forEach((w) => console.log(`   • ${w}`));
    console.log('');
  }

  // Start Telegram bot if token is configured
  if (config.telegram.botToken) {
    try {
      const { startBot } = require('../bot/index');
      startBot();
    } catch (e) {
      console.log('⚠️  Telegram bot failed to start:', e.message);
    }
  } else {
    console.log('ℹ️  Telegram bot not started (no token configured)');
  }

  // Start content scheduler
  try {
    const scheduler = require('../agents/scheduler');
    scheduler.start();
  } catch (e) {
    // Scheduler optional
  }
});

module.exports = app;
