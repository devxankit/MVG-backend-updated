const User = require('../models/User');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Get user's wishlist
exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  res.json({ wishlist: user.wishlist });
});

// Add product to wishlist
exports.addToWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const productId = req.params.productId;
  if (!user.wishlist.includes(productId)) {
    user.wishlist.push(productId);
    await user.save();
  }
  const updatedUser = await User.findById(req.user._id).populate('wishlist');
  res.json({ wishlist: updatedUser.wishlist });
});

// Remove product from wishlist
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const productId = req.params.productId;
  user.wishlist = user.wishlist.filter(
    (id) => id.toString() !== productId
  );
  await user.save();
  const updatedUser = await User.findById(req.user._id).populate('wishlist');
  res.json({ wishlist: updatedUser.wishlist });
});

// Update user profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: 'User not found', route: req.originalUrl || req.url });
  }

  const { 
    firstName, 
    lastName, 
    email, 
    phone, 
    address, 
    city, 
    state, 
    pincode, 
    country, 
    avatar 
  } = req.body;

  // Prevent email updates for security reasons
  if (email !== undefined && email !== user.email) {
    return res.status(400).json({
      success: false,
      message: 'Email cannot be changed',
      errors: ['Email address cannot be modified for security reasons. Please contact support if you need to change your email.']
    });
  }

  // Update fields if provided (excluding email)
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (city !== undefined) user.city = city;
  if (state !== undefined) user.state = state;
  if (pincode !== undefined) user.pincode = pincode;
  if (country !== undefined) user.country = country;
  if (avatar !== undefined) user.avatar = avatar;

  // Update the main name field if firstName and lastName are provided
  if (firstName && lastName) {
    user.name = `${firstName} ${lastName}`.trim();
  }

  try {
    await user.save();
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json({ 
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    if (error.code === 11000) {
      // Handle duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        errors: [`This ${field} is already registered with another account`]
      });
    }
    throw error;
  }
});

// Get user's cart
exports.getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('cart.product')
    .populate('cart.seller', 'shopName')
    .populate('cart.sellerProduct');
  res.json({ cart: user.cart });
});

// Add product to cart
exports.addToCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { product, seller, sellerProduct, quantity = 1, selectedVariants = {} } = req.body;
  
  // Validate that we have seller information
  if (!seller || !sellerProduct) {
    return res.status(400).json({ 
      message: 'Seller information is required. This product may not be available for purchase.', 
      route: req.originalUrl || req.url 
    });
  }

  const existingItem = user.cart.find(
    (item) =>
      item.product.toString() === product &&
      item.seller.toString() === seller &&
      JSON.stringify(item.selectedVariants || {}) === JSON.stringify(selectedVariants || {})
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    user.cart.push({ product, seller, sellerProduct, quantity, selectedVariants });
  }
  
  await user.save();
  const updatedUser = await User.findById(req.user._id)
    .populate('cart.product')
    .populate('cart.seller', 'shopName')
    .populate('cart.sellerProduct');
  res.json({ cart: updatedUser.cart });
});

// Remove product from cart
exports.removeFromCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const productId = req.params.productId;
  user.cart = user.cart.filter((item) => item.product.toString() !== productId);
  await user.save();
  const updatedUser = await User.findById(req.user._id)
    .populate('cart.product')
    .populate('cart.seller', 'shopName')
    .populate('cart.sellerProduct');
  res.json({ cart: updatedUser.cart });
});

// Update cart item quantity
exports.updateCartQuantity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const productId = req.params.productId;
  const { quantity } = req.body;
  const cartItem = user.cart.find(item => item.product.toString() === productId);
  if (!cartItem) {
    return res.status(404).json({ message: 'Cart item not found', route: req.originalUrl || req.url });
  }
  if (quantity <= 0) {
    user.cart = user.cart.filter(item => item.product.toString() !== productId);
  } else {
    cartItem.quantity = quantity;
  }
  await user.save();
  const updatedUser = await User.findById(req.user._id)
    .populate('cart.product')
    .populate('cart.seller', 'shopName')
    .populate('cart.sellerProduct');
  res.json({ cart: updatedUser.cart });
}); 