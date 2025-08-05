const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

// All routes are protected
router.use(protect);

router.post('/', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.put('/:id/status', orderController.updateOrderStatus);
router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router; 