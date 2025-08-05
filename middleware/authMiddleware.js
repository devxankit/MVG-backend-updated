const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // console.log('Authorization header:', req.headers.authorization); // Remove for clean server logs

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      // console.log('JWT token received:', token); // Remove for clean server logs

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: 'User account is deactivated' });
      }

      // Attach sellerId if user is a seller
      if (req.user.role === 'seller') {
        const seller = await Seller.findOne({ userId: req.user._id });
        if (seller) req.user.sellerId = seller._id;
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no user' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token is invalid but we don't fail the request
      console.log('Optional auth token invalid:', error.message);
    }
  }

  next();
};

// Check if user is seller and approved
const sellerAuth = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  if (req.user.role !== 'seller') {
    return res.status(403).json({ message: 'Access denied. Seller role required.' });
  }

  // Check if seller is approved (this would require joining with Seller model)
  // For now, we'll assume the check is done in the route handler
  next();
};

// Check if user is admin
const adminAuth = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }

  next();
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  sellerAuth,
  adminAuth
}; 