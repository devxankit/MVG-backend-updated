const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

// All routes are protected
router.use(protect);

router.put('/profile', userController.updateProfile);
router.get('/cart', userController.getCart);
router.post('/cart', userController.addToCart);
router.delete('/cart/:productId', userController.removeFromCart);
router.put('/cart/:productId', userController.updateCartQuantity);
router.get('/wishlist', userController.getWishlist);
router.post('/wishlist/:productId', userController.addToWishlist);
router.delete('/wishlist/:productId', userController.removeFromWishlist);

module.exports = router; 