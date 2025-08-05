const mongoose = require('mongoose');

const sellerProductSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sellerPrice: {
    type: Number,
    required: true
  },
  isListed: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDiscover: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

sellerProductSchema.index({ seller: 1 });
sellerProductSchema.index({ product: 1 });

module.exports = mongoose.model('SellerProduct', sellerProductSchema); 