const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  withdrawalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WithdrawalRequest'
  },
  balance: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

const walletSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingWithdrawals: {
    type: Number,
    default: 0,
    min: 0
  },
  transactions: [transactionSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
walletSchema.index({ seller: 1 });
walletSchema.index({ 'transactions.createdAt': -1 });

// Method to add transaction
walletSchema.methods.addTransaction = function(type, amount, description, orderId = null, withdrawalId = null) {
  const transaction = {
    type,
    amount,
    description,
    orderId,
    withdrawalId,
    balance: this.balance,
    status: 'completed'
  };
  
  this.transactions.push(transaction);
  
  if (type === 'credit') {
    this.balance += amount;
    this.totalEarnings += amount;
  } else if (type === 'debit') {
    this.balance -= amount;
    this.totalWithdrawn += amount;
  }
  
  return this.save();
};

// Method to get transaction history with pagination
walletSchema.methods.getTransactionHistory = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const transactions = this.transactions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + limit);
  
  return {
    transactions,
    total: this.transactions.length,
    page,
    totalPages: Math.ceil(this.transactions.length / limit)
  };
};

// Method to get earnings summary
walletSchema.methods.getEarningsSummary = function() {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYear = new Date(now.getFullYear(), 0, 1);
  
  const monthlyEarnings = this.transactions
    .filter(t => t.type === 'credit' && new Date(t.createdAt) >= thisMonth)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const yearlyEarnings = this.transactions
    .filter(t => t.type === 'credit' && new Date(t.createdAt) >= thisYear)
    .reduce((sum, t) => sum + t.amount, 0);
    
  return {
    currentBalance: this.balance,
    totalEarnings: this.totalEarnings,
    totalWithdrawn: this.totalWithdrawn,
    pendingWithdrawals: this.pendingWithdrawals,
    monthlyEarnings,
    yearlyEarnings
  };
};

module.exports = mongoose.model('Wallet', walletSchema);
