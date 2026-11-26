const config = require('../config/environment');

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred.';

  // Upload errors (size / count / type) are the visitor's to fix, not server errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'A file is too large. Maximum size is 10 MB per file.';
    else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many files or an unexpected file field was sent.';
  } else if (/^Unsupported file type/.test(message) || /File content does not match/.test(message)) {
    statusCode = 400;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'The request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON body.';
  }

  const response = { success: false, message };
  if (err.errors && typeof err.errors === 'object' && !Array.isArray(err.errors)) {
    response.errors = err.errors;
  }

  // Never expose internals for server errors in production
  if (statusCode >= 500 && config.isProd) {
    response.message = 'An unexpected internal server error occurred.';
  }

  // Stack only in development
  if (!config.isProd && !config.isTest && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
