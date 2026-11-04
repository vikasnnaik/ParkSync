const { pool } = require('../config/db');
const ReservationService = require('../services/reservationService');
const ActivityLogService = require('../services/activityLogService');

/**
 * Make a new reservation
 */
const createReservation = async (req, res, next) => {
  try {
    const { vehicleId, slotId, startTime, endTime, paymentMethod } = req.body;

    if (!vehicleId || !slotId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId, slotId, startTime, and endTime are required.'
      });
    }

    const result = await ReservationService.createReservation({
      userId: req.user.userId,
      userEmail: req.user.email,
      userRole: req.user.role,
      vehicleId: parseInt(vehicleId, 10),
      slotId: parseInt(slotId, 10),
      startTime,
      endTime,
      paymentMethod,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully.',
      reservation: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reservations for logged-in user
 */
const getMyReservations = async (req, res, next) => {
  try {
    // Attempt query using existing view reservation_details first
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM reservation_details WHERE user_id = ? ORDER BY reservation_id DESC`,
        [req.user.userId]
      );
      if (rows.length > 0 || rows) {
        return res.json({ success: true, count: rows.length, reservations: rows });
      }
    } catch (viewErr) {
      // If view has different column names or is unavailable, use standard join
    }

    const [reservations] = await pool.execute(
      `SELECT 
        r.reservation_id,
        r.user_id,
        r.vehicle_id,
        r.slot_id,
        r.start_time,
        r.end_time,
        r.status,
        r.created_at,
        v.registration_no,
        v.vehicle_type,
        v.brand,
        v.model,
        s.slot_number,
        s.floor_level,
        a.area_id,
        a.name AS area_name,
        a.location AS area_location,
        p.payment_id,
        p.amount,
        p.payment_status,
        p.payment_method
       FROM reservations r
       JOIN vehicles v ON r.vehicle_id = v.vehicle_id
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       LEFT JOIN payments p ON r.reservation_id = p.reservation_id
       WHERE r.user_id = ?
       ORDER BY r.reservation_id DESC`,
      [req.user.userId]
    );

    res.json({
      success: true,
      count: reservations.length,
      reservations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reservations (Admin)
 */
const getAllReservations = async (req, res, next) => {
  try {
    const { status, area_id } = req.query;

    let query = `
      SELECT 
        r.reservation_id,
        r.user_id,
        r.vehicle_id,
        r.slot_id,
        r.start_time,
        r.end_time,
        r.status,
        r.created_at,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        v.registration_no,
        v.vehicle_type,
        s.slot_number,
        a.area_id,
        a.name AS area_name,
        p.payment_id,
        p.amount,
        p.payment_status
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       JOIN vehicles v ON r.vehicle_id = v.vehicle_id
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       LEFT JOIN payments p ON r.reservation_id = p.reservation_id
       WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND r.status = ?`;
      params.push(status.toUpperCase());
    }

    if (area_id) {
      query += ` AND s.area_id = ?`;
      params.push(parseInt(area_id, 10));
    }

    query += ` ORDER BY r.reservation_id DESC`;

    const [reservations] = await pool.execute(query, params);

    res.json({
      success: true,
      count: reservations.length,
      reservations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single reservation by ID
 */
const getReservationById = async (req, res, next) => {
  try {
    const reservationId = parseInt(req.params.id, 10);

    const [rows] = await pool.execute(
      `SELECT 
        r.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        v.registration_no,
        v.vehicle_type,
        s.slot_number,
        a.name AS area_name,
        a.location AS area_location,
        p.payment_id,
        p.amount,
        p.payment_status,
        p.payment_method,
        p.transaction_id
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       JOIN vehicles v ON r.vehicle_id = v.vehicle_id
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       LEFT JOIN payments p ON r.reservation_id = p.reservation_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const reservation = rows[0];

    if (req.user.role !== 'ADMIN' && reservation.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this reservation.' });
    }

    res.json({
      success: true,
      reservation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a reservation
 */
const cancelReservation = async (req, res, next) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const result = await ReservationService.cancelReservation({
      reservationId,
      userId: req.user.userId,
      userRole: req.user.role,
      userEmail: req.user.email,
      reason,
      req
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update reservation status (Admin)
 */
const updateReservationStatus = async (req, res, next) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation status.' });
    }

    const [rows] = await pool.execute('SELECT * FROM reservations WHERE reservation_id = ?', [reservationId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    await pool.execute('UPDATE reservations SET status = ? WHERE reservation_id = ?', [status, reservationId]);

    // If completed or cancelled, free the slot
    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED') {
      await pool.execute('UPDATE parking_slots SET status = ? WHERE slot_id = ?', ['AVAILABLE', rows[0].slot_id]);
    } else if (status === 'ACTIVE') {
      await pool.execute('UPDATE parking_slots SET status = ? WHERE slot_id = ?', ['OCCUPIED', rows[0].slot_id]);
    }

    ActivityLogService.log({
      action: 'Reservation status changed',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'RESERVATION',
      entityId: reservationId,
      details: { oldStatus: rows[0].status, newStatus: status },
      req
    });

    res.json({
      success: true,
      message: `Reservation status updated to ${status}.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getAllReservations,
  getReservationById,
  cancelReservation,
  updateReservationStatus
};

