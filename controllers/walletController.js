const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Order = require('../models/Order');
const Seller = require('../models/Seller');
const asyncHandler = require('express-async-handler');

// Helper: recompute wallet from authoritative sources (orders + withdrawals)
async function recomputeWalletForSeller(sellerId) {
  // Compute desired state entirely in-memory, then persist with an atomic update
  const existing = await Wallet.findOne({ seller: sellerId });

  const deliveredOrders = await Order.find({ seller: sellerId, orderStatus: 'delivered' })
    .sort({ createdAt: 1 })
    .select('totalPrice orderNumber commission sellerEarnings');

  const withdrawals = await WithdrawalRequest.find({ seller: sellerId })
    .sort({ createdAt: 1 })
    .select('amount status _id createdAt processedAt');

  const transactions = [];
  let runningBalance = 0;
  let totalEarnings = 0;
  let totalWithdrawn = 0;
  let pendingWithdrawals = 0;

  // Credit earnings for delivered orders (unique per order)
  for (const order of deliveredOrders) {
    const commission = order.commission && order.commission > 0 ? order.commission : order.totalPrice * 0.10;
    const sellerEarnings = order.sellerEarnings && order.sellerEarnings > 0 ? order.sellerEarnings : order.totalPrice - commission;
    runningBalance += sellerEarnings;
    totalEarnings += sellerEarnings;
    transactions.push({
      type: 'credit',
      amount: sellerEarnings,
      description: `Earnings from order ${order.orderNumber}`,
      orderId: order._id,
      withdrawalId: null,
      balance: runningBalance,
      status: 'completed'
    });
  }

  // Apply withdrawals
  for (const wr of withdrawals) {
    if (wr.status === 'pending' || wr.status === 'approved') {
      runningBalance -= wr.amount;
      pendingWithdrawals += wr.amount;
      transactions.push({
        type: 'debit',
        amount: wr.amount,
        description: 'Withdrawal request created',
        orderId: null,
        withdrawalId: wr._id,
        balance: runningBalance,
        status: 'pending'
      });
    } else if (wr.status === 'rejected') {
      // Simulate initial pending debit then refund credit to make history coherent
      runningBalance -= wr.amount;
      transactions.push({
        type: 'debit',
        amount: wr.amount,
        description: 'Withdrawal request created',
        orderId: null,
        withdrawalId: wr._id,
        balance: runningBalance,
        status: 'pending'
      });
      runningBalance += wr.amount;
      transactions.push({
        type: 'credit',
        amount: wr.amount,
        description: 'Withdrawal request rejected - amount refunded',
        orderId: null,
        withdrawalId: wr._id,
        balance: runningBalance,
        status: 'completed'
      });
    } else if (wr.status === 'processed') {
      runningBalance -= wr.amount;
      totalWithdrawn += wr.amount;
      transactions.push({
        type: 'debit',
        amount: wr.amount,
        description: 'Withdrawal processed',
        orderId: null,
        withdrawalId: wr._id,
        balance: runningBalance,
        status: 'completed'
      });
    }
  }

  // Atomic upsert to avoid VersionError from concurrent requests
  await Wallet.updateOne(
    { seller: sellerId },
    {
      $set: {
        seller: sellerId,
        transactions,
        balance: runningBalance,
        totalEarnings,
        totalWithdrawn,
        pendingWithdrawals
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return await Wallet.findOne({ seller: sellerId });
}

// @desc    Get seller wallet details
// @route   GET /api/wallet
// @access  Private (Seller)
const getSellerWallet = asyncHandler(async (req, res) => {
  const sellerId = req.user.sellerId;
  if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
    return res.status(401).json({ success: false, message: 'Seller identity not found' });
  }

  // Always recompute on open to guarantee dynamic accuracy
  await recomputeWalletForSeller(sellerId);
  let wallet = await Wallet.findOne({ seller: sellerId })
    .populate('seller', 'businessName email')
    .populate('transactions.orderId', 'orderNumber totalPrice')
    .populate('transactions.withdrawalId', 'amount status');

  if (!wallet) {
    wallet = await Wallet.create({
      seller: sellerId,
      balance: 0,
      totalEarnings: 0,
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
      transactions: []
    });
  }

  // After recompute, reload for response
  wallet = await Wallet.findOne({ seller: sellerId })
    .populate('seller', 'businessName email')
    .populate('transactions.orderId', 'orderNumber totalPrice')
    .populate('transactions.withdrawalId', 'amount status');

  // Re-load wallet to include any new transactions added during backfill
  wallet = await Wallet.findOne({ seller: sellerId })
    .populate('seller', 'businessName email')
    .populate('transactions.orderId', 'orderNumber totalPrice')
    .populate('transactions.withdrawalId', 'amount status');

  const earningsSummary = wallet.getEarningsSummary();

  res.json({
    success: true,
    data: {
      wallet,
      earningsSummary
    }
  });
});

// Admin-only: resync wallet for a specific seller (backfill credits for delivered orders)
const adminResyncSellerWallet = asyncHandler(async (req, res) => {
  const { sellerId } = req.params;
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return res.status(404).json({ success: false, message: 'Seller not found' });
  }

  let wallet = await Wallet.findOne({ seller: sellerId });
  if (!wallet) {
    wallet = await Wallet.create({ seller: sellerId });
  }

  // Reuse same backfill logic as getSellerWallet
  const deliveredOrders = await Order.find({ seller: sellerId, orderStatus: 'delivered' })
    .select('totalPrice orderNumber commission sellerEarnings isEarningsCredited');

  const creditedOrderIdSet = new Set(
    (wallet.transactions || [])
      .filter(t => t && t.type === 'credit' && t.orderId)
      .map(t => String(t.orderId?._id || t.orderId))
  );

  let creditedCount = 0;
  for (const order of deliveredOrders) {
    const alreadyCredited = creditedOrderIdSet.has(String(order._id));
    if (alreadyCredited) {
      if (!order.isEarningsCredited) {
        order.isEarningsCredited = true;
        await order.save();
      }
      continue;
    }
    const commission = order.commission && order.commission > 0 ? order.commission : order.totalPrice * 0.10;
    const sellerEarnings = order.sellerEarnings && order.sellerEarnings > 0 ? order.sellerEarnings : order.totalPrice - commission;
    order.commission = commission;
    order.sellerEarnings = sellerEarnings;
    order.isEarningsCredited = true;
    await order.save();
    await wallet.addTransaction('credit', sellerEarnings, `Earnings from order ${order.orderNumber}`, order._id);
    creditedCount += 1;
  }

  wallet = await Wallet.findOne({ seller: sellerId });
  return res.json({ success: true, message: 'Wallet resynced', creditedCount, wallet });
});

// Admin-only: resync a single order to wallet
const adminResyncOrderToWallet = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.orderStatus !== 'delivered') {
    return res.status(400).json({ success: false, message: 'Order is not delivered' });
  }
  let wallet = await Wallet.findOne({ seller: order.seller });
  if (!wallet) wallet = await Wallet.create({ seller: order.seller });

  const alreadyCredited = (wallet.transactions || []).some(
    t => t && t.type === 'credit' && String(t.orderId?._id || t.orderId) === String(order._id)
  );
  if (alreadyCredited) {
    if (!order.isEarningsCredited) {
      order.isEarningsCredited = true;
      await order.save();
    }
    return res.json({ success: true, message: 'Order already credited', wallet });
  }

  const commission = order.commission && order.commission > 0 ? order.commission : order.totalPrice * 0.10;
  const sellerEarnings = order.sellerEarnings && order.sellerEarnings > 0 ? order.sellerEarnings : order.totalPrice - commission;
  order.commission = commission;
  order.sellerEarnings = sellerEarnings;
  order.isEarningsCredited = true;
  await order.save();
  await wallet.addTransaction('credit', sellerEarnings, `Earnings from order ${order.orderNumber}`, order._id);
  wallet = await Wallet.findOne({ seller: order.seller });
  return res.json({ success: true, message: 'Order credited to wallet', wallet });
});

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private (Seller)
const getTransactionHistory = asyncHandler(async (req, res) => {
  const sellerId = req.user.sellerId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  // Ensure wallet reflects current orders/withdrawals before serving history
  await recomputeWalletForSeller(sellerId);
  const wallet = await Wallet.findOne({ seller: sellerId });
  
  if (!wallet) {
    res.status(404);
    throw new Error('Wallet not found');
  }
  
  const transactionHistory = wallet.getTransactionHistory(page, limit);
  
  // Populate order and withdrawal details
  const populatedTransactions = await Promise.all(
    transactionHistory.transactions.map(async (transaction) => {
      const populated = transaction.toObject ? transaction.toObject() : { ...transaction };
      
      if (transaction.orderId) {
        const order = await Order.findById(transaction.orderId).select('orderNumber totalPrice');
        populated.order = order;
      }
      
      if (transaction.withdrawalId) {
        const withdrawal = await WithdrawalRequest.findById(transaction.withdrawalId).select('amount status');
        populated.withdrawal = withdrawal;
      }
      
      return populated;
    })
  );
  
  res.json({
    success: true,
    data: {
      ...transactionHistory,
      transactions: populatedTransactions
    }
  });
});

// @desc    Get seller's withdrawal requests
// @route   GET /api/wallet/withdrawals
// @access  Private (Seller)
const getSellerWithdrawalRequests = asyncHandler(async (req, res) => {
  const sellerId = req.user.sellerId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { seller: sellerId };
  const withdrawals = await WithdrawalRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await WithdrawalRequest.countDocuments(filter);

  res.json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Create withdrawal request
// @route   POST /api/wallet/withdraw
// @access  Private (Seller)
const createWithdrawalRequest = asyncHandler(async (req, res) => {
  const sellerId = req.user.sellerId;
  const { amount, bankDetails, paymentMethod } = req.body;
  
  if (amount < 100) {
    res.status(400);
    throw new Error('Minimum withdrawal amount is ₹100');
  }
  
  // Check if seller has sufficient balance
  const wallet = await Wallet.findOne({ seller: sellerId });
  if (!wallet || wallet.balance < amount) {
    res.status(400);
    throw new Error('Insufficient balance');
  }
  
  // Check if there are pending withdrawals
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({
    seller: sellerId,
    status: 'pending'
  });
  
  if (pendingWithdrawals > 0) {
    res.status(400);
    throw new Error('You already have a pending withdrawal request');
  }
  
  // Create withdrawal request
  const withdrawalRequest = await WithdrawalRequest.create({
    seller: sellerId,
    amount,
    bankDetails,
    paymentMethod
  });
  
  // Move funds from available balance to pending withdrawals
  wallet.pendingWithdrawals += amount;
  wallet.balance -= amount;
  
  // Push a pending debit transaction without influencing totalWithdrawn/totalEarnings
  wallet.transactions.push({
    type: 'debit',
    amount,
    description: 'Withdrawal request created',
    orderId: null,
    withdrawalId: withdrawalRequest._id,
    balance: wallet.balance,
    status: 'pending'
  });

  await wallet.save();
  
  res.status(201).json({
    success: true,
    message: 'Withdrawal request created successfully',
    data: withdrawalRequest
  });
});

// @desc    Get withdrawal requests (Admin)
// @route   GET /api/admin/wallet/withdrawals
// @access  Private (Admin)
const getWithdrawalRequests = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  
  const filter = {};
  if (status) filter.status = status;
  
  const skip = (page - 1) * limit;
  
  const withdrawals = await WithdrawalRequest.find(filter)
    .populate('seller', 'businessName email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await WithdrawalRequest.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

// @desc    Approve withdrawal request (Admin)
// @route   PUT /api/admin/wallet/withdrawals/:id/approve
// @access  Private (Admin)
const approveWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const adminId = req.user.id;
  
  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    res.status(404);
    throw new Error('Withdrawal request not found');
  }
  
  if (withdrawal.status !== 'pending') {
    res.status(400);
    throw new Error('Withdrawal request is not pending');
  }
  
  await withdrawal.approve(adminId, notes);
  
  res.json({
    success: true,
    message: 'Withdrawal request approved successfully',
    data: withdrawal
  });
});

// @desc    Reject withdrawal request (Admin)
// @route   PUT /api/admin/wallet/withdrawals/:id/reject
// @access  Private (Admin)
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;
  
  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    res.status(404);
    throw new Error('Withdrawal request not found');
  }
  
  if (withdrawal.status !== 'pending') {
    res.status(400);
    throw new Error('Withdrawal request is not pending');
  }
  
  await withdrawal.reject(adminId, reason);

  // Refund the amount back to seller's wallet (do not count as earnings)
  const wallet = await Wallet.findOne({ seller: withdrawal.seller });
  if (wallet) {
    wallet.pendingWithdrawals -= withdrawal.amount;
    wallet.balance += withdrawal.amount;

    wallet.transactions.push({
      type: 'credit',
      amount: withdrawal.amount,
      description: 'Withdrawal request rejected - amount refunded',
      orderId: null,
      withdrawalId: withdrawal._id,
      balance: wallet.balance,
      status: 'completed'
    });

    await wallet.save();
  }
  
  res.json({
    success: true,
    message: 'Withdrawal request rejected successfully',
    data: withdrawal
  });
});

// @desc    Mark withdrawal as processed (Admin)
// @route   PUT /api/admin/wallet/withdrawals/:id/process
// @access  Private (Admin)
const processWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { transactionId } = req.body;
  const adminId = req.user.id;
  
  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    res.status(404);
    throw new Error('Withdrawal request not found');
  }
  
  if (withdrawal.status !== 'approved') {
    res.status(400);
    throw new Error('Withdrawal request must be approved first');
  }
  
  await withdrawal.markAsProcessed(adminId, transactionId);

  const wallet = await Wallet.findOne({ seller: withdrawal.seller });
  if (wallet) {
    // Reduce pending and increase total withdrawn
    wallet.pendingWithdrawals -= withdrawal.amount;
    wallet.totalWithdrawn += withdrawal.amount;

    // Mark the related pending debit transaction as completed if found
    const tx = wallet.transactions
      .slice() // copy
      .reverse()
      .find(t => String(t.withdrawalId) === String(withdrawal._id) && t.type === 'debit' && t.status === 'pending');
    if (tx) {
      tx.status = 'completed';
    } else {
      // Fallback: record a new completed debit transaction
      wallet.transactions.push({
        type: 'debit',
        amount: withdrawal.amount,
        description: 'Withdrawal processed',
        orderId: null,
        withdrawalId: withdrawal._id,
        balance: wallet.balance, // balance does not change on processing
        status: 'completed'
      });
    }

    await wallet.save();
  }
  
  res.json({
    success: true,
    message: 'Withdrawal marked as processed successfully',
    data: withdrawal
  });
});

// @desc    Get admin wallet overview
// @route   GET /api/admin/wallet/overview
// @access  Private (Admin)
const getAdminWalletOverview = asyncHandler(async (req, res) => {
  const totalSellers = await Seller.countDocuments({ isApproved: true });
  const totalWithdrawals = await WithdrawalRequest.countDocuments();
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: 'pending' });
  const approvedWithdrawals = await WithdrawalRequest.countDocuments({ status: 'approved' });
  const processedWithdrawals = await WithdrawalRequest.countDocuments({ status: 'processed' });
  
  // Calculate total amounts
  const totalWithdrawalAmount = await WithdrawalRequest.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  const pendingAmount = await WithdrawalRequest.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  const approvedAmount = await WithdrawalRequest.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  const processedAmount = await WithdrawalRequest.aggregate([
    { $match: { status: 'processed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  res.json({
    success: true,
    data: {
      totalSellers,
      totalWithdrawals,
      pendingWithdrawals,
      approvedWithdrawals,
      processedWithdrawals,
      totalWithdrawalAmount: totalWithdrawalAmount[0]?.total || 0,
      pendingAmount: pendingAmount[0]?.total || 0,
      approvedAmount: approvedAmount[0]?.total || 0,
      processedAmount: processedAmount[0]?.total || 0,
      // Platform earnings (commission sum) + charts
      ...(await (async () => {
        const ordersCommission = await Order.aggregate([
          { $match: { orderStatus: 'delivered' } },
          { $group: { _id: null, totalCommission: { $sum: { $ifNull: ['$commission', { $multiply: ['$totalPrice', 0.10] }] } }, totalSales: { $sum: '$totalPrice' } } }
        ]);
        const platformEarnings = ordersCommission[0]?.totalCommission || 0;
        const grossSales = ordersCommission[0]?.totalSales || 0;

        // Monthly platform earnings (last 6 months)
        const monthly = await Order.aggregate([
          { $match: { orderStatus: 'delivered' } },
          { $group: { 
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            commission: { $sum: { $ifNull: ['$commission', { $multiply: ['$totalPrice', 0.10] }] } },
            sales: { $sum: '$totalPrice' }
          } },
          { $sort: { '_id.y': 1, '_id.m': 1 } },
          { $limit: 12 }
        ]);
        return { platformEarnings, grossSales, monthly };
      })())
    }
  });
});

// @desc    Get seller earnings report (Admin)
// @route   GET /api/admin/wallet/sellers
// @access  Private (Admin)
const getSellerEarningsReport = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const wallets = await Wallet.find()
    .populate('seller', 'businessName email phone isApproved')
    .sort({ totalEarnings: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await Wallet.countDocuments();
  
  res.json({
    success: true,
    data: {
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

module.exports = {
  getSellerWallet,
  getTransactionHistory,
  createWithdrawalRequest,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  getAdminWalletOverview,
  getSellerEarningsReport,
  adminResyncSellerWallet,
  adminResyncOrderToWallet,
  // expose for maintenance route
  __unsafeInternalRecompute: recomputeWalletForSeller,
  getSellerWithdrawalRequests
};
