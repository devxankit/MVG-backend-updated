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
  const { name, email, phone, avatar } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;
  await user.save();
  const updatedUser = await User.findById(req.user._id).select('-password');
  res.json({ user: updatedUser });
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