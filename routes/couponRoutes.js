const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Vendor: create and manage coupons
router.post('/', protect, authorize('seller'), couponController.createCoupon);
router.get('/', protect, authorize('seller'), couponController.getCoupons);
router.put('/:id/deactivate', protect, authorize('seller'), couponController.deactivateCoupon);

// User: apply coupon
router.post('/apply', protect, couponController.applyCoupon);

module.exports = router; 