const express = require('express');
const router = express.Router();
const { register, login, getMe, forgotPassword, resetPassword, verifyEmail } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router; 