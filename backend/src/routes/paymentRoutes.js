const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Razorpay Public Config for Checkout (returns Key ID)
router.get('/config/razorpay', requireAuth, paymentController.getRazorpayConfig);

// Razorpay Order Creation & Verification
router.post('/create-order', requireAuth, paymentController.createRazorpayOrder);
router.post('/verify', requireAuth, paymentController.verifyRazorpayPayment);
router.post('/failure', requireAuth, paymentController.handlePaymentFailure);

// General Payments & Audits
router.get('/', requireAuth, paymentController.getPayments);
router.get('/audit', requireAuth, requireRole('ADMIN'), paymentController.getPaymentAuditLogs);
router.get('/:id', requireAuth, paymentController.getPaymentById);

// Fallback Demo payment route
router.post('/:id/pay', requireAuth, paymentController.processDemoPayment);

module.exports = router;
