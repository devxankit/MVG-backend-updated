const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');
const mongoose = require('mongoose');

// Create Order: Splits cart by seller, creates separate orders for each seller
exports.createOrder = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: 'User not authenticated', route: req.originalUrl || req.url });
  }
  
  console.log('Creating order with data:', req.body);
  
  const { shippingAddress, items, paymentMethod, cardData, coupon, discount, total, orderIdempotencyKey } = req.body;
  const userId = req.user._id;

  // Check for duplicate order using idempotency key
  if (orderIdempotencyKey) {
    const existingOrder = await Order.findOne({ 
      user: userId, 
      orderIdempotencyKey: orderIdempotencyKey,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
    });
    
    if (existingOrder) {
      console.log('Duplicate order prevented:', orderIdempotencyKey);
      return res.status(200).json({ 
        message: 'Order already exists', 
        orders: [existingOrder],
        isDuplicate: true 
      });
    }
  }

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

  // Start database transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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
    // Save order with session
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
      orderIdempotencyKey: orderIdempotencyKey || undefined,
    });
      await order.save({ session });
      createdOrders.push(order);
      console.log(`Order created for seller ${sellerId}:`, order._id);
    } catch (error) {
      console.error(`Error creating order for seller ${sellerId}:`, error);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ 
        message: `Failed to create order: ${error.message}`, 
        route: req.originalUrl || req.url 
      });
    }
  }
  
  // Commit transaction
  await session.commitTransaction();
  session.endSession();
  
  console.log(`Total orders created: ${createdOrders.length}`);
  res.status(201).json({ orders: createdOrders });
  
  } catch (error) {
    // Rollback transaction on any error
    await session.abortTransaction();
    session.endSession();
    console.error('Order creation transaction failed:', error);
    return res.status(500).json({ 
      message: 'Failed to create order due to system error', 
      route: req.originalUrl || req.url 
    });
  }
});

// Create Order for Razorpay (after payment verification)
exports.createOrderForRazorpay = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: 'User not authenticated', route: req.originalUrl || req.url });
  }
  
  console.log('Creating Razorpay order with data:', req.body);
  
  const { shippingAddress, items, paymentMethod, coupon, discount, total, orderIdempotencyKey, razorpay_order_id } = req.body;
  const userId = req.user._id;

  // Check for duplicate order using idempotency key
  if (orderIdempotencyKey) {
    const existingOrder = await Order.findOne({ 
      user: userId, 
      orderIdempotencyKey: orderIdempotencyKey,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
    });
    
    if (existingOrder) {
      console.log('Duplicate order prevented:', orderIdempotencyKey);
      return res.status(200).json({ 
        message: 'Order already exists', 
        orders: [existingOrder],
        isDuplicate: true 
      });
    }
  }

  // Validate required fields
  if (!shippingAddress || !items || !paymentMethod || !razorpay_order_id) {
    return res.status(400).json({ 
      message: 'Missing required fields: shippingAddress, items, paymentMethod, or razorpay_order_id', 
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

  // Start database transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdOrders = [];
    const totalOrderValue = items.reduce((sum, item) => {
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
          await product.save({ session });
          
          return {
            product: product._id,
            name: product.name,
            image: product.images && product.images[0] ? product.images[0].url : '',
            price: sellerProduct.sellerPrice,
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
      
      // Save order with session
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
        paymentMethod: 'razorpay',
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
        orderStatus: 'pending',
        paymentStatus: 'pending',
        shippingStatus: 'pending',
        coupon: coupon || undefined,
        discount: discount || 0,
        orderIdempotencyKey: orderIdempotencyKey || undefined,
        razorpayOrderId: razorpay_order_id,
      });
        await order.save({ session });
        createdOrders.push(order);
        console.log(`Order created for seller ${sellerId}:`, order._id);
      } catch (error) {
        console.error(`Error creating order for seller ${sellerId}:`, error);
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ 
          message: `Failed to create order: ${error.message}`, 
          route: req.originalUrl || req.url 
        });
      }
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    console.log(`Total orders created: ${createdOrders.length}`);
    res.status(201).json({ orders: createdOrders });
    
  } catch (error) {
    // Rollback transaction on any error
    await session.abortTransaction();
    session.endSession();
    console.error('Order creation transaction failed:', error);
    return res.status(500).json({ 
      message: 'Failed to create order due to system error', 
      route: req.originalUrl || req.url 
    });
  }
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
  
  const previousStatus = order.orderStatus;
  order.orderStatus = status;
  
  // If order is delivered and earnings haven't been credited yet
  if (status === 'delivered' && !order.isEarningsCredited) {
    try {
      const Wallet = require('../models/Wallet');
      
      // Calculate seller earnings (total price - commission)
      const commission = order.totalPrice * 0.10; // 10% commission
      const sellerEarnings = order.totalPrice - commission;
      
      // Update order with earnings info
      order.commission = commission;
      order.sellerEarnings = sellerEarnings;
      order.isEarningsCredited = true;
      
      // Find or create seller wallet
      let wallet = await Wallet.findOne({ seller: order.seller });
      if (!wallet) {
        wallet = await Wallet.create({
          seller: order.seller,
          balance: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          pendingWithdrawals: 0,
          transactions: []
        });
      }
      
      // Add earnings to wallet
      await wallet.addTransaction(
        'credit',
        sellerEarnings,
        `Earnings from order ${order.orderNumber}`,
        order._id
      );
      
      console.log(`Earnings credited for order ${order._id}: ₹${sellerEarnings}`);
    } catch (error) {
      console.error('Error crediting earnings:', error);
      // Don't fail the order status update if earnings crediting fails
    }
  }
  
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