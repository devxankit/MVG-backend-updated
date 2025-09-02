const express = require('express');
const router = express.Router();
const {
  getSellerWallet,
  getTransactionHistory,
  createWithdrawalRequest,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  getAdminWalletOverview,
  getSellerEarningsReport,
  getSellerTransactions,
  // admin tools
  adminResyncSellerWallet,
  adminResyncOrderToWallet
} = require('../controllers/walletController');
const { protect, sellerAuth, adminAuth } = require('../middleware/authMiddleware');

// Seller wallet routes
router.get('/', protect, sellerAuth, getSellerWallet);
router.get('/transactions', protect, sellerAuth, getTransactionHistory);
router.get('/withdrawals', protect, sellerAuth, require('../controllers/walletController').getSellerWithdrawalRequests || ((req,res)=>res.status(500).json({success:false,message:'handler missing'})));
router.post('/withdraw', protect, sellerAuth, createWithdrawalRequest);

// Admin wallet routes
router.get('/admin/overview', protect, adminAuth, getAdminWalletOverview);
router.get('/admin/sellers', protect, adminAuth, getSellerEarningsReport);
router.get('/admin/seller/:sellerId/transactions', protect, adminAuth, getSellerTransactions);
router.get('/admin/withdrawals', protect, adminAuth, getWithdrawalRequests);
router.put('/admin/withdrawals/:id/approve', protect, adminAuth, approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', protect, adminAuth, rejectWithdrawal);
router.put('/admin/withdrawals/:id/process', protect, adminAuth, processWithdrawal);

// Admin maintenance routes
router.post('/admin/resync/seller/:sellerId', protect, adminAuth, adminResyncSellerWallet);
router.post('/admin/resync/order/:orderId', protect, adminAuth, adminResyncOrderToWallet);
// Recompute wallet from orders+withdrawals
router.post('/admin/recompute/seller/:sellerId', protect, adminAuth, async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const ctrl = require('../controllers/walletController');
    const wallet = await ctrl.__unsafeInternalRecompute(sellerId);
    res.json({ success: true, wallet });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
