const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');
const { razorpay, verifyRazorpaySignature, getRazorpayKeyId } = require('../config/razorpay');

/**
 * Get Razorpay public Key ID for frontend Checkout initialization
 */
const getRazorpayConfig = async (req, res) => {
  res.json({
    success: true,
    keyId: getRazorpayKeyId()
  });
};

/**
 * Get all payments (filtered for user or full list for admin)
 */
const getPayments = async (req, res, next) => {
  try {
    let query = `
      SELECT 
        p.payment_id,
        p.reservation_id,
        p.amount,
        p.payment_method,
        p.payment_status,
        p.payment_time,
        p.transaction_id,
        r.user_id,
        r.slot_id,
        r.start_time,
        r.end_time,
        u.name AS user_name,
        u.email AS user_email,
        s.slot_number,
        a.name AS area_name,
        v.registration_no
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.reservation_id
      JOIN users u ON r.user_id = u.user_id
      JOIN parking_slots s ON r.slot_id = s.slot_id
      JOIN parking_areas a ON s.area_id = a.area_id
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'ADMIN') {
      query += ` AND r.user_id = ?`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY p.payment_id DESC`;

    const [payments] = await pool.execute(query, params);

    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by ID
 */
const getPaymentById = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id, 10);

    const [rows] = await pool.execute(
      `SELECT p.*, r.user_id, u.name as user_name, u.email as user_email
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.reservation_id
       JOIN users u ON r.user_id = u.user_id
       WHERE p.payment_id = ?`,
      [paymentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (req.user.role !== 'ADMIN' && rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    res.json({
      success: true,
      payment: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a Razorpay Order
 * Validates reservation from trusted database data and creates a Razorpay order in paise
 */
const createRazorpayOrder = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { reservationId, paymentId } = req.body;

    if (!reservationId && !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'reservationId or paymentId is required to generate a payment order.'
      });
    }

    let targetReservationId = reservationId;
    let targetPaymentId = paymentId;

    await connection.beginTransaction();

    // 1. Fetch reservation details from DB
    let resQuery = `
      SELECT r.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
             v.registration_no, v.vehicle_type, s.slot_number, a.name AS area_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      JOIN parking_slots s ON r.slot_id = s.slot_id
      JOIN parking_areas a ON s.area_id = a.area_id
      WHERE `;
    let resParams = [];

    if (targetReservationId) {
      resQuery += `r.reservation_id = ? FOR UPDATE`;
      resParams.push(targetReservationId);
    } else {
      resQuery += `r.reservation_id = (SELECT reservation_id FROM payments WHERE payment_id = ?) FOR UPDATE`;
      resParams.push(targetPaymentId);
    }

    const [resRows] = await connection.execute(resQuery, resParams);

    if (resRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const reservation = resRows[0];
    targetReservationId = reservation.reservation_id;

    // Authorization check
    if (req.user.role !== 'ADMIN' && reservation.user_id !== req.user.userId) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Unauthorized access to this reservation.' });
    }

    // Status check
    if (reservation.status === 'CANCELLED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Cannot process payment for a cancelled reservation.' });
    }

    // 2. Look for existing payment row linked to this reservation
    const [payRows] = await connection.execute(
      `SELECT * FROM payments WHERE reservation_id = ? FOR UPDATE`,
      [targetReservationId]
    );

    let paymentRecord = payRows.length > 0 ? payRows[0] : null;

    if (paymentRecord && paymentRecord.payment_status === 'SUCCESS') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'This reservation has already been paid for.',
        transactionId: paymentRecord.transaction_id
      });
    }

    // 3. Calculate trusted amount on the server (never trust client amounts)
    let trustedAmount;
    if (paymentRecord && paymentRecord.amount > 0) {
      trustedAmount = Number(paymentRecord.amount);
    } else {
      const start = new Date(reservation.start_time);
      const end = new Date(reservation.end_time);
      const durationHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
      const hourlyRate = reservation.vehicle_type === 'BIKE' ? 20.00 : reservation.vehicle_type === 'EV' ? 40.00 : 50.00;
      trustedAmount = Number((durationHours * hourlyRate).toFixed(2));

      // Insert new pending payment record if none existed
      const [insertPay] = await connection.execute(
        `INSERT INTO payments (reservation_id, amount, payment_method, payment_status, payment_time)
         VALUES (?, ?, 'UPI', 'PENDING', NOW())`,
        [targetReservationId, trustedAmount]
      );
      paymentRecord = {
        payment_id: insertPay.insertId,
        reservation_id: targetReservationId,
        amount: trustedAmount,
        payment_status: 'PENDING'
      };
    }

    targetPaymentId = paymentRecord.payment_id;

    await connection.commit();

    // 4. Create Razorpay Order via Razorpay Node SDK (amount in smallest unit: paise)
    const amountInPaise = Math.round(trustedAmount * 100);
    const receiptId = `rcpt_${targetReservationId}_${Date.now()}`.slice(0, 40);

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        reservationId: String(targetReservationId),
        paymentId: String(targetPaymentId),
        userId: String(reservation.user_id),
        slotNumber: String(reservation.slot_number),
        regNo: String(reservation.registration_no)
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    // 5. Asynchronously log order creation in MongoDB activity_logs
    ActivityLogService.log({
      action: 'Razorpay order created',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PAYMENT',
      entityId: targetPaymentId,
      details: {
        orderId: order.id,
        amountInRupees: trustedAmount,
        amountInPaise,
        receipt: receiptId,
        reservationId: targetReservationId
      },
      req
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      paymentId: targetPaymentId,
      reservationId: targetReservationId,
      slotNumber: reservation.slot_number,
      areaName: reservation.area_name,
      registrationNo: reservation.registration_no,
      customer: {
        name: reservation.user_name,
        email: reservation.user_email,
        phone: reservation.user_phone || ''
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Razorpay Order Creation Error]:', error);
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Verify Razorpay payment signature and complete transaction
 * Enforces server-side HMAC SHA256 signature verification and atomic database updates
 */
const verifyRazorpayPayment = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
      reservationId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment verification parameters.'
      });
    }

    // 1. Verify Razorpay cryptographic signature using HMAC SHA256 and backend secret
    const isValidSignature = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      // Log suspicious/invalid verification attempt
      ActivityLogService.log({
        action: 'Razorpay signature verification failed',
        actorId: req.user.userId,
        actorRole: req.user.role,
        actorEmail: req.user.email,
        entityType: 'PAYMENT',
        entityId: paymentId || null,
        details: { razorpay_order_id, razorpay_payment_id },
        req
      });

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid cryptographic signature.'
      });
    }

    // 2. Fetch payment details from Razorpay API for additional verification
    let razorpayMethod = 'CARD';
    try {
      const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      if (paymentDetails && paymentDetails.method) {
        const m = paymentDetails.method.toLowerCase();
        if (m === 'upi') razorpayMethod = 'UPI';
        else if (m === 'card') razorpayMethod = 'CARD';
        else if (m === 'wallet') razorpayMethod = 'WALLET';
        else razorpayMethod = 'CARD';
      }
    } catch (fetchErr) {
      console.warn('[Razorpay API Fetch Warning]:', fetchErr.message);
    }

    // 3. MySQL Transaction: Lock payment record and update status atomically
    await connection.beginTransaction();

    let payQuery = `
      SELECT p.*, r.user_id, r.status AS reservation_status, s.slot_number, v.registration_no
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.reservation_id
      JOIN parking_slots s ON r.slot_id = s.slot_id
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      WHERE `;
    let payParams = [];

    if (paymentId) {
      payQuery += `p.payment_id = ? FOR UPDATE`;
      payParams.push(paymentId);
    } else if (reservationId) {
      payQuery += `p.reservation_id = ? FOR UPDATE`;
      payParams.push(reservationId);
    } else {
      // Lookup by order notes or most recent pending
      payQuery += `p.payment_status = 'PENDING' ORDER BY p.payment_id DESC LIMIT 1 FOR UPDATE`;
    }

    const [rows] = await connection.execute(payQuery, payParams);

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Associated payment record not found.' });
    }

    const payment = rows[0];

    // Idempotency check: if already marked SUCCESS, commit and return immediately
    if (payment.payment_status === 'SUCCESS') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Payment was already verified and recorded.',
        transactionId: payment.transaction_id,
        paymentId: payment.payment_id,
        status: 'SUCCESS'
      });
    }

    // 4. Update payments table with Razorpay payment ID and SUCCESS status
    await connection.execute(
      `UPDATE payments 
       SET payment_status = 'SUCCESS',
           payment_method = ?,
           payment_time = NOW(),
           transaction_id = ?
       WHERE payment_id = ?`,
      [razorpayMethod, razorpay_payment_id, payment.payment_id]
    );

    // Note: The MySQL trigger `trg_payment_success` automatically executes:
    // UPDATE reservations SET status = 'CONFIRMED' WHERE reservation_id = NEW.reservation_id;
    // And `trg_payment_audit` automatically inserts a row into `payment_audit`.

    // 5. Send notification to user
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [
        payment.user_id,
        'Payment Successful',
        `Razorpay payment of ₹${payment.amount} for Reservation #${payment.reservation_id} was successful. Transaction ID: ${razorpay_payment_id}`
      ]
    );

    await connection.commit();

    // 6. Record event in MongoDB activity_logs
    ActivityLogService.log({
      action: 'Payment status changed',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PAYMENT',
      entityId: payment.payment_id,
      details: {
        provider: 'RAZORPAY',
        razorpay_order_id,
        razorpay_payment_id,
        oldStatus: payment.payment_status,
        newStatus: 'SUCCESS',
        amount: payment.amount,
        method: razorpayMethod,
        reservationId: payment.reservation_id
      },
      req
    });

    res.json({
      success: true,
      message: 'Razorpay payment verified and recorded successfully!',
      transactionId: razorpay_payment_id,
      orderId: razorpay_order_id,
      paymentId: payment.payment_id,
      reservationId: payment.reservation_id,
      status: 'SUCCESS'
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Razorpay Verification Error]:', error);
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Handle payment failure or user cancellation reported by client
 */
const handlePaymentFailure = async (req, res, next) => {
  try {
    const { paymentId, reservationId, reason, orderId, errorDetails } = req.body;

    // Log the failed/cancelled payment event in MongoDB
    ActivityLogService.log({
      action: 'Razorpay payment failed or cancelled',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PAYMENT',
      entityId: paymentId || null,
      details: {
        reason: reason || 'Payment cancelled or rejected by user/bank',
        orderId,
        reservationId,
        errorDetails: errorDetails || {}
      },
      req
    });

    res.json({
      success: true,
      message: 'Payment failure logged. You may retry your payment at any time.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Safe Demo Payment Gateway Simulation (preserved for offline viva testing)
 */
const processDemoPayment = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { paymentMethod = 'UPI' } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT p.*, r.user_id, s.slot_number, v.registration_no
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.reservation_id
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN vehicles v ON r.vehicle_id = v.vehicle_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [paymentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const payment = rows[0];

    if (req.user.role !== 'ADMIN' && payment.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to process this payment.' });
    }

    if (payment.payment_status === 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'This payment has already been completed.' });
    }

    const demoTxnId = `DEMO_TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    await connection.execute(
      `UPDATE payments 
       SET payment_status = 'SUCCESS',
           payment_method = ?,
           payment_time = NOW(),
           transaction_id = ?
       WHERE payment_id = ?`,
      [paymentMethod, demoTxnId, paymentId]
    );

    try {
      await connection.execute(
        `INSERT INTO payment_audit (payment_id, old_status, new_status, changed_at)
         VALUES (?, ?, 'SUCCESS', NOW())`,
        [paymentId, payment.payment_status]
      );
    } catch (auditErr) {
      // Ignore if trigger already handled
    }

    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [
        payment.user_id,
        'Payment Successful',
        `Payment of ₹${payment.amount} for Reservation #${payment.reservation_id} was successful. Transaction ID: ${demoTxnId}`
      ]
    );

    await connection.commit();

    ActivityLogService.log({
      action: 'Payment status changed',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PAYMENT',
      entityId: paymentId,
      details: {
        gateway: 'DEMO_GATEWAY',
        oldStatus: payment.payment_status,
        newStatus: 'SUCCESS',
        amount: payment.amount,
        transactionId: demoTxnId,
        paymentMethod
      },
      req
    });

    res.json({
      success: true,
      message: 'Demo payment completed successfully!',
      transactionId: demoTxnId,
      paymentId,
      status: 'SUCCESS'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Get payment audit history (Admin)
 */
const getPaymentAuditLogs = async (req, res, next) => {
  try {
    const [auditLogs] = await pool.execute(
      `SELECT pa.*, p.reservation_id, p.amount
       FROM payment_audit pa
       JOIN payments p ON pa.payment_id = p.payment_id
       ORDER BY pa.audit_id DESC
       LIMIT 100`
    );

    res.json({
      success: true,
      count: auditLogs.length,
      auditLogs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRazorpayConfig,
  getPayments,
  getPaymentById,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentFailure,
  processDemoPayment,
  getPaymentAuditLogs
};
