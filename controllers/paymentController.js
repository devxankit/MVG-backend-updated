const crypto = require('crypto');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getRazorpayInstance } = require('../utils/razorpay');
const Order = require('../models/Order');

// Public key endpoint
exports.getRazorpayKey = asyncHandler(async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) return res.status(500).json({ message: 'Razorpay key not configured' });
  res.json({ key: keyId });
});

// Create a Razorpay order for the total amount (in paise)
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', receipt, notes } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  const instance = getRazorpayInstance();

  const options = {
    amount: Math.round(amount), // amount expected in paise by Razorpay
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes: {
      ...(notes || {}),
      userId: req.user?._id?.toString() || 'guest',
    },
  };

  try {
    const order = await instance.orders.create(options);
    return res.status(201).json({ order });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return res.status(502).json({ message: 'Failed to initialize payment' });
  }
});

// Verify payment signature from Razorpay checkout
exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification fields' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const hmac = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid = hmac === razorpay_signature;
  if (!isValid) {
    return res.status(400).json({ message: 'Payment signature verification failed' });
  }

  return res.status(200).json({ verified: true });
});

// Confirm and attach payment to orders (after verification), then mark paid
exports.capturePaymentForOrders = asyncHandler(async (req, res) => {
  const {
    orderIds = [],
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ message: 'orderIds is required' });
  }
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment fields' });
  }

  // Verify signature again on server side for safety
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const hmac = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (hmac !== razorpay_signature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  const orders = await Order.find({ _id: { $in: orderIds } });
  if (orders.length !== orderIds.length) {
    return res.status(404).json({ message: 'Some orders not found' });
  }

  // Ensure all orders belong to the current user
  const userIdStr = req.user?._id?.toString();
  const allOwned = orders.every(o => o.user?.toString() === userIdStr);
  if (!allOwned) {
    return res.status(403).json({ message: 'You are not authorized to pay for these orders' });
  }

  const totalAmountPaise = Math.round(
    orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0) * 100
  );

  // Capture payment with Razorpay to ensure funds are secured
  try {
    const instance = getRazorpayInstance();
    // Validate against Razorpay order amount
    const rpOrder = await instance.orders.fetch(razorpay_order_id);
    if (!rpOrder) {
      return res.status(400).json({ message: 'Razorpay order not found' });
    }
    const amountDiff = Math.abs((rpOrder.amount || 0) - totalAmountPaise);
    if (amountDiff > 2) {
      return res.status(400).json({ message: 'Payment amount mismatch' });
    }
    await instance.payments.capture(razorpay_payment_id, totalAmountPaise, 'INR');
  } catch (err) {
    console.error('Razorpay capture failed:', err);
    return res.status(502).json({ message: 'Failed to capture payment' });
  }

  // Update orders with payment info
  for (const order of orders) {
    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.paymentMethod = 'razorpay';
    order.paymentResult = {
      id: razorpay_payment_id,
      status: 'captured',
      update_time: new Date().toISOString(),
      email_address: req.user?.email || '',
      razorpay_order_id,
      razorpay_signature,
    };
    await order.save();
  }

  res.status(200).json({ success: true, orders });
});


