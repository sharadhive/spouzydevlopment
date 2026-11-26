const rateLimit = require('express-rate-limit');

// Strict limiter for authentication attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Website customer sign-in / sign-up: only failed attempts count towards the limit
const customerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.'
  }
});

// Limiter for public form submissions (prevents automated bot flooding)
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 submissions per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Submission limit reached for this hour. Please try again later.'
  }
});

// Limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 uploads per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload rate limit reached. Please wait a few minutes before attaching more files.'
  }
});

// FAQ answers are opened one at a time; this stops a script from copying all of them quickly
const faqAnswerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You have opened many answers in a short time. Please wait a few minutes and try again.'
  }
});

module.exports = {
  faqAnswerLimiter,
  authLimiter,
  customerAuthLimiter,
  publicFormLimiter,
  submissionLimiter: publicFormLimiter,
  uploadLimiter
};
