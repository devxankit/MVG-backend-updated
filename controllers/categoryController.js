const Category = require('../models/Category');
const { asyncHandler } = require('../middleware/errorMiddleware');
const cloudinary = require('../utils/cloudinary');

exports.getCategories = asyncHandler(async (req, res) => {
  try {
    // Fetch all categories as a flat list
    const categories = await Category.find().lean();
    res.json(categories);
  } catch (error) {
    error.type = 'GetCategoriesError';
    throw error;
  }
});

exports.getCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) return res.status(404).json({ message: 'Category not found' });
    // Find subcategories
    const subcategories = await Category.find({ parentCategory: category._id }).lean();
    category.subcategories = subcategories;
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

exports.createCategory = async (req, res) => {
  try {
    let imageUrl = '';
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'categories' }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          stream.end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
      }
    }
    if (!imageUrl) {
      imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1690000000/categories/default-category.png'; // Replace with your own default image URL
    }
    const { name, slug, description, parentCategory, level, isActive, isFeatured, sortOrder, metaTitle, metaDescription } = req.body;
    const category = new Category({
      name,
      slug,
      description,
      image: imageUrl,
      parentCategory,
      level,
      isActive,
      isFeatured,
      sortOrder,
      metaTitle,
      metaDescription
    });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    let imageUrl = category.image;
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'categories' }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          stream.end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
      }
    }
    const { name, slug, description, parentCategory, level, isActive, isFeatured, sortOrder, metaTitle, metaDescription } = req.body;
    category.name = name || category.name;
    category.slug = slug || category.slug;
    category.description = description || category.description;
    category.image = imageUrl;
    category.parentCategory = parentCategory || category.parentCategory;
    category.level = level || category.level;
    category.isActive = isActive !== undefined ? isActive : category.isActive;
    category.isFeatured = isFeatured !== undefined ? isFeatured : category.isFeatured;
    category.sortOrder = sortOrder || category.sortOrder;
    category.metaTitle = metaTitle || category.metaTitle;
    category.metaDescription = metaDescription || category.metaDescription;
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteCategory = asyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    const subcategories = await Category.find({ parentCategory: category._id });
    if (subcategories.length > 0) {
      return res.status(400).json({ message: 'Cannot delete category with subcategories. Please delete subcategories first.' });
    }
    await category.deleteOne();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}); 