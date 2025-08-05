const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Create Order: Splits cart by seller, creates separate orders for each seller
exports.createOrder = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: 'User not authenticated', route: req.originalUrl || req.url });
  }
  
  console.log('Creating order with data:', req.body);
  
  const { shippingAddress, items, paymentMethod, cardData, coupon, discount, total } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!shippingAddress || !items || !paymentMethod) {
    return res.status(400).json({ 
      message: 'Missing required fields: shippingAddress, items, or paymentMethod', 
      route: req.originalUrl || req.url 
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ 
      message: 'Items must be a non-empty array', 
      route: req.originalUrl || req.url 
    });
  }

  // Group items by seller
  const itemsBySeller = {};
  for (const item of items) {
    if (!item.product || !item.seller) {
      return res.status(400).json({ message: 'Product or seller missing in order item.', route: req.originalUrl || req.url });
    }
    
    // Validate product and seller IDs
    if (typeof item.product !== 'string' || item.product.length !== 24) {
      return res.status(400).json({ message: 'Invalid product ID format.', route: req.originalUrl || req.url });
    }
    
    if (typeof item.seller !== 'string' || item.seller.length !== 24) {
      return res.status(400).json({ message: 'Invalid seller ID format.', route: req.originalUrl || req.url });
    }
    
    if (!itemsBySeller[item.seller]) itemsBySeller[item.seller] = [];
    itemsBySeller[item.seller].push(item);
  }

  const createdOrders = [];
  const totalOrderValue = items.reduce((sum, item) => {
    // We need to calculate the total value to distribute discount proportionally
    return sum + (item.price * item.quantity);
  }, 0);
  
  for (const sellerId of Object.keys(itemsBySeller)) {
    const sellerItems = itemsBySeller[sellerId];
    
    try {
      // Fetch product details for each item
      const orderItems = await Promise.all(sellerItems.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) {
          const error = new Error(`Product not found: ${item.product}`);
          error.type = 'OrderProductNotFound';
          throw error;
        }
        
        // Get seller product information
        const SellerProduct = require('../models/SellerProduct');
        const sellerProduct = await SellerProduct.findById(item.sellerProduct);
        if (!sellerProduct) {
          const error = new Error(`Seller product not found: ${item.sellerProduct}`);
          error.type = 'OrderSellerProductNotFound';
          throw error;
        }
        
        // Validate seller matches
        if (sellerProduct.seller.toString() !== sellerId) {
          const error = new Error(`Seller mismatch for product ${product._id}`);
          error.type = 'OrderSellerMismatch';
          throw error;
        }
        
        // Increment totalSold for the product
        product.totalSold = (product.totalSold || 0) + item.quantity;
        await product.save();
        
        return {
          product: product._id,
          name: product.name,
          image: product.images && product.images[0] ? product.images[0].url : '',
          price: sellerProduct.sellerPrice, // Use seller's price
          quantity: item.quantity,
          sku: product.sku || '',
        };
      }));
    
    // Calculate totals for this seller's order
    const itemsPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shippingPrice = 0;
    const taxPrice = 0;
    
    // Distribute discount proportionally based on order value
    const sellerDiscount = totalOrderValue > 0 ? (discount || 0) * (itemsPrice / totalOrderValue) : 0;
    const totalPrice = itemsPrice + shippingPrice + taxPrice - sellerDiscount;
    // Save order
    const order = new Order({
      user: userId,
      seller: sellerId,
      orderItems,
      shippingAddress: {
        type: shippingAddress.type || 'home',
        firstName: shippingAddress.firstName || '',
        lastName: shippingAddress.lastName || '',
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        country: shippingAddress.country,
        phone: shippingAddress.phone || '',
      },
      paymentMethod: paymentMethod === 'cod' ? 'cod' : paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      shippingStatus: 'pending',
      coupon: coupon || undefined,
      discount: discount || 0,
    });
      await order.save();
      createdOrders.push(order);
      console.log(`Order created for seller ${sellerId}:`, order._id);
    } catch (error) {
      console.error(`Error creating order for seller ${sellerId}:`, error);
      return res.status(500).json({ 
        message: `Failed to create order: ${error.message}`, 
        route: req.originalUrl || req.url 
      });
    }
  }
  
  console.log(`Total orders created: ${createdOrders.length}`);
  res.status(201).json({ orders: createdOrders });
});

// Get Orders: For user or seller
exports.getOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const isSeller = req.query.seller === 'true' || req.user.role === 'seller';
  let orders;
  if (isSeller) {
    // Seller: fetch orders for this seller
    const sellerDoc = await Seller.findOne({ userId: userId });
    if (!sellerDoc) return res.json({ orders: [] });
    orders = await Order.find({ seller: sellerDoc._id })
      .populate('user', 'firstName lastName email')
      .populate('orderItems.product', 'name');
  } else {
    // User: fetch orders placed by this user
    orders = await Order.find({ user: userId })
      .populate('seller', 'shopName')
      .populate('orderItems.product', 'name');
  }
  res.json({ orders });
});

// Get single order by ID
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .populate('seller', 'shopName')
    .populate('orderItems.product', 'name');
  if (!order) return res.status(404).json({ message: 'Order not found', route: req.originalUrl || req.url });
  res.json(order);
});

// Update order status (for seller)
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', route: req.originalUrl || req.url });
  order.orderStatus = status;
  await order.save();
  res.json(order);
});

// Cancel order
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found', route: req.originalUrl || req.url });
  order.orderStatus = 'cancelled';
  order.cancelledAt = new Date();
  order.cancellationReason = req.body.reason || '';
  order.cancelledBy = req.user._id;
  await order.save();
  res.json(order);
}); 