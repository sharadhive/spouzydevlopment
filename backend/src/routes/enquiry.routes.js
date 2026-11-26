const express = require('express');
const router = express.Router();
const enquiryService = require('../services/enquiry.service');
const { submissionLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');

router.post('/', submissionLimiter, async (req, res) => {
  try {
    const result = await enquiryService.submitEnquiry(req.body || {});
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: !!result.duplicate,
      message: 'Enquiry submitted successfully. Our team will contact you shortly.',
      data: result
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
