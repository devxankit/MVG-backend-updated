const Razorpay = require('razorpay');

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

module.exports = { getRazorpayInstance };


