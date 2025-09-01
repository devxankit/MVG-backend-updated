const mongoose = require('mongoose');
const { UNITS } = require('../utils/units');

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
  sellerStock: {
    type: Number,
    required: true,
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  unit: {
    type: String,
    enum: {
      values: Object.values(UNITS),
      message: 'Unit must be either KG or Liter'
    },
    default: UNITS.KG
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

// Pre-save middleware to inherit unit and default stock from product
sellerProductSchema.pre('save', async function(next) {
  // If unit is not set, inherit from the product
  if (!this.unit && this.product) {
    try {
      const Product = require('./Product');
      const product = await Product.findById(this.product);
      if (product && product.unit) {
        this.unit = product.unit;
      }
    } catch (error) {
      console.error('Error inheriting unit from product:', error);
    }
  }
  
  // If sellerStock is not set, inherit from the product as default
  if (this.sellerStock === undefined && this.product) {
    try {
      const Product = require('./Product');
      const product = await Product.findById(this.product);
      if (product && product.stock !== undefined) {
        this.sellerStock = product.stock;
      }
    } catch (error) {
      console.error('Error inheriting default stock from product:', error);
    }
  }
  
  next();
});

sellerProductSchema.index({ seller: 1 });
sellerProductSchema.index({ product: 1 });

module.exports = mongoose.model('SellerProduct', sellerProductSchema); 