const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 100 // Minimum withdrawal amount
  },
  bankDetails: {
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    bankName: { type: String },
    branch: { type: String },
    upiId: { type: String },
    walletNumber: { type: String }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processed'],
    default: 'pending'
  },
  adminNotes: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  rejectionReason: String,
  transactionId: String, // External payment transaction ID
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'paytm', 'phonepe'],
    default: 'bank_transfer'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
withdrawalRequestSchema.index({ seller: 1 });
withdrawalRequestSchema.index({ status: 1 });
withdrawalRequestSchema.index({ createdAt: -1 });

// Pre-save middleware to validate amount
withdrawalRequestSchema.pre('save', function(next) {
  if (this.amount < 100) {
    return next(new Error('Minimum withdrawal amount is ₹100'));
  }
  next();
});

// Conditional validation based on payment method
withdrawalRequestSchema.pre('validate', function(next) {
  try {
    const method = this.paymentMethod;
    const details = this.bankDetails || {};
    if (method === 'bank_transfer') {
      if (!details.accountNumber || !details.ifscCode) {
        return next(new Error('Account number and IFSC code are required for bank transfer'));
      }
    } else if (method === 'upi') {
      if (!details.upiId) {
        return next(new Error('UPI ID is required for UPI withdrawals'));
      }
    } else if (method === 'paytm' || method === 'phonepe') {
      if (!details.walletNumber) {
        return next(new Error('Wallet/mobile number is required for this payment method'));
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Method to approve withdrawal
withdrawalRequestSchema.methods.approve = function(adminId, notes = '') {
  this.status = 'approved';
  this.adminNotes = notes;
  this.processedBy = adminId;
  this.processedAt = new Date();
  return this.save();
};

// Method to reject withdrawal
withdrawalRequestSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.processedBy = adminId;
  this.processedAt = new Date();
  return this.save();
};

// Method to mark as processed
withdrawalRequestSchema.methods.markAsProcessed = function(adminId, transactionId) {
  this.status = 'processed';
  this.transactionId = transactionId;
  this.processedBy = adminId;
  this.processedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
