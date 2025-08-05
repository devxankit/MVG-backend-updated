const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const sellerController = require('../controllers/sellerController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Public routes
router.post('/register', sellerController.register);

// Protected routes (seller only)
router.use(protect);
router.use(authorize('seller'));

router.get('/dashboard', sellerController.getDashboard);
router.get('/products', sellerController.getProducts);
router.post('/products', upload.array('images', 5), sellerController.createProduct);
router.put('/products/:id', sellerController.updateProduct);
router.delete('/products/:id', sellerController.deleteProduct);
router.get('/orders', sellerController.getOrders);
router.put('/orders/:id/status', sellerController.updateOrderStatus);
router.get('/stats', sellerController.getStats);
router.put('/products/:id/sold-count', sellerController.updateSoldCount);

module.exports = router; 