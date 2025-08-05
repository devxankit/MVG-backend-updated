const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404, type: 'CastError' };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = { message, statusCode: 400, type: 'DuplicateKeyError', field };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400, type: 'ValidationError' };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401, type: 'JsonWebTokenError' };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401, type: 'TokenExpiredError' };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400, type: 'MulterFileSizeError' };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400, type: 'MulterUnexpectedFileError' };
  }

  // Add route info for easier debugging
  const route = req.originalUrl || req.url;

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    type: error.type || err.name || 'UnknownError',
    route,
    stack: err.stack,
    ...(error.field && { field: error.field })
  });
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler
}; 