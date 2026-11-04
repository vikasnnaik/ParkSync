const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
  console.warn('[Razorpay Warning] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in .env');
}

const razorpay = new Razorpay({
  key_id: key_id || '',
  key_secret: key_secret || ''
});

/**
 * Verify Razorpay payment signature using HMAC SHA256
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return generatedSignature === signature;
};

module.exports = {
  razorpay,
  verifyRazorpaySignature,
  getRazorpayKeyId: () => process.env.RAZORPAY_KEY_ID || ''
};

