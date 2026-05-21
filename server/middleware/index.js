// Global error handler middleware
function errorHandler(err, req, res, next) {
  console.error(`❌ [${new Date().toISOString()}] Error:`, err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// Not found handler
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
  });
}

// Simple API key auth middleware
function auth(req, res, next) {
  // Skip auth for dashboard static files
  if (!req.path.startsWith('/api/')) return next();

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const config = require('../config/env');

  if (!config.apiKey || config.apiKey === 'dev-key-change-in-production') {
    // In development, allow all requests
    return next();
  }

  if (apiKey !== config.apiKey) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }

  next();
}

// Request logger middleware
function requestLogger(req, res, next) {
  if (req.path.startsWith('/api/')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`📡 ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    });
  }
  next();
}

module.exports = { errorHandler, notFound, auth, requestLogger };
