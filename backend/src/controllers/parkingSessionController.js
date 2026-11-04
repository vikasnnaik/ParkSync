const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');

/**
 * Get parking sessions (filtered by user or all for admin)
 */
const getSessions = async (req, res, next) => {
  try {
    let query = `
      SELECT 
        ps.session_id,
        ps.reservation_id,
        ps.vehicle_id,
        ps.slot_id,
        ps.entry_time,
        ps.exit_time,
        ps.status,
        COALESCE(ps.parking_fee, 0.00) AS fee,
        v.registration_no,
        v.vehicle_type,
        s.slot_number,
        a.name AS area_name,
        u.name AS user_name,
        u.email AS user_email
      FROM parking_sessions ps
      JOIN vehicles v ON ps.vehicle_id = v.vehicle_id
      JOIN parking_slots s ON ps.slot_id = s.slot_id
      JOIN parking_areas a ON s.area_id = a.area_id
      JOIN users u ON v.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'ADMIN') {
      query += ` AND v.user_id = ?`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY ps.session_id DESC`;

    const [sessions] = await pool.execute(query, params);

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a parking session (Entry)
 */
const startSession = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { vehicleId, slotId, reservationId = null } = req.body;

    if (!vehicleId || !slotId) {
      return res.status(400).json({ success: false, message: 'vehicleId and slotId are required.' });
    }

    await connection.beginTransaction();

    // Set slot to OCCUPIED
    await connection.execute(
      `UPDATE parking_slots SET status = 'OCCUPIED' WHERE slot_id = ?`,
      [slotId]
    );

    // If there is an active reservation, set it to ACTIVE
    if (reservationId) {
      await connection.execute(
        `UPDATE reservations SET status = 'ACTIVE' WHERE reservation_id = ?`,
        [reservationId]
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO parking_sessions (reservation_id, vehicle_id, slot_id, entry_time, status, parking_fee)
       VALUES (?, ?, ?, NOW(), 'ONGOING', 0.00)`,
      [reservationId, vehicleId, slotId]
    );

    await connection.commit();

    ActivityLogService.log({
      action: 'Parking session started (Entry)',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'SESSION',
      entityId: result.insertId,
      details: { vehicleId, slotId, reservationId },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Parking session started.',
      sessionId: result.insertId
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * End a parking session (Exit)
 */
const endSession = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const sessionId = parseInt(req.params.id, 10);

    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      'SELECT * FROM parking_sessions WHERE session_id = ? FOR UPDATE',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking session not found.' });
    }

    const session = sessions[0];
    if (session.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Session is already completed.' });
    }

    // Calculate duration & fee
    const entryTime = new Date(session.entry_time);
    const exitTime = new Date();
    const durationHours = Math.max(1, Math.ceil((exitTime - entryTime) / (1000 * 60 * 60)));
    const fee = durationHours * 40.00; // Flat 40 per hour

    await connection.execute(
      `UPDATE parking_sessions 
       SET exit_time = NOW(), status = 'COMPLETED', parking_fee = ?
       WHERE session_id = ?`,
      [fee, sessionId]
    );

    // Free the slot
    await connection.execute(
      `UPDATE parking_slots SET status = 'AVAILABLE' WHERE slot_id = ?`,
      [session.slot_id]
    );

    // If linked to reservation, complete it
    if (session.reservation_id) {
      await connection.execute(
        `UPDATE reservations SET status = 'COMPLETED' WHERE reservation_id = ?`,
        [session.reservation_id]
      );
    }

    await connection.commit();

    ActivityLogService.log({
      action: 'Parking session completed (Exit)',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'SESSION',
      entityId: sessionId,
      details: { fee, durationHours, slotId: session.slot_id },
      req
    });

    res.json({
      success: true,
      message: 'Parking session ended successfully.',
      fee,
      exitTime
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  getSessions,
  startSession,
  endSession
};

