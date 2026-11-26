const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const enquiryRoutes = require('./enquiry.routes');
const clinicalRoutes = require('./clinical.routes');
const careerRoutes = require('./career.routes');
const schedulingRoutes = require('./scheduling.routes');
const appointmentRoutes = require('./appointment.routes');
const contentRoutes = require('./content.routes');
const paymentRoutes = require('./payment.routes');
const mediaRoutes = require('./media.routes');
const adminRoutes = require('./admin.routes');
const shopRoutes = require('./shop.routes');
const customerRoutes = require('./customer.routes');
const offerRoutes = require('./offer.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'spouzy-api'
  });
});

// Public API routes
router.use('/auth', authRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/clinical-applications', clinicalRoutes);
router.use('/careers', careerRoutes);
router.use('/career-applications', careerRoutes); // Alias for direct POST
router.use('/scheduling', schedulingRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/content', contentRoutes);
router.use('/payments', paymentRoutes);
router.use('/media', mediaRoutes);

// Admin API routes (protected)
router.use('/packages', shopRoutes);
router.use('/offers', offerRoutes);
router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
