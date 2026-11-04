const { pool } = require('../config/db');

/**
 * Get aggregated statistics for Admin Dashboard
 */
const getAdminStats = async (req, res, next) => {
  try {
    // 1. Slots overview
    const [slotStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_slots,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved_slots,
        SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) AS maintenance_slots
      FROM parking_slots
    `);

    // 2. Areas count
    const [areaStats] = await pool.execute(`SELECT COUNT(*) AS total_areas FROM parking_areas`);

    // 3. Users and vehicles
    const [userStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(CASE WHEN role = 'DRIVER' THEN 1 ELSE 0 END) AS total_drivers,
        SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS total_admins
      FROM users
    `);

    const [vehStats] = await pool.execute(`SELECT COUNT(*) AS total_vehicles FROM vehicles`);

    // 4. Reservations overview
    const [resStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_reservations,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_reservations,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_reservations,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_reservations,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_reservations
      FROM reservations
    `);

    // 5. Financial statistics
    const [payStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_status = 'SUCCESS' THEN amount ELSE 0 END), 0.00) AS total_revenue,
        COUNT(CASE WHEN payment_status = 'SUCCESS' THEN 1 END) AS successful_payments_count,
        COUNT(CASE WHEN payment_status = 'PENDING' THEN 1 END) AS pending_payments_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN amount ELSE 0 END), 0.00) AS pending_amount
      FROM payments
    `);

    // 6. Violations overview
    const [vioStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_violations,
        SUM(CASE WHEN payment_status = 'UNPAID' THEN 1 ELSE 0 END) AS unpaid_violations,
        COALESCE(SUM(CASE WHEN payment_status = 'UNPAID' THEN fine_amount ELSE 0 END), 0.00) AS unpaid_fines,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN fine_amount ELSE 0 END), 0.00) AS collected_fines
      FROM violations
    `);

    // 7. Recent 5 Reservations
    const [recentReservations] = await pool.execute(`
      SELECT 
        r.reservation_id, r.start_time, r.end_time, r.status,
        u.name AS user_name, v.registration_no, s.slot_number, a.name AS area_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      JOIN parking_slots s ON r.slot_id = s.slot_id
      JOIN parking_areas a ON s.area_id = a.area_id
      ORDER BY r.reservation_id DESC
      LIMIT 5
    `);

    const slots = slotStats[0] || {};
    const totalSlots = slots.total_slots || 0;
    const occupiedAndReserved = (slots.occupied_slots || 0) + (slots.reserved_slots || 0);
    const occupancyRate = totalSlots > 0 ? Number(((occupiedAndReserved / totalSlots) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      stats: {
        slots: {
          total: totalSlots,
          available: slots.available_slots || 0,
          occupied: slots.occupied_slots || 0,
          reserved: slots.reserved_slots || 0,
          maintenance: slots.maintenance_slots || 0,
          occupancyRate
        },
        areas: areaStats[0]?.total_areas || 0,
        users: {
          total: userStats[0]?.total_users || 0,
          drivers: userStats[0]?.total_drivers || 0,
          admins: userStats[0]?.total_admins || 0,
          vehicles: vehStats[0]?.total_vehicles || 0
        },
        reservations: {
          total: resStats[0]?.total_reservations || 0,
          confirmed: resStats[0]?.confirmed_reservations || 0,
          active: resStats[0]?.active_reservations || 0,
          completed: resStats[0]?.completed_reservations || 0,
          cancelled: resStats[0]?.cancelled_reservations || 0
        },
        financials: {
          totalRevenue: Number(payStats[0]?.total_revenue || 0),
          successfulCount: payStats[0]?.successful_payments_count || 0,
          pendingCount: payStats[0]?.pending_payments_count || 0,
          pendingAmount: Number(payStats[0]?.pending_amount || 0)
        },
        violations: {
          total: vioStats[0]?.total_violations || 0,
          unpaidCount: vioStats[0]?.unpaid_violations || 0,
          unpaidFines: Number(vioStats[0]?.unpaid_fines || 0),
          collectedFines: Number(vioStats[0]?.collected_fines || 0)
        },
        recentReservations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregated statistics for Driver Dashboard
 */
const getDriverStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. My Vehicles
    const [vehRows] = await pool.execute(
      `SELECT COUNT(*) AS count FROM vehicles WHERE user_id = ?`,
      [userId]
    );

    // 2. My Reservations
    const [resRows] = await pool.execute(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE') THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
       FROM reservations
       WHERE user_id = ?`,
      [userId]
    );

    // 3. My Payments
    const [payRows] = await pool.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN p.payment_status = 'SUCCESS' THEN p.amount ELSE 0 END), 0.00) AS total_paid,
        COUNT(CASE WHEN p.payment_status = 'PENDING' THEN 1 END) AS pending_payments_count,
        COALESCE(SUM(CASE WHEN p.payment_status = 'PENDING' THEN p.amount ELSE 0 END), 0.00) AS pending_amount
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.reservation_id
       WHERE r.user_id = ?`,
      [userId]
    );

    // 4. My Violations
    const [vioRows] = await pool.execute(
      `SELECT 
        COUNT(*) AS total_violations,
        SUM(CASE WHEN v.payment_status = 'UNPAID' THEN 1 ELSE 0 END) AS unpaid_violations,
        COALESCE(SUM(CASE WHEN v.payment_status = 'UNPAID' THEN v.fine_amount ELSE 0 END), 0.00) AS unpaid_fines
       FROM violations v
       JOIN vehicles veh ON v.vehicle_id = veh.vehicle_id
       WHERE veh.user_id = ?`,
      [userId]
    );

    // 5. Recent 3 Active/Upcoming Reservations
    const [upcomingReservations] = await pool.execute(
      `SELECT 
        r.reservation_id, r.start_time, r.end_time, r.status,
        s.slot_number, s.slot_type, a.name AS area_name, a.location,
        v.registration_no, p.amount, p.payment_status
       FROM reservations r
       JOIN parking_slots s ON r.slot_id = s.slot_id
       JOIN parking_areas a ON s.area_id = a.area_id
       JOIN vehicles v ON r.vehicle_id = v.vehicle_id
       LEFT JOIN payments p ON r.reservation_id = p.reservation_id
       WHERE r.user_id = ? AND r.status IN ('CONFIRMED', 'ACTIVE')
       ORDER BY r.start_time ASC
       LIMIT 3`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        vehiclesCount: vehRows[0]?.count || 0,
        activeReservations: resRows[0]?.active_count || 0,
        completedReservations: resRows[0]?.completed_count || 0,
        totalPaid: Number(payRows[0]?.total_paid || 0),
        pendingPayments: payRows[0]?.pending_payments_count || 0,
        pendingAmount: Number(payRows[0]?.pending_amount || 0),
        unpaidViolations: vioRows[0]?.unpaid_violations || 0,
        unpaidFines: Number(vioRows[0]?.unpaid_fines || 0),
        upcomingReservations
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getDriverStats
};

