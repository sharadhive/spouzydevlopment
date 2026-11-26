const express = require('express');
const router = express.Router();
const careerService = require('../services/career.service');
const uploadService = require('../services/upload.service');
const upload = require('../middlewares/upload.middleware');
const { submissionLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');

// Public: List active openings
router.get('/openings', async (req, res, next) => {
  try {
    const openings = await careerService.listActiveOpenings();
    res.json({ success: true, data: openings });
  } catch (err) {
    next(err);
  }
});

// Public: Get opening by slug
router.get('/openings/:slug', async (req, res, next) => {
  try {
    const opening = await careerService.getOpeningBySlug(req.params.slug);
    res.json({ success: true, data: opening });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// Public: Submit application with resume.
// Mounted at /api/careers and /api/career-applications, so both
// POST /api/careers/applications and POST /api/career-applications work.
async function submitHandler(req, res) {
  try {
    // 1. Validate fields + file BEFORE anything is written to disk
    careerService.validateApplication(req.body, req.file);

    // 2. Double-submit guard: same person + role within 15 minutes
    const duplicate = await careerService.findRecentDuplicate(req.body);
    if (duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'We already received this application. Your reference number is below.',
        data: { id: duplicate.id, referenceNo: duplicate.reference_no, roleTitle: duplicate.role_title, fullName: duplicate.full_name }
      });
    }

    // 3. Store resume privately, then create the record
    const asset = await uploadService.storeFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      isPrivate: true
    });

    const result = await careerService.submitApplication(req.body, asset.id);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      data: result
    });
  } catch (err) {
    sendError(res, err);
  }
}

router.post(['/applications', '/'], submissionLimiter, upload.single('resume'), (req, res, next) => {
  // POST /api/careers (no sub-path) is not an application endpoint
  if (req.baseUrl.endsWith('/careers') && req.path === '/') {
    return res.status(404).json({ success: false, message: 'Use POST /api/careers/applications' });
  }
  return submitHandler(req, res, next);
});

module.exports = router;
