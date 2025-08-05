const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a category name'],
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    required: [true, 'Please provide a category slug'],
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  metaTitle: String,
  metaDescription: String,
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
categorySchema.index({ slug: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ isFeatured: 1 });
categorySchema.index({ sortOrder: 1 });

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Virtual for full path
categorySchema.virtual('fullPath').get(function() {
  if (this.parentCategory) {
    return `${this.parentCategory.name} > ${this.name}`;
  }
  return this.name;
});

// Ensure virtual fields are serialized
categorySchema.set('toJSON', { virtuals: true });

// Pre-save middleware to set level
categorySchema.pre('save', async function(next) {
  if (this.parentCategory) {
    const parent = await this.constructor.findById(this.parentCategory);
    this.level = parent ? parent.level + 1 : 0;
  } else {
    this.level = 0;
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema); 