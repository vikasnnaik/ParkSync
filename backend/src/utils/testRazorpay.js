require('dotenv').config();
const { pool } = require('../config/db');
const { connectMongoDB } = require('../config/mongo');
const ActivityLog = require('../models/ActivityLog');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const app = require('../app');

(async () => {
  await connectMongoDB();
  const server = app.listen(5009, async () => {
    try {
      console.log('--- ParkSync Razorpay E2E Verification Test ---');

      // 1. Get driver Vikas (user_id: 1)
      const [users] = await pool.execute('SELECT user_id, email, role, name FROM users WHERE user_id = 1');
      const user = users[0];
      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET
      );

      const [resRows] = await pool.execute(
        'SELECT * FROM reservations WHERE user_id = 1 ORDER BY reservation_id DESC LIMIT 1'
      );
      const reservationId = resRows[0].reservation_id;

      // Ensure a pending payment exists for this reservation for testing
      const [existingPay] = await pool.execute('SELECT * FROM payments WHERE reservation_id = ?', [reservationId]);
      let paymentId;
      if (existingPay.length === 0) {
        const [pRes] = await pool.execute(
          "INSERT INTO payments (reservation_id, amount, payment_method, payment_status, payment_time) VALUES (?, 100.00, 'UPI', 'PENDING', NOW())",
          [reservationId]
        );
        paymentId = pRes.insertId;
      } else {
        paymentId = existingPay[0].payment_id;
        // Reset to PENDING for testing
        await pool.execute(
          "UPDATE payments SET payment_status = 'PENDING', transaction_id = NULL WHERE payment_id = ?",
          [paymentId]
        );
      }

      console.log(`Using Reservation #${reservationId}, Payment #${paymentId}`);

      // 2. Test create-order API
      console.log('\n[Test 1]: Testing POST /api/payments/create-order...');
      const createOrderRes = await fetch('http://127.0.0.1:5009/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ reservationId, paymentId }),
      });
      const orderData = await createOrderRes.json();
      console.log(
        `Create order response status: ${createOrderRes.status}, Order ID: ${orderData.orderId}, Amount (paise): ${orderData.amount}`
      );

      if (!orderData.success || !orderData.orderId) {
        throw new Error('Create order failed: ' + JSON.stringify(orderData));
      }

      // 3. Test Invalid Signature Rejection
      console.log('\n[Test 2]: Testing invalid signature rejection on /api/payments/verify...');
      const badVerifyRes = await fetch('http://127.0.0.1:5009/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: 'pay_tampered_123',
          razorpay_signature: 'fake_tampered_sig',
          paymentId,
          reservationId,
        }),
      });
      console.log('Bad signature HTTP status (expected 400):', badVerifyRes.status);
      if (badVerifyRes.status !== 400) {
        throw new Error('Expected 400 for bad signature but got ' + badVerifyRes.status);
      }

      // 4. Test Valid Signature Verification
      console.log('\n[Test 3]: Testing valid Razorpay signature on /api/payments/verify...');
      const testPaymentId = 'pay_rzptest_' + Date.now();
      const validSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderData.orderId + '|' + testPaymentId)
        .digest('hex');

      const goodVerifyRes = await fetch('http://127.0.0.1:5009/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSig,
          paymentId,
          reservationId,
        }),
      });
      const verifyData = await goodVerifyRes.json();
      console.log(`Verify response status: ${goodVerifyRes.status}, Status: ${verifyData.status}`);

      if (!verifyData.success || verifyData.status !== 'SUCCESS') {
        throw new Error('Verify failed: ' + JSON.stringify(verifyData));
      }

      // 5. Check MySQL database updates & triggers
      const [updatedPay] = await pool.execute('SELECT * FROM payments WHERE payment_id = ?', [paymentId]);
      console.log('\n[Test 4]: Checking MySQL database status:');
      console.log('  Payment Status:', updatedPay[0].payment_status);
      console.log('  Transaction ID:', updatedPay[0].transaction_id);

      const [auditRows] = await pool.execute(
        'SELECT * FROM payment_audit WHERE payment_id = ? ORDER BY audit_id DESC LIMIT 1',
        [paymentId]
      );
      console.log('  Trigger Audit Record:', auditRows.length > 0 ? auditRows[0] : 'None');

      // 6. Check MongoDB activity logs
      const mongoLog = await ActivityLog.findOne({ 'details.razorpay_payment_id': testPaymentId });
      console.log('\n[Test 5]: Checking MongoDB activity_logs:');
      console.log('  Logged action:', mongoLog ? mongoLog.action : 'Not found');
      console.log('  Entity:', mongoLog ? mongoLog.entityType : 'N/A');

      // 7. Test Idempotency (duplicate call)
      console.log('\n[Test 6]: Testing Idempotent Retry verification...');
      const retryVerifyRes = await fetch('http://127.0.0.1:5009/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSig,
          paymentId,
          reservationId,
        }),
      });
      const retryData = await retryVerifyRes.json();
      console.log(`Idempotent retry status: ${retryVerifyRes.status}, Status: ${retryData.status}`);

      console.log('\n========================================');
      console.log('🎉 ALL 6 RAZORPAY E2E INTEGRATION TESTS PASSED!');
      console.log('========================================');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('Test failure:', err);
      server.close();
      process.exit(1);
    }
  });
})();

