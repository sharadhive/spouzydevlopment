const crypto = require('crypto');

function csrfProtection(req, res, next) {
  // Safe methods do not require CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt public endpoints that don't rely on ambient browser credentials (e.g. public contact forms, webhooks)
  if (req.path.startsWith('/api/payments/webhook') || 
      req.path.startsWith('/api/clinical-applications') ||
      req.path.startsWith('/api/career-applications') ||
      req.path.startsWith('/api/enquiries') ||
      req.path.startsWith('/api/faqs/ask') ||
      req.path.startsWith('/api/stories/submit') ||
      req.path.startsWith('/api/auth/customer/login') ||
      req.path.startsWith('/api/auth/customer/register') ||
      req.path.startsWith('/api/auth/login')) {
    return next();
  }

  // For cookie-based authenticated admin/customer requests, verify CSRF token
  const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
  const cookieToken = req.cookies['spouzy_csrf'];

  // If using bearer token in authorization header, CSRF is not vulnerable
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  if (!token || !cookieToken || token !== cookieToken) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing CSRF token. Please refresh the page.'
    });
  }

  next();
}

// Middleware to issue CSRF cookie if not present
function attachCsrfCookie(req, res, next) {
  if (!req.cookies['spouzy_csrf']) {
    const newToken = crypto.randomBytes(24).toString('hex');
    res.cookie('spouzy_csrf', newToken, {
      httpOnly: false, // Accessible to frontend JavaScript to set header
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
  }
  next();
}

module.exports = { csrfProtection, attachCsrfCookie };
