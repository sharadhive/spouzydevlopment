const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT, 10) || 5000,
  
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.NODE_ENV === 'test' 
      ? (process.env.DB_NAME_TEST || 'spouzy_test') 
      : (process.env.DB_NAME || 'spouzy_dev'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
  },

  urls: {
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:5000',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://localhost:5173,http://127.0.0.1:5000,http://127.0.0.1:5173')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET || 'dev_session_secret_32_chars_long_12345',
    encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    csrfSecret: process.env.CSRF_SECRET || 'dev_csrf_secret_32_chars_long_12345',
    sessionDurationHours: 24 * 7, // 7 days
    cookieName: 'spouzy_session'
  },

  // STORAGE_PATH is relative to the backend/ folder (default ./storage) or absolute
  storage: (() => {
    const backendDir = path.resolve(__dirname, '../..');
    const baseDir = path.resolve(backendDir, process.env.STORAGE_PATH || './storage');
    return {
      baseDir,
      privateUploads: path.join(baseDir, 'uploads', 'private'),
      publicUploads: path.join(baseDir, 'uploads', 'public'),
      logsDir: path.join(baseDir, 'logs'),
    };
  })(),

  spouzy: {
    whatsapp: process.env.SPOUZY_WHATSAPP_NUMBER || '+918591945055',
    email: process.env.SPOUZY_SUPPORT_EMAIL || 'care@spouzy.com',
  }
};

// Validate critical configurations
function validateConfig() {
  const errors = [];
  if (!config.db.name) errors.push('Database name (DB_NAME) must be specified');
  if (!config.db.user) errors.push('Database user (DB_USER) must be specified');
  if (config.isProd && config.security.sessionSecret.includes('dev_')) {
    errors.push('In production, SESSION_SECRET must not use development defaults');
  }
  if (config.isProd && config.security.csrfSecret.includes('dev_')) {
    errors.push('In production, CSRF_SECRET must not use development defaults');
  }
  if (config.isProd && !/^[0-9a-fA-F]{64}$/.test(config.security.encryptionKey)) {
    errors.push('In production, ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  if (config.isProd && config.security.encryptionKey.includes('0123456789abcdef')) {
    errors.push('In production, ENCRYPTION_KEY must be a cryptographically random 32-byte hex string');
  }

  if (errors.length > 0) {
    throw new Error('Configuration Validation Error:\n - ' + errors.join('\n - '));
  }
}

validateConfig();

module.exports = config;
