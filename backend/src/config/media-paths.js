/**
 * Where an image path stored in the database points to, and whether that file exists.
 *
 * Paths the website and admin use:
 *   image/... or /image/...          → a file in the website folder (website/image/...)
 *   /media/public/<file>             → a photo uploaded in the admin (backend/storage/uploads/public)
 *   https://...                      → an outside address (not checked here)
 */
const fs = require('fs');
const path = require('path');
const config = require('./environment');

const WEBSITE_DIR = path.resolve(__dirname, '../../../website');
const PUBLIC_UPLOADS = config.storage.publicUploads;

function inside(dir, file) {
  const rel = path.relative(dir, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * @returns {{ kind: 'empty'|'external'|'local'|'invalid', file?: string, exists?: boolean }}
 */
function resolveImage(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return { kind: 'empty' };
  if (/^https?:\/\//i.test(v)) return { kind: 'external' };
  if (/^(javascript|data|vbscript|file):/i.test(v) || v.startsWith('//')) return { kind: 'invalid' };

  let clean = v.split('#')[0].split('?')[0];
  try { clean = decodeURIComponent(clean); } catch (e) { return { kind: 'invalid' }; }
  clean = clean.replace(/\\/g, '/').replace(/^\.\//, '');
  let base;
  let rest;
  const m = clean.match(/^\/?media\/public\/(.+)$/);
  if (m) { base = PUBLIC_UPLOADS; rest = m[1]; } else { base = WEBSITE_DIR; rest = clean.replace(/^\/+/, ''); }
  const file = path.resolve(base, rest);
  if (!inside(base, file)) return { kind: 'invalid' };
  let exists = false;
  try { exists = fs.statSync(file).isFile(); } catch (e) { exists = false; }
  return { kind: 'local', file, exists };
}

/** A short reason when the image cannot be shown, or '' when it is fine (or empty) */
function imageProblem(value) {
  const r = resolveImage(value);
  if (r.kind === 'invalid') return 'This image address is not allowed.';
  if (r.kind === 'local' && !r.exists) {
    return `Image not found: "${String(value).trim()}". Upload the photo with the Upload button, or pick one from Content & Media → Media Library.`;
  }
  return '';
}

module.exports = { resolveImage, imageProblem, WEBSITE_DIR, PUBLIC_UPLOADS };
