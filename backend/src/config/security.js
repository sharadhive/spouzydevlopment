const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('./environment');

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive plain text (e.g. payment gateway secrets)
 * Stores IV, AuthTag, and Ciphertext in standard hex format
 */
function encryptSecret(plainText) {
  if (!plainText) return null;
  const key = Buffer.from(config.security.encryptionKey.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive text
 */
function decryptSecret(encryptedString) {
  if (!encryptedString) return null;
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = Buffer.from(config.security.encryptionKey.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt secret:', err.message);
    return null;
  }
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(11);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare password with hash
 */
async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate secure random token
 */
function generateSecureToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Sanitize cell values for CSV export to protect against CSV Formula Injection (CWE-1236)
 */
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // If first character is formula trigger =, +, -, @, tab, or carriage return, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  hashPassword,
  comparePassword,
  generateSecureToken,
  sanitizeCsvValue
};
