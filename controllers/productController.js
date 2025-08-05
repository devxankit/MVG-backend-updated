const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorMiddleware');
const EventBanner = require('../models/EventBanner');
const SellerProduct = require('../models/SellerProduct');

// Get all products (public)
exports.getProducts = asyncHandler(async (req, res) => {
  // Only return products that have a seller (i.e., are public)
  const products = await Product.find({ seller: { $ne: null } })
    .populate('category', 'name')
    .populate('subCategory', 'name');
  res.json(products);
});

// Get all products with seller information for frontend (including SellerProduct data)
exports.getProductsWithSellerInfo = asyncHandler(async (req, res) => {
  try {
    // Get all products that have sellers
    const products = await Product.find({ seller: { $ne: null } })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .populate('seller', 'shopName');

    // Get all active seller listings
    const sellerProducts = await SellerProduct.find({ isListed: true })
      .populate('seller', 'shopName')
      .populate('product');

    // Create a map of product ID to seller products
    const sellerProductMap = {};
    sellerProducts.forEach(sp => {
      if (!sellerProductMap[sp.product._id]) {
        sellerProductMap[sp.product._id] = [];
      }
      sellerProductMap[sp.product._id].push(sp);
    });

    // Enhance products with seller information
    const enhancedProducts = products.map(product => {
      const productObj = product.toObject();
      const sellerListings = sellerProductMap[product._id] || [];
      
      // If there are seller listings, use the lowest price
      if (sellerListings.length > 0) {
        const lowestPriceListing = sellerListings.reduce((lowest, current) => 
          current.sellerPrice < lowest.sellerPrice ? current : lowest
        );
        productObj.sellerPrice = lowestPriceListing.sellerPrice;
        productObj.seller = lowestPriceListing.seller;
        productObj.sellerProductId = lowestPriceListing._id;
      }
      
      return productObj;
    });

    res.json(enhancedProducts);
  } catch (error) {
    console.error('Error in getProductsWithSellerInfo:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});

// Get product by ID with seller information
exports.getProductWithSellerInfo = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .populate('seller', 'shopName');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
    }

    // Get seller listings for this product
    const sellerProducts = await SellerProduct.find({ 
      product: req.params.id, 
      isListed: true 
    }).populate('seller', 'shopName');

    const productData = product.toObject();
    productData.totalStock = product.getTotalStock();
    productData.priceRange = product.getPriceRange();
    productData.availableVariants = product.getAvailableVariants();
    productData.soldCount = product.soldCount;

    // If there are seller listings, use the lowest price
    if (sellerProducts.length > 0) {
      const lowestPriceListing = sellerProducts.reduce((lowest, current) => 
        current.sellerPrice < lowest.sellerPrice ? current : lowest
      );
      productData.sellerPrice = lowestPriceListing.sellerPrice;
      productData.seller = lowestPriceListing.seller;
      productData.sellerProductId = lowestPriceListing._id;
      productData.availableSellers = sellerProducts.map(sp => ({
        seller: sp.seller,
        price: sp.sellerPrice,
        sellerProductId: sp._id
      }));
    }

    res.json(productData);
  } catch (error) {
    console.error('Error in getProductWithSellerInfo:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

// Get product by ID
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .populate('seller', 'shopName');
  
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }

  // Add variant information to the response
  const productData = product.toObject();
  productData.totalStock = product.getTotalStock();
  productData.priceRange = product.getPriceRange();
  productData.availableVariants = product.getAvailableVariants();
  // Ensure soldCount is present
  productData.soldCount = product.soldCount;
  res.json(productData);
});

// Get product variant by combination
exports.getProductVariant = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { variantCombination } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }

  const variant = product.getVariantByCombination(variantCombination);
  if (!variant) {
    return res.status(404).json({ message: 'Variant not found', route: req.originalUrl || req.url });
  }

  res.json(variant);
});

// Get featured products
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ updatedAt: -1 })
      .limit(8);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch featured products', error: error.message });
  }
};

// Placeholder: Search products
exports.searchProducts = asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length === 0) {
    return res.json([]);
  }
  // Case-insensitive search in name or description
  const products = await Product.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ]
  })
    .sort({ numReviews: -1 })
    .limit(8)
    .select('_id name price images numReviews');
  res.json(products);
});

// Get products by category (public)
exports.getProductsByCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.categoryId;
  // Only return products that have a seller (i.e., are public)
  const products = await Product.find({
    $and: [
      { seller: { $ne: null } },
      { $or: [ { category: categoryId }, { subCategory: categoryId } ] }
    ]
  })
    .populate('category', 'name')
    .populate('subCategory', 'name');
  res.json(products);
});

// Add review to product
exports.addReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }
  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );
  if (alreadyReviewed) {
    return res.status(400).json({ message: 'Product already reviewed by this user', route: req.originalUrl || req.url });
  }
  const { rating, comment } = req.body;
  if (!rating || !comment) {
    return res.status(400).json({ message: 'Rating and comment are required', route: req.originalUrl || req.url });
  }
  const review = {
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
    isVerified: false
  };
  product.reviews.push(review);
  product.numReviews = product.reviews.length;
  product.ratings =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;
  await product.save();
  res.status(201).json({ message: 'Review added', reviews: product.reviews });
});

// Admin: Approve product
exports.approveProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isApproved = true;
  product.approvalDate = new Date();
  product.approvedBy = req.user._id;
  product.rejectionReason = '';
  await product.save();
  res.json(product);
});

// Admin: Reject product
exports.rejectProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isApproved = false;
  product.rejectionReason = req.body.reason || 'Rejected by admin';
  product.approvedBy = req.user._id;
  await product.save();
  res.json(product);
});

// Admin: Edit product
exports.adminEditProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  Object.assign(product, req.body);
  await product.save();
  res.json(product);
});

// Admin: Delete product
exports.adminDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  res.json({ message: 'Product deleted' });
});

exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .populate('seller', 'shopName');
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  res.json(product);
});

// Get all reviews for a product
exports.getReviewsForProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select('reviews');
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }
  res.json(product.reviews);
});

// Get all reviews for a vendor's products
exports.getReviewsForVendor = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.params.vendorId }).select('name reviews');
  if (!products || products.length === 0) {
    return res.status(404).json({ message: 'No products found for this vendor', route: req.originalUrl || req.url });
  }
  const allReviews = products.flatMap(product =>
    product.reviews.map(review => ({
      ...review.toObject(),
      productId: product._id,
      productName: product.name
    }))
  );
  res.json(allReviews);
});

// Update a user's review for a product
exports.updateReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  const review = product.reviews.find(r => r.user.toString() === req.user._id.toString());
  if (!review) return res.status(404).json({ message: 'Review not found', route: req.originalUrl || req.url });
  if (review.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this review', route: req.originalUrl || req.url });
  }
  const { rating, comment } = req.body;
  if (rating) review.rating = rating;
  if (comment) review.comment = comment;
  await product.save();
  res.json({ message: 'Review updated', review });
});

// Delete a user's review for a product
exports.deleteReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  const reviewIndex = product.reviews.findIndex(r => r.user.toString() === req.user._id.toString());
  if (reviewIndex === -1) return res.status(404).json({ message: 'Review not found', route: req.originalUrl || req.url });
  product.reviews.splice(reviewIndex, 1);
  await product.save();
  res.json({ message: 'Review deleted' });
});

// Add variant to product (Seller only)
exports.addVariant = asyncHandler(async (req, res) => {
  console.log('Add variant request:', {
    productId: req.params.id,
    userId: req.user._id,
    userRole: req.user.role,
    userEmail: req.user.email
  });

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }

  console.log('Product found:', {
    productId: product._id,
    productSeller: product.seller,
    requestUserId: req.user._id,
    isOwner: product.seller.toString() === req.user._id.toString()
  });

  // Find the seller record for this user
  const Seller = require('../models/Seller');
  const seller = await Seller.findOne({ userId: req.user._id });
  
  console.log('Seller lookup:', {
    userId: req.user._id,
    sellerFound: !!seller,
    sellerId: seller ? seller._id : null,
    sellerApproved: seller ? seller.isApproved : null
  });
  
  if (!seller) {
    return res.status(403).json({ 
      message: 'Seller profile not found', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller is approved
  if (!seller.isApproved) {
    return res.status(403).json({ 
      message: 'Your seller account is not approved yet. Please wait for admin approval.', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller owns this product
  if (product.seller.toString() !== seller._id.toString()) {
    return res.status(403).json({ 
      message: 'Not authorized to modify this product', 
      route: req.originalUrl || req.url,
      productSeller: product.seller.toString(),
      sellerId: seller._id.toString()
    });
  }

  const { variantName, options } = req.body;

  if (!variantName || !options || !Array.isArray(options)) {
    return res.status(400).json({ message: 'Variant name and options array are required', route: req.originalUrl || req.url });
  }

  // Check if variant already exists
  const existingVariant = product.variants.find(v => v.name === variantName);
  if (existingVariant) {
    return res.status(400).json({ message: 'Variant with this name already exists', route: req.originalUrl || req.url });
  }

  // Validate options
  for (const option of options) {
    if (!option.value || !option.price || !option.sku) {
      return res.status(400).json({ message: 'Each option must have value, price, and SKU', route: req.originalUrl || req.url });
    }
    // Validate images (optional)
    if (option.images && !Array.isArray(option.images)) {
      return res.status(400).json({ message: 'Images must be an array', route: req.originalUrl || req.url });
    }
    // Validate specifications (optional)
    if (option.specifications && !Array.isArray(option.specifications)) {
      return res.status(400).json({ message: 'Specifications must be an array', route: req.originalUrl || req.url });
    }
  }

  // Check for duplicate SKUs
  const skus = options.map(opt => opt.sku);
  const duplicateSku = skus.find((sku, index) => skus.indexOf(sku) !== index);
  if (duplicateSku) {
    return res.status(400).json({ message: 'Duplicate SKU found', route: req.originalUrl || req.url });
  }

  product.variants.push({
    name: variantName,
    options: options
  });

  await product.save();
  res.status(201).json({ message: 'Variant added successfully', product });
});

// Update variant option (Seller only)
exports.updateVariantOption = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }

  // Find the seller record for this user
  const Seller = require('../models/Seller');
  const seller = await Seller.findOne({ userId: req.user._id });
  
  if (!seller) {
    return res.status(403).json({ 
      message: 'Seller profile not found', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller is approved
  if (!seller.isApproved) {
    return res.status(403).json({ 
      message: 'Your seller account is not approved yet. Please wait for admin approval.', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller owns this product
  if (product.seller.toString() !== seller._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to modify this product', route: req.originalUrl || req.url });
  }

  const { variantName, optionValue, updates } = req.body;

  const variant = product.variants.find(v => v.name === variantName);
  if (!variant) {
    return res.status(404).json({ message: 'Variant not found', route: req.originalUrl || req.url });
  }

  const option = variant.options.find(opt => opt.value === optionValue);
  if (!option) {
    return res.status(404).json({ message: 'Option not found', route: req.originalUrl || req.url });
  }

  // Update the option
  Object.assign(option, updates);
  await product.save();

  res.json({ message: 'Variant option updated successfully', option });
});

// Delete variant option (Seller only)
exports.deleteVariantOption = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  }

  // Find the seller record for this user
  const Seller = require('../models/Seller');
  const seller = await Seller.findOne({ userId: req.user._id });
  
  if (!seller) {
    return res.status(403).json({ 
      message: 'Seller profile not found', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller is approved
  if (!seller.isApproved) {
    return res.status(403).json({ 
      message: 'Your seller account is not approved yet. Please wait for admin approval.', 
      route: req.originalUrl || req.url 
    });
  }

  // Check if seller owns this product
  if (product.seller.toString() !== seller._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to modify this product', route: req.originalUrl || req.url });
  }

  const { variantName, optionValue } = req.body;

  const variant = product.variants.find(v => v.name === variantName);
  if (!variant) {
    return res.status(404).json({ message: 'Variant not found', route: req.originalUrl || req.url });
  }

  const optionIndex = variant.options.findIndex(opt => opt.value === optionValue);
  if (optionIndex === -1) {
    return res.status(404).json({ message: 'Option not found', route: req.originalUrl || req.url });
  }

  variant.options.splice(optionIndex, 1);

  // If no options left, remove the entire variant group
  if (variant.options.length === 0) {
    product.variants = product.variants.filter(v => v.name !== variantName);
  }
  await product.save();

  res.json({ message: 'Variant option deleted successfully' });
});

// Upload image for a variant option
exports.uploadVariantOptionImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const cloudinary = require('../utils/cloudinary');
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'products/variants' }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      if (!req.file.buffer) return reject(new Error('No file buffer found in req.file'));
      stream.end(req.file.buffer);
    });
    res.json({ url: uploadResult.secure_url });
  } catch (error) {
    res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
};

// Admin: Set product as featured
exports.setFeaturedProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can feature products' });
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.isFeatured = true;
  await product.save();
  res.json({ message: 'Product marked as featured', product });
};

// Admin: Unset product as featured
exports.unsetFeaturedProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can unfeature products' });
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.isFeatured = false;
  await product.save();
  res.json({ message: 'Product unfeatured', product });
};

// Admin: Set product as event product
exports.setEventProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can set event product' });
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.isEventProduct = true;
  await product.save();
  res.json({ message: 'Product marked as event product', product });
};

// Admin: Unset product as event product
exports.unsetEventProduct = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can unset event product' });
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.isEventProduct = false;
  await product.save();
  res.json({ message: 'Product unmarked as event product', product });
};

// Admin: Create or update event banner
exports.createOrUpdateEventBanner = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can manage event banner' });
  }
  const { title, description, endDate, product } = req.body;
  let eventBanner = await EventBanner.findOne();
  if (eventBanner) {
    eventBanner.title = title;
    eventBanner.description = description;
    eventBanner.endDate = endDate;
    eventBanner.product = product;
    await eventBanner.save();
  } else {
    eventBanner = await EventBanner.create({ title, description, endDate, product });
  }
  res.json(eventBanner);
};

// Public: Get event banner
exports.getEventBanner = async (req, res) => {
  const eventBanner = await EventBanner.findOne({ isActive: true }).populate('product');
  if (!eventBanner) return res.json(null);
  res.json(eventBanner);
};

// Admin: Delete event banner
exports.deleteEventBanner = async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin can delete event banner' });
  }
  const eventBanner = await EventBanner.findOne();
  if (!eventBanner) return res.status(404).json({ message: 'No event banner found' });
  // Unset isEventProduct on the associated product
  if (eventBanner.product) {
    await Product.findByIdAndUpdate(eventBanner.product, { isEventProduct: false });
  }
  await eventBanner.deleteOne();
  res.json({ message: 'Event banner deleted' });
}; 

// Get discover products
exports.getDiscoverProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDiscover: true, isApproved: true })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ updatedAt: -1 })
      .limit(8);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch discover products', error: error.message });
  }
};

// Get recommended products
exports.getRecommendedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isRecommended: true, isApproved: true })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ updatedAt: -1 })
      .limit(8);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recommended products', error: error.message });
  }
};

// Admin: Set/unset discover product
exports.setDiscoverProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isDiscover = true;
  await product.save();
  res.json(product);
};
exports.unsetDiscoverProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isDiscover = false;
  await product.save();
  res.json(product);
};

// Admin: Set/unset recommended product
exports.setRecommendedProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isRecommended = true;
  await product.save();
  res.json(product);
};
exports.unsetRecommendedProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found', route: req.originalUrl || req.url });
  product.isRecommended = false;
  await product.save();
  res.json(product);
}; 

exports.createProductBySellerSimple = async (req, res) => {
  const { name, price, category, subCategory } = req.body;
  const product = await Product.create({ name, price, category, subCategory });
  res.json(product);
};


//     // Get seller from logged-in user
//     const seller = await Seller.findOne({ userId: req.user._id });
//     if (!seller) {
//       return res.status(403).json({ message: 'Seller account not found' });
//     }

//     // Create product with default values for missing fields
//     const product = await Product.create({
//       name,
//       price,
//       category,
//       subCategory,
//       seller: seller._id,
//       description: 'Default description',
//       brand: 'No Brand',
//       stock: 10,
//       sku: 'SKU-' + Date.now()
//     });

//     res.status(201).json({
//       success: true,
//       message: 'Product created successfully',
//       product
//     });
//   } catch (error) {
//     console.error('Create product error:', error.message);
//     res.status(500).json({ success: false, message: 'Server Error', error: error.message });
//   }
// };

// Seller: List a product (create SellerProduct)
exports.sellerListProduct = async (req, res) => {
  try {
    const { productId, sellerPrice } = req.body;
    const sellerId = req.user.sellerId || req.user._id; // adapt as needed
    // Prevent duplicate listing
    const existing = await SellerProduct.findOne({ seller: sellerId, product: productId });
    if (existing && existing.isListed) {
      return res.status(400).json({ message: 'Product already listed by seller' });
    }
    let sellerProduct;
    if (existing) {
      existing.sellerPrice = sellerPrice;
      existing.isListed = true;
      await existing.save();
      sellerProduct = existing;
    } else {
      sellerProduct = await SellerProduct.create({ seller: sellerId, product: productId, sellerPrice });
    }
    res.status(201).json(sellerProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Seller: Update price
exports.sellerUpdatePrice = async (req, res) => {
  try {
    const { sellerProductId, sellerPrice } = req.body;
    const sellerId = req.user.sellerId || req.user._id;
    const sellerProduct = await SellerProduct.findOne({ _id: sellerProductId, seller: sellerId });
    if (!sellerProduct) return res.status(404).json({ message: 'Listing not found' });
    sellerProduct.sellerPrice = sellerPrice;
    await sellerProduct.save();
    res.json(sellerProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Seller: Unlist product
exports.sellerUnlistProduct = async (req, res) => {
  try {
    const { sellerProductId } = req.body;
    const sellerId = req.user.sellerId || req.user._id;
    const sellerProduct = await SellerProduct.findOne({ _id: sellerProductId, seller: sellerId });
    if (!sellerProduct) return res.status(404).json({ message: 'Listing not found' });
    sellerProduct.isListed = false;
    await sellerProduct.save();
    res.json({ message: 'Product unlisted', sellerProduct });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Seller: Get all their listings
exports.sellerGetListings = async (req, res) => {
  try {
    const sellerId = req.user.sellerId || req.user._id;
    const listings = await SellerProduct.find({ seller: sellerId }).populate('product');
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Admin: Get all seller listings
exports.adminGetAllSellerListings = async (req, res) => {
  try {
    const listings = await SellerProduct.find().populate('seller').populate('product');
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Cascade delete SellerProduct when Product is deleted
const origDeleteProduct = exports.adminDeleteProduct;
exports.adminDeleteProduct = async function(req, res) {
  const productId = req.params.id;
  await SellerProduct.deleteMany({ product: productId });
  return origDeleteProduct.apply(this, arguments);
};

// Get admin products (for seller selection)
exports.getAdminProducts = asyncHandler(async (req, res) => {
  // Only return products that have no seller (admin templates)
  const products = await Product.find({ seller: null })
    .populate('category', 'name')
    .populate('subCategory', 'name');
  res.json(products);
});

// Get all seller listings (public)
exports.getAllSellerListings = asyncHandler(async (req, res) => {
  // Only return listings that are active/listed
  const listings = await SellerProduct.find({ isListed: true })
    .populate('product')
    .populate('seller');
  res.json(listings);
});

// Feature/unfeature SellerProduct
exports.featureSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isFeatured = true;
  await sellerProduct.save();
  res.json(sellerProduct);
};
exports.unfeatureSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isFeatured = false;
  await sellerProduct.save();
  res.json(sellerProduct);
};
// Discover/undiscover SellerProduct
exports.discoverSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isDiscover = true;
  await sellerProduct.save();
  res.json(sellerProduct);
};
exports.undiscoverSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isDiscover = false;
  await sellerProduct.save();
  res.json(sellerProduct);
};
// Recommend/unrecommend SellerProduct
exports.recommendSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isRecommended = true;
  await sellerProduct.save();
  res.json(sellerProduct);
};
exports.unrecommendSellerProduct = async (req, res) => {
  const sellerProduct = await SellerProduct.findById(req.params.id);
  if (!sellerProduct) return res.status(404).json({ message: 'Seller listing not found' });
  sellerProduct.isRecommended = false;
  await sellerProduct.save();
  res.json(sellerProduct);
};