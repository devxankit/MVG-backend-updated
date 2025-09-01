// Unit constants and validation for products
const UNITS = {
  KG: 'KG',
  LITER: 'Liter'
};

// Default units based on category names (case-insensitive matching)
const DEFAULT_UNITS_BY_CATEGORY = {
  // Weight-based categories (KG)
  'fruits': UNITS.KG,
  'vegetables': UNITS.KG,
  'grains': UNITS.KG,
  'rice': UNITS.KG,
  'wheat': UNITS.KG,
  'pulses': UNITS.KG,
  'spices': UNITS.KG,
  'dry fruits': UNITS.KG,
  'nuts': UNITS.KG,
  'cereals': UNITS.KG,
  'flour': UNITS.KG,
  'sugar': UNITS.KG,
  'salt': UNITS.KG,
  'tea': UNITS.KG,
  'coffee': UNITS.KG,
  
  // Volume-based categories (Liter)
  'dairy': UNITS.LITER,
  'milk': UNITS.LITER,
  'oil': UNITS.LITER,
  'beverages': UNITS.LITER,
  'juice': UNITS.LITER,
  'water': UNITS.LITER,
  'soda': UNITS.LITER,
  'liquids': UNITS.LITER,
  'cooking oil': UNITS.LITER,
  'edible oil': UNITS.LITER,
  'ghee': UNITS.LITER,
  'butter': UNITS.LITER,
  'cream': UNITS.LITER,
  'yogurt': UNITS.LITER,
  'curd': UNITS.LITER
};

// Get default unit for a category
const getDefaultUnit = (categoryName) => {
  if (!categoryName) return UNITS.KG; // Default fallback
  
  const lowerCategoryName = categoryName.toLowerCase();
  
  // Check for exact matches first
  if (DEFAULT_UNITS_BY_CATEGORY[lowerCategoryName]) {
    return DEFAULT_UNITS_BY_CATEGORY[lowerCategoryName];
  }
  
  // Check for partial matches
  for (const [key, unit] of Object.entries(DEFAULT_UNITS_BY_CATEGORY)) {
    if (lowerCategoryName.includes(key) || key.includes(lowerCategoryName)) {
      return unit;
    }
  }
  
  return UNITS.KG; // Default fallback
};

// Validate unit
const isValidUnit = (unit) => {
  return Object.values(UNITS).includes(unit);
};

// Get unit display format
const formatPriceWithUnit = (price, unit) => {
  if (!price || !unit) return `₹${price}`;
  return `₹${price}/${unit}`;
};

module.exports = {
  UNITS,
  DEFAULT_UNITS_BY_CATEGORY,
  getDefaultUnit,
  isValidUnit,
  formatPriceWithUnit
};
