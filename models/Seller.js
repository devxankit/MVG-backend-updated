const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'Please provide a business name']
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email']
  },
  isApproved: {
    type: Boolean,
    default: false // Changed to false for admin approval
  },
  approvalDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
sellerSchema.index({ userId: 1 });
sellerSchema.index({ isApproved: 1 });

module.exports = mongoose.model('Seller', sellerSchema); 