const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');

/**
 * Get all parking areas with current availability stats
 */
const getAllAreas = async (req, res, next) => {
  try {
    const [areas] = await pool.execute(
      `SELECT 
        a.area_id,
        a.name,
        a.location,
        a.area_type,
        a.total_capacity,
        COUNT(s.slot_id) AS total_slots,
        SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN s.status = 'OCCUPIED' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN s.status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved_slots,
        SUM(CASE WHEN s.status = 'MAINTENANCE' THEN 1 ELSE 0 END) AS maintenance_slots
       FROM parking_areas a
       LEFT JOIN parking_slots s ON a.area_id = s.area_id
       GROUP BY a.area_id
       ORDER BY a.name ASC`
    );

    res.json({
      success: true,
      areas
    });
  } catch (error) {
    // Fallback if total_capacity column is named capacity
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage.includes('total_capacity')) {
      try {
        const [fallbackAreas] = await pool.execute(
          `SELECT 
            a.area_id,
            a.name,
            a.location,
            a.capacity AS total_capacity,
            COUNT(s.slot_id) AS total_slots,
            SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_slots
           FROM parking_areas a
           LEFT JOIN parking_slots s ON a.area_id = s.area_id
           GROUP BY a.area_id
           ORDER BY a.name ASC`
        );
        return res.json({ success: true, areas: fallbackAreas });
      } catch (err2) {
        return next(err2);
      }
    }
    next(error);
  }
};

/**
 * Get single area by ID with its slots
 */
const getAreaById = async (req, res, next) => {
  try {
    const areaId = parseInt(req.params.id, 10);

    const [areas] = await pool.execute(
      'SELECT * FROM parking_areas WHERE area_id = ?',
      [areaId]
    );

    if (areas.length === 0) {
      return res.status(404).json({ success: false, message: 'Parking area not found.' });
    }

    const [slots] = await pool.execute(
      'SELECT * FROM parking_slots WHERE area_id = ? ORDER BY slot_number ASC',
      [areaId]
    );

    res.json({
      success: true,
      area: areas[0],
      slots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new parking area (Admin)
 */
const createArea = async (req, res, next) => {
  try {
    const { name, location, area_type = 'Commercial', total_capacity = 20 } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, message: 'Name and location are required.' });
    }

    let insertSql = `INSERT INTO parking_areas (name, location, area_type, total_capacity) VALUES (?, ?, ?, ?)`;
    let params = [name, location, area_type, total_capacity];

    let result;
    try {
      [result] = await pool.execute(insertSql, params);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage.includes('total_capacity')) {
        [result] = await pool.execute(
          `INSERT INTO parking_areas (name, location, capacity) VALUES (?, ?, ?)`,
          [name, location, total_capacity]
        );
      } else {
        throw err;
      }
    }

    ActivityLogService.log({
      action: 'Admin created parking area',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PARKING_AREA',
      entityId: result.insertId,
      details: { name, location, total_capacity },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Parking area created successfully.',
      areaId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing parking area (Admin)
 */
const updateArea = async (req, res, next) => {
  try {
    const areaId = parseInt(req.params.id, 10);
    const { name, location, area_type, total_capacity } = req.body;

    let updateSql = `
      UPDATE parking_areas 
      SET name = COALESCE(?, name),
          location = COALESCE(?, location),
          area_type = COALESCE(?, area_type),
          total_capacity = COALESCE(?, total_capacity)
      WHERE area_id = ?
    `;

    try {
      await pool.execute(updateSql, [name, location, area_type, total_capacity, areaId]);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await pool.execute(
          `UPDATE parking_areas SET name = COALESCE(?, name), location = COALESCE(?, location) WHERE area_id = ?`,
          [name, location, areaId]
        );
      } else {
        throw err;
      }
    }

    ActivityLogService.log({
      action: 'Admin updated parking area',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PARKING_AREA',
      entityId: areaId,
      details: { name, location, total_capacity },
      req
    });

    res.json({
      success: true,
      message: 'Parking area updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a parking area (Admin)
 */
const deleteArea = async (req, res, next) => {
  try {
    const areaId = parseInt(req.params.id, 10);

    await pool.execute('DELETE FROM parking_areas WHERE area_id = ?', [areaId]);

    ActivityLogService.log({
      action: 'Admin deleted parking area',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'PARKING_AREA',
      entityId: areaId,
      req
    });

    res.json({
      success: true,
      message: 'Parking area deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea
};

