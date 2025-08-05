# Multi-Vendor E-commerce Platform (Amazon Clone)



checking git connection 

A comprehensive multi-vendor e-commerce platform built with the MERN stack, featuring role-based access control for customers, sellers, and administrators.

## 🚀 Features

### For Customers
- User registration and authentication
- Product browsing and search with filters
- Shopping cart and wishlist management
- Secure checkout process with payment integration
- Order tracking and history
- Product reviews and ratings
- Real-time notifications

### For Sellers
- Seller registration with admin approval
- Product management (add, edit, delete)
- Order management and status updates
- Sales analytics and reports
- Inventory management
- Customer communication tools

### For Administrators
- Comprehensive admin dashboard
- User and seller management
- Product approval system
- Order management across all vendors
- Analytics and reporting
- Category and brand management

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Nodemailer** - Email services
- **Multer** - File uploads
- **Cloudinary** - Image hosting
- **Stripe** - Payment gateway

### Frontend
- **React.js** - UI library
- **React Router DOM** - Routing
- **Redux Toolkit** - State management
- **Axios** - HTTP client
- **React Icons** - Iconography
- **Tailwind CSS** - Styling

## 📁 Project Structure

```
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── sellerController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Seller.js
│   │   ├── Product.js
│   │   ├── Category.js
│   │   └── Order.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── productRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── sellerRoutes.js
│   │   ├── adminRoutes.js
│   │   └── categoryRoutes.js
│   ├── utils/
│   │   ├── generateToken.js
│   │   └── sendEmail.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── redux/
│   │   ├── api/
│   │   └── styles/
│   └── package.json
└── README.md
```

