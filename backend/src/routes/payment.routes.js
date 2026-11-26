const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const { submissionLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');

// Public: is online payment available? (no secrets)
router.get('/config', async (req, res, next) => {
  try {
    const cfg = await paymentService.getPublicConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

// Create a payment order for a paid appointment. Amount is taken from the appointment.
router.post('/create-order', submissionLimiter, async (req, res) => {
  try {
    const { appointmentReference } = req.body || {};
    const orderData = await paymentService.createOrderForAppointment({ appointmentReference });
    res.json({ success: true, data: orderData });
  } catch (err) {
    sendError(res, err);
  }
});

// Verify signature from checkout callback
router.post('/verify', submissionLimiter, async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature, orderReference } = req.body || {};
    if (!gatewayOrderId || !gatewayPaymentId) {
      return res.status(400).json({ success: false, message: 'Payment details are missing.' });
    }
    const result = await paymentService.verifyPaymentSignature({
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
      orderReference
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

// Razorpay Webhook
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const result = await paymentService.handleWebhook(rawBody, signature);
    res.json(result);
  } catch (err) {
    console.error('[Payment Webhook Error]:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
