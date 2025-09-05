const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');

// All routes are protected
router.use(protect);

// Payment routes should be declared BEFORE dynamic ':id' routes
router.get('/payments/razorpay/key', paymentController.getRazorpayKey);
router.post('/payments/razorpay/order', paymentController.createRazorpayOrder);
router.post('/payments/razorpay/verify', paymentController.verifyRazorpayPayment);
router.post('/payments/razorpay/capture', paymentController.capturePaymentForOrders);

router.post('/', orderController.createOrder);
router.post('/razorpay', orderController.createOrderForRazorpay);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.put('/:id/status', orderController.updateOrderStatus);
router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router; 