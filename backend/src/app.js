const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/environment');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler.middleware');
const { attachCsrfCookie, csrfProtection } = require('./middlewares/csrf.middleware');

const app = express();

// Security Headers (relaxed CSP for local scripts, styles, fonts, and WebM video transitions)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Behind cPanel / Passenger (or any reverse proxy) trust the first proxy so that
// req.ip and the rate limiters see the real visitor IP, and secure cookies work.
if (config.isProd || process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));
}

// CORS: only the configured site origins (plus localhost while developing)
const allowedOrigins = new Set(config.urls.allowedOrigins);
try { allowedOrigins.add(new URL(config.urls.publicUrl).origin); } catch (e) { /* ignore bad PUBLIC_URL */ }
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin navigation, curl, server-to-server
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (!config.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(null, false); // no CORS headers → browser blocks cross-site reads
  },
  credentials: true
}));

// Body parsers with raw body buffer for webhook signature validation
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Cookie parser & CSRF cookie attachment
app.use(cookieParser());
app.use(attachCsrfCookie);

// CSRF protection for cookie-authenticated staff actions (Bearer-token calls are exempt)
app.use(['/api/admin', '/api/customer', '/api/auth/logout', '/api/auth/change-password'], csrfProtection);

// API Routes
app.use('/api', routes);

// Public media library (images uploaded by staff for banners, blogs, etc.)
app.use('/media/public', express.static(config.storage.publicUploads, {
  index: false,
  dotfiles: 'deny',
  maxAge: '7d'
}));

// Serve Admin Panel (built React SPA) if available, with SPA fallback
const adminDistPath = path.resolve(__dirname, '../../admin/dist');
if (fs.existsSync(adminDistPath)) {
  app.use('/admin', express.static(adminDistPath));
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
} else {
  app.get('/admin', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>SPOUZY Admin</title><style>body{font-family:sans-serif;padding:40px;background:#FFFCF7;color:#4B2030;}</style></head>
      <body>
        <h2>SPOUZY Admin Panel</h2>
        <p>The Admin SPA is not yet built. In development, run <code>npm run dev:admin</code> to access the Vite dev server at <code>http://localhost:5173</code>.</p>
        <p>Or run <code>npm run build:admin</code> to compile the production bundle for this route.</p>
      </body>
      </html>
    `);
  });
}

// Serve Public Website static assets & HTML pages from website/ directory
const websitePath = path.resolve(__dirname, '../../website');
if (fs.existsSync(websitePath)) {
  app.use(express.static(websitePath, {
    extensions: ['htm', 'html'],
    index: ['index.htm', 'index.html']
  }));
}

// Fallback for API 404s
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
