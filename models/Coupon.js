const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  discount: {
    type: Number,
    required: true,
    min: 1
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  expiry: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: 1
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

couponSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', couponSchema); 