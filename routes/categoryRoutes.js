const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Public routes
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);

// Admin routes (will be protected in actual implementation)
router.post('/', upload.single('image'), categoryController.createCategory);
router.put('/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router; 