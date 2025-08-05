const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const couponRoutes = require('./routes/couponRoutes');
const translateRoutes = require('./routes/translateRoutes');

// Import middleware
const { errorHandler } = require('./middleware/errorMiddleware');

// Import database connection
const connectDB = require('./config/db');

// Initialize express app
const app = express();




// raihan sir cors code
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});


// CORS configuration - must be at the top and explicit for local dev
// const allowedOrigins = [
//   'http://localhost:3000',
//   'https://mv-store.vercel.app',
//   'https://mv-store-ram312908-gmailcoms-projects.vercel.app'
// ];

// Add FRONTEND_URL_PRODUCTION if it exists
// if (process.env.FRONTEND_URL_PRODUCTION) {
//   allowedOrigins.push(process.env.FRONTEND_URL_PRODUCTION);
// }


// More permissive CORS for production debugging
// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin) {
//       console.log('Request with no origin - allowing');
//       return callback(null, true);
//     }
    
   
    // For production, be more permissive during debugging
//     if (process.env.NODE_ENV === 'production') {
//       console.log('Production mode - allowing all origins for debugging');
//       return callback(null, true);
//     }
    
//     if (allowedOrigins.indexOf(origin) !== -1) {
//       console.log('Origin allowed:', origin);
//       callback(null, true);
//     } else {
//       console.log('Origin blocked:', origin);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // strict in production
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);
} else {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // very high for dev
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);
}

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/translate', translateRoutes);

// Test route to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    cors: 'CORS should be working'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// Timeout middleware: respond with 503 if request takes too long
app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(503).json({ message: 'Server timeout, please try again.' });
    }
  });
  next();
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Optionally: alert admin, log to file, etc.
  // Do NOT shut down the server automatically!
});

module.exports = app; 