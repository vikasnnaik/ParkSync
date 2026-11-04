const { pool } = require('../config/db');
const ActivityLogService = require('../services/activityLogService');

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.user_id, u.name, u.email, u.phone, u.role, u.created_at,
              COUNT(DISTINCT v.vehicle_id) AS vehicle_count,
              COUNT(DISTINCT r.reservation_id) AS reservation_count
       FROM users u
       LEFT JOIN vehicles v ON u.user_id = v.user_id
       LEFT JOIN reservations r ON u.user_id = r.user_id
       GROUP BY u.user_id
       ORDER BY u.created_at DESC`
    );

    res.json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vehicles for current user, specific user, or all vehicles (Admin)
 */
const getUserVehicles = async (req, res, next) => {
  try {
    // If Admin requests all vehicles (or admin without specific userId)
    if (req.user.role === 'ADMIN' && (req.query.all === 'true' || !req.query.userId)) {
      const [vehicles] = await pool.execute(
        `SELECT v.vehicle_id, v.user_id, v.registration_no, v.vehicle_type, v.brand, v.model, v.color,
                u.name AS owner_name, u.email AS owner_email
         FROM vehicles v
         JOIN users u ON v.user_id = u.user_id
         ORDER BY v.registration_no ASC`
      );

      return res.json({
        success: true,
        count: vehicles.length,
        vehicles
      });
    }

    let targetUserId = req.user.userId;

    if (req.user.role === 'ADMIN' && req.query.userId) {
      targetUserId = parseInt(req.query.userId, 10);
    }

    const [vehicles] = await pool.execute(
      `SELECT v.vehicle_id, v.user_id, v.registration_no, v.vehicle_type, v.brand, v.model, v.color,
              u.name AS owner_name, u.email AS owner_email
       FROM vehicles v
       JOIN users u ON v.user_id = u.user_id
       WHERE v.user_id = ?
       ORDER BY v.vehicle_id DESC`,
      [targetUserId]
    );

    res.json({
      success: true,
      count: vehicles.length,
      vehicles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new vehicle
 */
const addVehicle = async (req, res, next) => {
  try {
    const { registration_no, vehicle_type, brand = '', model = '', color = '' } = req.body;

    if (!registration_no || !vehicle_type) {
      return res.status(400).json({
        success: false,
        message: 'Registration number and vehicle type (CAR, BIKE, EV) are required.'
      });
    }

    const cleanRegNo = registration_no.trim().toUpperCase();
    const cleanType = vehicle_type.trim().toUpperCase();

    if (!['CAR', 'BIKE', 'EV'].includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type. Allowed types: CAR, BIKE, EV.'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO vehicles (user_id, registration_no, vehicle_type, brand, model, color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, cleanRegNo, cleanType, brand, model, color]
    );

    ActivityLogService.log({
      action: 'Vehicle added',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'VEHICLE',
      entityId: result.insertId,
      details: { registration_no: cleanRegNo, vehicle_type: cleanType, brand, model },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully.',
      vehicleId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a vehicle
 */
const deleteVehicle = async (req, res, next) => {
  try {
    const vehicleId = parseInt(req.params.id, 10);

    const [vehicles] = await pool.execute(
      'SELECT vehicle_id, user_id, registration_no FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );

    if (vehicles.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    if (req.user.role !== 'ADMIN' && vehicles[0].user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this vehicle.' });
    }

    await pool.execute('DELETE FROM vehicles WHERE vehicle_id = ?', [vehicleId]);

    ActivityLogService.log({
      action: 'Vehicle deleted',
      actorId: req.user.userId,
      actorRole: req.user.role,
      actorEmail: req.user.email,
      entityType: 'VEHICLE',
      entityId: vehicleId,
      details: { registration_no: vehicles[0].registration_no },
      req
    });

    res.json({
      success: true,
      message: 'Vehicle removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserVehicles,
  addVehicle,
  deleteVehicle
};

