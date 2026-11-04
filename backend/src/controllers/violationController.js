const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');

/**
 * Get violations (for current user or all for admin)
 */
const getViolations = async (req, res, next) => {
  try {
    let query = `
      SELECT 
        v.violation_id,
        v.vehicle_id,
        v.slot_id,
        v.violation_type,
        v.violation_time,
        v.fine_amount,
        v.payment_status,
        veh.registration_no,
        veh.vehicle_type,
        veh.user_id,
        u.name AS user_name,
        u.email AS user_email,
        s.slot_number,
        a.name AS area_name
      FROM violations v
      JOIN vehicles veh ON v.vehicle_id = veh.vehicle_id
      JOIN users u ON veh.user_id = u.user_id
      JOIN parking_slots s ON v.slot_id = s.slot_id
      JOIN parking_areas a ON s.area_id = a.area_id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'ADMIN') {
      query += ` AND veh.user_id = ?`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY v.violation_id DESC`;

    const [violations] = await pool.execute(query, params);

    res.json({
      success: true,
      count: violations.length,
      violations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Issue a new violation (Admin)
 */
const createViolation = async (req, res, next) => {
  try {
    const { vehicle_id, slot_id, violation_type, fine_amount = 50.00 } = req.body;

    if (!vehicle_id || !slot_id || !violation_type) {
      return res.status(400).json({
        success: false,
        message: 'vehicle_id, slot_id, and violation_type are required.'
      });
    }

    // Backend validation: Verify vehicle exists
    const [vehicles] = await pool.execute(
      `SELECT v.vehicle_id, v.user_id, v.registration_no, u.name AS owner_name 
       FROM vehicles v 
       JOIN users u ON v.user_id = u.user_id 
       WHERE v.vehicle_id = ?`,
      [vehicle_id]
    );

    if (vehicles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle_id. Vehicle does not exist in the database.'
      });
    }

    // Backend validation: Verify slot exists
    const [slots] = await pool.execute(
      `SELECT s.slot_id, s.slot_number, a.name AS area_name 
       FROM parking_slots s 
       JOIN parking_areas a ON s.area_id = a.area_id 
       WHERE s.slot_id = ?`,
      [slot_id]
    );

    if (slots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slot_id. Parking slot does not exist in the database.'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO violations (vehicle_id, slot_id, violation_type, fine_amount, payment_status, violation_time)
       VALUES (?, ?, ?, ?, 'UNPAID', NOW())`,
      [vehicle_id, slot_id, violation_type, fine_amount]
    );

    // Notify vehicle owner
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, created_at) VALUES (?, ?, ?, NOW())`,
      [
        vehicles[0].user_id,
        'Parking Violation Issued',
        `A parking violation (${violation_type}) with fine ₹${Number(fine_amount).toFixed(2)} has been issued for vehicle ${vehicles[0].registration_no} at ${slots[0].area_name} (Slot ${slots[0].slot_number}).`
      ]
    );

    ActivityLogService.log({
      action: 'Admin issued violation',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'VIOLATION',
      entityId: result.insertId,
      details: { vehicle_id, slot_id, violation_type, fine_amount },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Violation recorded successfully.',
      violationId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Look up vehicle and its current active parking location
 * Prioritizes active parking sessions (exit_time IS NULL) over active confirmed reservations
 */
const getVehicleLocation = async (req, res, next) => {
  try {
    const rawIdentifier = req.params.identifier || req.query.identifier || req.query.plate || req.query.vehicle_id;

    if (!rawIdentifier || !String(rawIdentifier).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID or registration number plate is required.'
      });
    }

    const identifier = String(rawIdentifier).trim();
    const isNumeric = /^\d+$/.test(identifier);

    // 1. Fetch vehicle details & owner information
    let vehicleQuery = `
      SELECT 
        v.vehicle_id,
        v.user_id,
        v.registration_no,
        v.vehicle_type,
        v.brand,
        v.model,
        v.color,
        u.name AS owner_name,
        u.email AS owner_email,
        u.phone AS owner_phone
      FROM vehicles v
      JOIN users u ON v.user_id = u.user_id
      WHERE `;

    const vehicleParams = [];
    if (isNumeric) {
      vehicleQuery += `(v.vehicle_id = ? OR UPPER(v.registration_no) = UPPER(?))`;
      vehicleParams.push(parseInt(identifier, 10), identifier);
    } else {
      vehicleQuery += `UPPER(v.registration_no) = UPPER(?)`;
      vehicleParams.push(identifier);
    }

    const [vehicles] = await pool.execute(vehicleQuery, vehicleParams);

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No registered vehicle found matching '${identifier}'.`
      });
    }

    const vehicle = vehicles[0];

    // 2. Fetch active parking sessions (exit_time IS NULL or status = 'ONGOING')
    const [activeSessions] = await pool.execute(
      `SELECT 
        ps.session_id,
        ps.reservation_id,
        ps.slot_id,
        ps.entry_time,
        ps.exit_time,
        ps.status AS session_status,
        s.slot_number,
        s.slot_type,
        s.floor_level,
        s.status AS slot_status,
        a.area_id,
        a.name AS area_name,
        a.location AS area_location
       FROM parking_sessions ps
       JOIN parking_slots s ON ps.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       WHERE ps.vehicle_id = ? AND (ps.exit_time IS NULL OR ps.status = 'ONGOING')
       ORDER BY ps.session_id DESC`,
      [vehicle.vehicle_id]
    );

    // 3. Fetch active reservations (status = 'CONFIRMED' or 'ACTIVE' and current time between start_time and end_time)
    const [activeReservations] = await pool.execute(
      `SELECT 
        r.reservation_id,
        r.slot_id,
        r.start_time,
        r.end_time,
        r.status AS reservation_status,
        s.slot_number,
        s.slot_type,
        s.floor_level,
        s.status AS slot_status,
        a.area_id,
        a.name AS area_name,
        a.location AS area_location
       FROM reservations r
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       WHERE r.vehicle_id = ? 
         AND r.status IN ('CONFIRMED', 'ACTIVE')
         AND NOW() BETWEEN r.start_time AND r.end_time
       ORDER BY r.reservation_id DESC`,
      [vehicle.vehicle_id]
    );

    // 4. Analyze conflicts and determine location
    let location = null;
    let locationSource = null;
    let hasConflict = false;
    let conflictType = null;
    let conflictMessage = null;

    const uniqueSessionSlots = [...new Set(activeSessions.map((s) => s.slot_id))];
    const uniqueReservationSlots = [...new Set(activeReservations.map((r) => r.slot_id))];

    if (uniqueSessionSlots.length > 1) {
      // Multiple active sessions across different slots
      hasConflict = true;
      conflictType = 'MULTIPLE_ACTIVE_SESSIONS';
      conflictMessage = `Conflicting records: Vehicle is recorded in ${uniqueSessionSlots.length} different active parking sessions simultaneously.`;
    } else if (activeSessions.length > 0 && activeReservations.length > 0) {
      const sessionSlotId = activeSessions[0].slot_id;
      const mismatchedReservations = activeReservations.filter((r) => r.slot_id !== sessionSlotId);
      if (mismatchedReservations.length > 0) {
        // Active session slot differs from active reservation slot
        hasConflict = true;
        conflictType = 'SESSION_RESERVATION_MISMATCH';
        conflictMessage = `Discrepancy detected: Active parking session is in ${activeSessions[0].area_name} — Slot ${activeSessions[0].slot_number}, but active reservation is booked for ${mismatchedReservations[0].area_name} — Slot ${mismatchedReservations[0].slot_number}.`;
      }
    } else if (activeSessions.length === 0 && uniqueReservationSlots.length > 1) {
      // Multiple overlapping active reservations across different slots
      hasConflict = true;
      conflictType = 'MULTIPLE_ACTIVE_RESERVATIONS';
      conflictMessage = `Conflicting records: Vehicle has ${uniqueReservationSlots.length} overlapping active reservations in different parking slots.`;
    }

    if (!hasConflict) {
      if (activeSessions.length > 0) {
        // Priority 1: Ongoing physical parking session
        const sess = activeSessions[0];
        locationSource = 'ACTIVE_SESSION';
        location = {
          slot_id: sess.slot_id,
          slot_number: sess.slot_number,
          slot_type: sess.slot_type,
          floor_level: sess.floor_level,
          area_id: sess.area_id,
          area_name: sess.area_name,
          area_location: sess.area_location,
          location_text: `${sess.area_name} — ${sess.slot_number}`,
          session_id: sess.session_id,
          entry_time: sess.entry_time,
          status: sess.session_status
        };
      } else if (activeReservations.length > 0) {
        // Priority 2: Current active/confirmed reservation
        const resv = activeReservations[0];
        locationSource = 'ACTIVE_RESERVATION';
        location = {
          slot_id: resv.slot_id,
          slot_number: resv.slot_number,
          slot_type: resv.slot_type,
          floor_level: resv.floor_level,
          area_id: resv.area_id,
          area_name: resv.area_name,
          area_location: resv.area_location,
          location_text: `${resv.area_name} — ${resv.slot_number}`,
          reservation_id: resv.reservation_id,
          start_time: resv.start_time,
          end_time: resv.end_time,
          status: resv.reservation_status
        };
      }
    }

    // Build candidate list if there's conflict or multiple records
    const candidateLocations = [];
    activeSessions.forEach((s) => {
      candidateLocations.push({
        source: 'ACTIVE_SESSION',
        slot_id: s.slot_id,
        slot_number: s.slot_number,
        area_name: s.area_name,
        location_text: `${s.area_name} — ${s.slot_number}`,
        entry_time: s.entry_time
      });
    });
    activeReservations.forEach((r) => {
      if (!candidateLocations.some((c) => c.slot_id === r.slot_id)) {
        candidateLocations.push({
          source: 'ACTIVE_RESERVATION',
          slot_id: r.slot_id,
          slot_number: r.slot_number,
          area_name: r.area_name,
          location_text: `${r.area_name} — ${r.slot_number}`,
          start_time: r.start_time,
          end_time: r.end_time
        });
      }
    });

    res.json({
      success: true,
      vehicle,
      location,
      locationSource,
      hasConflict,
      conflictType,
      conflictMessage,
      candidateLocations,
      activeSessionsCount: activeSessions.length,
      activeReservationsCount: activeReservations.length,
      message: location
        ? `Current parking location identified via ${locationSource === 'ACTIVE_SESSION' ? 'active parking session' : 'active reservation'}.`
        : hasConflict
        ? conflictMessage
        : 'No active parking record found for this vehicle.',
      disclaimer: 'Location is determined from active database sessions and reservations. Live physical GPS tracking is not used.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update violation status (Admin)
 */
const updateViolationStatus = async (req, res, next) => {
  try {
    const violationId = parseInt(req.params.id, 10);
    const { payment_status } = req.body;

    if (!['PAID', 'UNPAID'].includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Status must be PAID or UNPAID.' });
    }

    const [existing] = await pool.execute('SELECT * FROM violations WHERE violation_id = ?', [violationId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Violation not found.' });
    }

    await pool.execute('UPDATE violations SET payment_status = ? WHERE violation_id = ?', [
      payment_status,
      violationId
    ]);

    ActivityLogService.log({
      action: 'Violation status changed',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'VIOLATION',
      entityId: violationId,
      details: { oldStatus: existing[0].payment_status, newStatus: payment_status },
      req
    });

    res.json({
      success: true,
      message: `Violation marked as ${payment_status}.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pay a violation fine (Demo payment)
 */
const payViolation = async (req, res, next) => {
  try {
    const violationId = parseInt(req.params.id, 10);

    const [rows] = await pool.execute(
      `SELECT v.*, veh.user_id, veh.registration_no 
       FROM violations v 
       JOIN vehicles veh ON v.vehicle_id = veh.vehicle_id 
       WHERE v.violation_id = ?`,
      [violationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Violation not found.' });
    }

    const violation = rows[0];

    if (req.user.role !== 'ADMIN' && violation.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (violation.payment_status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Violation fine is already paid.' });
    }

    await pool.execute(`UPDATE violations SET payment_status = 'PAID' WHERE violation_id = ?`, [violationId]);

    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, created_at) VALUES (?, ?, ?, NOW())`,
      [violation.user_id, 'Fine Payment Received', `Payment for fine #${violationId} (₹${Number(violation.fine_amount).toFixed(2)}) received successfully.`]
    );

    ActivityLogService.log({
      action: 'Violation fine paid',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'VIOLATION',
      entityId: violationId,
      details: { fine_amount: violation.fine_amount, registration_no: violation.registration_no },
      req
    });

    res.json({
      success: true,
      message: 'Violation fine paid successfully!'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getViolations,
  getVehicleLocation,
  createViolation,
  updateViolationStatus,
  payViolation
};

