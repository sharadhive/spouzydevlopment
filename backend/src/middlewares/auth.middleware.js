const authService = require('../services/auth.service');
const config = require('../config/environment');

async function authenticate(req, res, next) {
  try {
    const sessionId = req.cookies[config.security.cookieName] || 
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
        ? req.headers.authorization.slice(7) 
        : null);

    if (!sessionId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    }

    const session = await authService.validateSession(sessionId);
    if (!session) {
      // Clear invalid cookie
      res.clearCookie(config.security.cookieName);
      return res.status(401).json({ success: false, message: 'Session expired or invalidated. Please sign in again.' });
    }

    req.sessionId = sessionId;
    req.token = sessionId;
    req.session = session;
    req.user = session.user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ success: false, message: 'Authentication verification failed.' });
  }
}

// Optional auth (attaches user if present, doesn't reject if anonymous)
async function optionalAuth(req, res, next) {
  try {
    const sessionId = req.cookies[config.security.cookieName] || 
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
        ? req.headers.authorization.slice(7) 
        : null);

    if (sessionId) {
      const session = await authService.validateSession(sessionId);
      if (session) {
        req.sessionId = sessionId;
        req.token = sessionId;
        req.session = session;
        req.user = session.user;
      }
    }
    next();
  } catch (err) {
    next();
  }
}

module.exports = { authenticate, optionalAuth };
