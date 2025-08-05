const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/sellers', adminController.getSellers);
router.put('/sellers/:id/approve', adminController.approveSeller);
router.put('/sellers/:id/reject', adminController.rejectSeller);
router.get('/products', adminController.getProducts);
router.post('/create-product', upload.array('images', 5), adminController.createProductByAdmin);
router.put('/products/:id/approve', adminController.approveProduct);
router.put('/products/:id/reject', adminController.rejectProduct);
router.get('/orders', adminController.getOrders);
router.get('/analytics', adminController.getAnalytics);

module.exports = router; 
 