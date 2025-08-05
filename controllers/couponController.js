const Coupon = require('../models/Coupon');
const Seller = require('../models/Seller');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Vendor: Create a coupon
exports.createCoupon = asyncHandler(async (req, res) => {
  const { code, discount, expiry, usageLimit } = req.body;
  const coupon = new Coupon({
    code,
    discount,
    vendor: req.user._id,
    expiry,
    usageLimit
  });
  await coupon.save();
  res.status(201).json(coupon);
});

// Vendor: Get all coupons
exports.getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({ vendor: req.user._id });
  res.json(coupons);
});

// User: Apply a coupon code
exports.applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) {
    return res.status(404).json({ message: 'Invalid or expired coupon', route: req.originalUrl || req.url });
  }
  if (coupon.expiry < new Date()) {
    return res.status(400).json({ message: 'Coupon expired', route: req.originalUrl || req.url });
  }
  if (coupon.usageLimit && coupon.usedBy.length >= coupon.usageLimit) {
    return res.status(400).json({ message: 'Coupon usage limit reached', route: req.originalUrl || req.url });
  }
  if (coupon.usedBy.includes(req.user._id)) {
    return res.status(400).json({ message: 'You have already used this coupon', route: req.originalUrl || req.url });
  }
  res.json({ discount: coupon.discount, couponId: coupon._id });
});

// Vendor: Deactivate a coupon
exports.deactivateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findOne({ _id: req.params.id, vendor: req.user._id });
  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found', route: req.originalUrl || req.url });
  }
  coupon.isActive = false;
  await coupon.save();
  res.json({ message: 'Coupon deactivated' });
}); 