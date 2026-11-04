const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');

/**
 * Get all slots with optional filtering by area, slot_type, and status
 */
const getAllSlots = async (req, res, next) => {
  try {
    const { area_id, slot_type, status, search } = req.query;

    let query = `
      SELECT 
        s.slot_id,
        s.area_id,
        s.slot_number,
        s.slot_type,
        s.status,
        s.floor_level,
        s.updated_at,
        a.name AS area_name,
        a.location AS area_location
      FROM parking_slots s
      JOIN parking_areas a ON s.area_id = a.area_id
      WHERE 1=1
    `;
    const params = [];

    if (area_id) {
      query += ` AND s.area_id = ?`;
      params.push(parseInt(area_id, 10));
    }

    if (slot_type) {
      query += ` AND s.slot_type = ?`;
      params.push(slot_type.toUpperCase());
    }

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status.toUpperCase());
    }

    if (search) {
      query += ` AND (s.slot_number LIKE ? OR a.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY a.name ASC, s.slot_number ASC`;

    const [slots] = await pool.execute(query, params);

    res.json({
      success: true,
      count: slots.length,
      slots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available slots for a given time window and vehicle type
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { area_id, vehicle_type, start_time, end_time } = req.query;

    let query = `
      SELECT 
        s.slot_id,
        s.area_id,
        s.slot_number,
        s.slot_type,
        s.status,
        s.floor_level,
        a.name AS area_name,
        a.location AS area_location
      FROM parking_slots s
      JOIN parking_areas a ON s.area_id = a.area_id
      WHERE s.status != 'MAINTENANCE'
    `;
    const params = [];

    if (area_id) {
      query += ` AND s.area_id = ?`;
      params.push(parseInt(area_id, 10));
    }

    if (vehicle_type) {
      query += ` AND (s.slot_type = ? OR s.slot_type = 'DISABLED')`;
      params.push(vehicle_type.toUpperCase());
    }

    // Overlap filtering if start_time and end_time are provided
    if (start_time && end_time) {
      const formattedStart = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ');
      const formattedEnd = new Date(end_time).toISOString().slice(0, 19).replace('T', ' ');

      query += `
        AND s.slot_id NOT IN (
          SELECT slot_id FROM reservations
          WHERE status IN ('CONFIRMED', 'ACTIVE')
            AND start_time < ?
            AND end_time > ?
        )
      `;
      params.push(formattedEnd, formattedStart);
    } else {
      // By default without time params, only return slots whose current status is AVAILABLE
      query += ` AND s.status = 'AVAILABLE'`;
    }

    query += ` ORDER BY a.name ASC, s.slot_number ASC`;

    const [slots] = await pool.execute(query, params);

    res.json({
      success: true,
      count: slots.length,
      slots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new slot (Admin)
 */
const createSlot = async (req, res, next) => {
  try {
    const { area_id, slot_number, slot_type = 'CAR', floor_level = '1', status = 'AVAILABLE' } = req.body;

    if (!area_id || !slot_number) {
      return res.status(400).json({ success: false, message: 'area_id and slot_number are required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO parking_slots (area_id, slot_number, slot_type, floor_level, status)
       VALUES (?, ?, ?, ?, ?)`,
      [area_id, slot_number.trim(), slot_type.toUpperCase(), floor_level, status.toUpperCase()]
    );

    ActivityLogService.log({
      action: 'Admin created parking slot',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'SLOT',
      entityId: result.insertId,
      details: { area_id, slot_number, slot_type, floor_level, status },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Parking slot created successfully.',
      slotId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update slot status, type, or floor level (Admin)
 */
const updateSlot = async (req, res, next) => {
  try {
    const slotId = parseInt(req.params.id, 10);
    const { slot_number, slot_type, floor_level, status } = req.body;

    const [existing] = await pool.execute('SELECT * FROM parking_slots WHERE slot_id = ?', [slotId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking slot not found.' });
    }

    await pool.execute(
      `UPDATE parking_slots 
       SET slot_number = COALESCE(?, slot_number),
           slot_type = COALESCE(?, slot_type),
           floor_level = COALESCE(?, floor_level),
           status = COALESCE(?, status)
       WHERE slot_id = ?`,
      [
        slot_number ? slot_number.trim() : null,
        slot_type ? slot_type.toUpperCase() : null,
        floor_level || null,
        status ? status.toUpperCase() : null,
        slotId
      ]
    );

    ActivityLogService.log({
      action: 'Admin updated a parking slot',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'SLOT',
      entityId: slotId,
      details: { oldStatus: existing[0].status, newStatus: status, slot_number },
      req
    });

    res.json({
      success: true,
      message: 'Parking slot updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a slot (Admin)
 */
const deleteSlot = async (req, res, next) => {
  try {
    const slotId = parseInt(req.params.id, 10);

    await pool.execute('DELETE FROM parking_slots WHERE slot_id = ?', [slotId]);

    ActivityLogService.log({
      action: 'Admin deleted parking slot',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'SLOT',
      entityId: slotId,
      req
    });

    res.json({
      success: true,
      message: 'Parking slot deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSlots,
  getAvailableSlots,
  createSlot,
  updateSlot,
  deleteSlot
};

