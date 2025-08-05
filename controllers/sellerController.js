const Seller = require('../models/Seller');
const User = require('../models/User');
const Product = require('../models/Product');
const cloudinary = require('../utils/cloudinary');
const Category = require('../models/Category');
const mongoose = require('mongoose');

// Register a new seller (vendor request)
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, businessName } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    // Create new user with role 'customer' initially (will be changed to 'seller' after approval)
    user = await User.create({
      name,
      email,
      password,
      role: 'customer', // Start as customer, will be upgraded to seller after approval
      phone
    });

    // Create seller request
    const seller = new Seller({
      userId: user._id,
      businessName: businessName || '', // Optional field
      phone,
      email,
      isApproved: false // Pending admin approval
    });
    await seller.save();

    // Generate token for immediate login
    const generateToken = require('../utils/generateToken');
    const token = generateToken(user._id);

    res.status(201).json({ 
      message: 'Vendor registration submitted successfully. You can use the website as a regular user while waiting for admin approval.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Seller registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Placeholder: Get seller dashboard
exports.getDashboard = (req, res) => {
  res.json({ message: 'Get seller dashboard' });
};

// Get all products for the current seller
exports.getProducts = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    const products = await Product.find({ seller: seller._id });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new product for the current seller

// exports.createProduct = async (req, res) => {
//   try {
//     const seller = await Seller.findOne({ userId: req.user._id });
//     if (!seller) return res.status(404).json({ message: 'Seller not found' });

//     let imageUrls = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         try {
//           const uploadResult = await new Promise((resolve, reject) => {
//             const stream = cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
//               if (error) return reject(error);
//               resolve(result);
//             });
//             stream.end(file.buffer);
//           });
//           imageUrls.push({ url: uploadResult.secure_url });
//         } catch (uploadError) {
//           console.error('Image upload failed:', uploadError);
//           return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
//         }
//       }
//     }
//     // Fallback to default image if no image uploaded
//     if (imageUrls.length === 0) {
//       imageUrls = [{ url: 'https://res.cloudinary.com/demo/image/upload/v1690000000/products/default-product.png' }];
//     }

//     let categoryId = req.body.category;
//     if (req.body.customCategory) {
//       // Create a new category if customCategory is provided
//       const slug = req.body.customCategory.toLowerCase().replace(/\s+/g, '-');
//       let category = await Category.findOne({ slug });
//       if (!category) {
//         category = await Category.create({ name: req.body.customCategory, slug });
//       }
//       categoryId = category._id;
//     }

//     // Parse and convert fields
//     const {
//       name, description, shortDescription, price, comparePrice, subCategory, brand, sku, stock, lowStockThreshold, weight, dimensions, variants, tags, shippingInfo, seo
//     } = req.body;

//     // Convert numeric fields
//     const priceNum = price ? Number(price) : undefined;
//     const comparePriceNum = comparePrice ? Number(comparePrice) : undefined;
//     const stockNum = stock ? Number(stock) : undefined;
//     const lowStockThresholdNum = lowStockThreshold ? Number(lowStockThreshold) : undefined;
//     const weightNum = weight ? Number(weight) : undefined;

//     // Parse features and specifications
//     let featuresArr = [];
//     if (req.body.features) {
//       featuresArr = typeof req.body.features === 'string'
//         ? req.body.features.split(',').map(f => f.trim()).filter(Boolean)
//         : req.body.features;
//     }
//     let specificationsArr = [];
//     if (req.body.specifications) {
//       try {
//         specificationsArr = typeof req.body.specifications === 'string'
//           ? JSON.parse(req.body.specifications)
//           : req.body.specifications;
//       } catch (e) {
//         specificationsArr = [];
//       }
//     }

//     // Parse category and subCategory as ObjectId
//     let subCategoryId = req.body.subCategory;
//     if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
//       return res.status(400).json({ message: 'Invalid category ID' });
//     }
//     if (subCategoryId && !mongoose.Types.ObjectId.isValid(subCategoryId)) {
//       return res.status(400).json({ message: 'Invalid subCategory ID' });
//     }

//     // Parse variants if present
//     let variantsArr = [];
//     if (variants) {
//       try {
//         variantsArr = typeof variants === 'string' ? JSON.parse(variants) : variants;
//       } catch (e) {
//         variantsArr = [];
//       }
//     }

//     const product = new Product({
//       name,
//       description,
//       shortDescription,
//       price: priceNum,
//       comparePrice: comparePriceNum,
//       images: imageUrls,
//       category: categoryId,
//       subCategory: subCategoryId,
//       brand,
//       seller: seller._id,
//       sku,
//       stock: stockNum,
//       lowStockThreshold: lowStockThresholdNum,
//       weight: weightNum,
//       dimensions,
//       variants: variantsArr,
//       specifications: specificationsArr,
//       features: featuresArr,
//       tags,
//       shippingInfo,
//       seo,
//       isActive: true,
//       isApproved: false // Admin approval required
//     });
//     await product.save();
//     res.status(201).json(product);
//   } catch (error) {
//     console.error('Product creation error:', error);
//     if (error.code === 11000 && error.keyPattern && error.keyPattern.sku) {
//       return res.status(400).json({ message: 'SKU must be unique. A product with this SKU already exists.' });
//     }
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({ message: error.message, errors: error.errors });
//     }
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// exports.createProduct = async (req, res) => {
//   try {
//     const seller = await Seller.findOne({ userId: req.user._id });
//     if (!seller) return res.status(404).json({ message: 'Seller not found' });

//     // Image handling (optional – fallback image if nothing uploaded)
//     let imageUrls = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         try {
//           const uploadResult = await new Promise((resolve, reject) => {
//             const stream = cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
//               if (error) return reject(error);
//               resolve(result);
//             });
//             stream.end(file.buffer);
//           });
//           imageUrls.push({ url: uploadResult.secure_url });
//         } catch (uploadError) {
//           console.error('Image upload failed:', uploadError);
//           return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
//         }
//       }
//     }

//     // Fallback image
//     if (imageUrls.length === 0) {
//       imageUrls = [{ url: 'https://res.cloudinary.com/demo/image/upload/v1690000000/products/default-product.png' }];
//     }

//     // Handle category
//     let categoryId = req.body.category;
//     if (req.body.customCategory) {
//       const slug = req.body.customCategory.toLowerCase().replace(/\s+/g, '-');
//       let category = await Category.findOne({ slug });
//       if (!category) {
//         category = await Category.create({ name: req.body.customCategory, slug });
//       }
//       categoryId = category._id;
//     }

//     // Validate category and subCategory IDs
//     if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
//       return res.status(400).json({ message: 'Invalid category ID' });
//     }

//     const subCategoryId = req.body.subCategory;
//     if (subCategoryId && !mongoose.Types.ObjectId.isValid(subCategoryId)) {
//       return res.status(400).json({ message: 'Invalid subCategory ID' });
//     }

//     // Required fields
//     const { name, price } = req.body;

//     if (!name || !price || !categoryId || !subCategoryId) {
//       return res.status(400).json({ message: 'Name, price, category, and subCategory are required.' });
//     }

//     const priceNum = Number(price);
//     if (isNaN(priceNum)) {
//       return res.status(400).json({ message: 'Price must be a number.' });
//     }

//     const product = new Product({
//       name,
//       price: priceNum,
//       images: imageUrls,
//       category: categoryId,
//       subCategory: subCategoryId,
//       seller: seller._id,
//       isActive: true,
//       isApproved: false, // Requires admin approval
//     });

//     await product.save();
//     res.status(201).json(product);
//   } catch (error) {
//     console.error('Product creation error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

exports.createProduct = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const { name, price, category, subCategory } = req.body;

    if (!name || !price || !category || !subCategory) {
      return res.status(400).json({ message: 'Name, price, category, and subCategory are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(subCategory)) {
      return res.status(400).json({ message: 'Invalid subCategory ID' });
    }

    // Image optional
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          stream.end(file.buffer);
        });
        imageUrls.push({ url: uploadResult.secure_url });
      }
    }

    // Add fallback image
    if (imageUrls.length === 0) {
      imageUrls = [{ url: 'https://res.cloudinary.com/demo/image/upload/v1690000000/products/default-product.png' }];
    }

    const product = new Product({
      name,
      price: Number(price),
      images: imageUrls,
      category,
      subCategory,
      seller: seller._id,
      isActive: true,
      isApproved: false,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating simple product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    const product = await Product.findOne({ _id: req.params.id, seller: seller._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let imageUrl = product.images && product.images[0] ? product.images[0].url : '';
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'products' }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          if (!req.file.buffer) return reject(new Error('No file buffer found in req.file'));
          stream.end(req.file.buffer);
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
      }
    }

    // Parse fields from req.body
    const {
      name, description, shortDescription, price, comparePrice, category, subCategory, brand, sku, stock, lowStockThreshold, weight, dimensions, variants, tags, shippingInfo, seo, features, specifications
    } = req.body;

    // Parse features and specifications
    let featuresArr = [];
    if (features) {
      featuresArr = typeof features === 'string' ? features.split(',').map(f => f.trim()).filter(Boolean) : features;
    }
    let specificationsArr = [];
    if (specifications) {
      try {
        specificationsArr = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
      } catch (e) {
        specificationsArr = [];
      }
    }

    // Update product fields
    product.name = name;
    product.description = description;
    product.shortDescription = shortDescription;
    product.price = price;
    product.comparePrice = comparePrice;
    product.images = imageUrl ? [{ url: imageUrl }] : product.images;
    product.category = category;
    product.subCategory = subCategory;
    product.brand = brand;
    product.sku = sku;
    product.stock = stock;
    product.lowStockThreshold = lowStockThreshold;
    product.weight = weight;
    product.dimensions = dimensions;
    product.variants = variants;
    product.specifications = specificationsArr;
    product.features = featuresArr;
    product.tags = tags;
    product.shippingInfo = shippingInfo;
    product.seo = seo;

    await product.save();
    res.json(product);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message, errors: error.errors });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a product for the current seller
exports.deleteProduct = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    const product = await Product.findOneAndDelete({ _id: req.params.id, seller: seller._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update sold count for a product (seller only)
exports.updateSoldCount = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });
    const product = await Product.findOne({ _id: req.params.id, seller: seller._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const { soldCount } = req.body;
    if (typeof soldCount !== 'number' || soldCount < 0) {
      return res.status(400).json({ message: 'Invalid soldCount value' });
    }
    product.soldCount = soldCount;
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Placeholder: Get seller orders
exports.getOrders = (req, res) => {
  res.json({ message: 'Get seller orders' });
};

// Placeholder: Update order status
exports.updateOrderStatus = (req, res) => {
  res.json({ message: 'Update order status' });
};

// Get seller stats (dashboard)
exports.getStats = async (req, res) => {
  try {
    // Find seller by user
    const seller = await Seller.findOne({ userId: req.user._id });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    // Get all products for this seller
    const products = await Product.find({ seller: seller._id });
    const productIds = products.map(p => p._id);

    // Get all orders for this seller
    const Order = require('../models/Order');
    const orders = await Order.find({ seller: seller._id });

    // Total sales (sum of totalPrice for delivered orders)
    const totalSales = orders
      .filter(o => o.orderStatus === 'delivered')
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Total orders (all orders for this seller)
    const totalOrders = orders.length;

    // Total products
    const totalProducts = products.length;

    // Total unique customers
    const uniqueCustomerIds = new Set(orders.map(o => String(o.user)));
    const totalCustomers = uniqueCustomerIds.size;

    res.json({
      totalSales,
      totalOrders,
      totalProducts,
      totalCustomers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 