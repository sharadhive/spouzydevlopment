/**
 * Small validation helpers shared by public form endpoints.
 * Errors are collected per field and returned as
 *   400 { success:false, message, errors: { field: 'reason' } }
 */
class ValidationError extends Error {
  constructor(errors, message = 'Please correct the highlighted fields.') {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function isTrue(v) {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on' || v === 'yes';
}

function createValidator(data = {}) {
  const errors = {};
  const api = {
    errors,
    required(field, label, { min = 1, max = null } = {}) {
      const v = str(data[field]);
      if (!v) errors[field] = `${label} is required.`;
      else if (v.length < min) errors[field] = `${label} must be at least ${min} characters.`;
      else if (max && v.length > max) errors[field] = `${label} must be at most ${max} characters.`;
      return api;
    },
    email(field, label = 'Email', { required = true } = {}) {
      const v = str(data[field]);
      if (!v) { if (required) errors[field] = `${label} is required.`; }
      else if (!EMAIL_RE.test(v)) errors[field] = `${label} is not a valid email address.`;
      return api;
    },
    phone(field, label = 'Phone', { required = true } = {}) {
      const v = str(data[field]);
      const digits = v.replace(/\D/g, '');
      if (!v) { if (required) errors[field] = `${label} is required.`; }
      else if (digits.length < 7 || digits.length > 15) errors[field] = `${label} must be a valid phone number.`;
      return api;
    },
    consent(field, label = 'Consent') {
      if (!isTrue(data[field])) errors[field] = `${label} is required.`;
      return api;
    },
    custom(field, ok, message) {
      if (!ok) errors[field] = message;
      return api;
    },
    get ok() { return Object.keys(errors).length === 0; },
    throwIfErrors(message) {
      if (Object.keys(errors).length) throw new ValidationError(errors, message);
      return api;
    }
  };
  return api;
}

/** Send a consistent error response for service/validation errors */
function sendError(res, err, defaultStatus = 400) {
  const status = err.status || defaultStatus;
  const body = { success: false, message: err.message };
  if (err.errors) body.errors = err.errors;
  if (err.publicCode) body.code = err.publicCode;
  return res.status(status).json(body);
}

module.exports = { ValidationError, createValidator, sendError, str, isTrue, EMAIL_RE };
