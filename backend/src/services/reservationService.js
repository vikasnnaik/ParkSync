const { pool } = require('../config/db');
const ActivityLogService = require('./activityLogService');

/**
 * Service handling robust Reservation transactions, overlap checks, and race conditions
 */
class ReservationService {
  /**
   * Create a reservation using a MySQL transaction with row locking
   */
  static async createReservation({
    userId,
    userEmail,
    userRole,
    vehicleId,
    slotId,
    startTime,
    endTime,
    paymentMethod = 'UPI',
    req = null
  }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Time validation
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid start or end time format.');
      }

      if (start >= end) {
        throw new Error('Reservation end time must be after start time.');
      }

      const now = new Date();
      // Allow a small 5-minute grace period for clock skew
      if (end <= new Date(now.getTime() - 5 * 60 * 1000)) {
        throw new Error('Cannot create a reservation in the past.');
      }

      // 2. Validate Vehicle ownership & type
      const [vehicles] = await connection.execute(
        'SELECT vehicle_id, user_id, registration_no, vehicle_type FROM vehicles WHERE vehicle_id = ? FOR SHARE',
        [vehicleId]
      );

      if (vehicles.length === 0) {
        throw new Error(`Vehicle with ID ${vehicleId} not found.`);
      }

      const vehicle = vehicles[0];
      if (userRole !== 'ADMIN' && vehicle.user_id !== userId) {
        throw new Error('You can only make reservations for your own registered vehicles.');
      }

      // 3. Lock and validate Parking Slot using SELECT ... FOR UPDATE to avoid race conditions
      const [slots] = await connection.execute(
        'SELECT slot_id, area_id, slot_number, slot_type, status FROM parking_slots WHERE slot_id = ? FOR UPDATE',
        [slotId]
      );

      if (slots.length === 0) {
        throw new Error(`Parking slot with ID ${slotId} not found.`);
      }

      const slot = slots[0];

      if (slot.status === 'MAINTENANCE') {
        throw new Error(`Slot ${slot.slot_number} is currently under maintenance and cannot be reserved.`);
      }

      // Check slot type compatibility with vehicle type
      if (slot.slot_type !== slot.slot_type && slot.slot_type !== 'DISABLED') {
        // Check if vehicle type matches slot type
        if (slot.slot_type !== vehicle.vehicle_type) {
          throw new Error(
            `Incompatible slot type. Slot ${slot.slot_number} is designated for ${slot.slot_type}, but your vehicle is ${vehicle.vehicle_type}.`
          );
        }
      }

      // 4. Overlap Check for the same slot
      // Overlap condition: existing_start < new_end AND existing_end > new_start
      const overlapQuery = `
        SELECT reservation_id, start_time, end_time, status
        FROM reservations
        WHERE slot_id = ?
          AND status IN ('CONFIRMED', 'ACTIVE')
          AND start_time < ?
          AND end_time > ?
        FOR UPDATE
      `;

      const [conflicts] = await connection.execute(overlapQuery, [
        slotId,
        end.toISOString().slice(0, 19).replace('T', ' '),
        start.toISOString().slice(0, 19).replace('T', ' ')
      ]);

      if (conflicts.length > 0) {
        throw new Error(
          `Slot ${slot.slot_number} is already reserved for the selected time window (${new Date(
            conflicts[0].start_time
          ).toLocaleTimeString()} - ${new Date(conflicts[0].end_time).toLocaleTimeString()}). Please choose another slot or time.`
        );
      }

      // 5. Insert Reservation record
      const insertReservationSql = `
        INSERT INTO reservations (user_id, vehicle_id, slot_id, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, 'CONFIRMED')
      `;

      const formattedStart = start.toISOString().slice(0, 19).replace('T', ' ');
      const formattedEnd = end.toISOString().slice(0, 19).replace('T', ' ');

      const [resResult] = await connection.execute(insertReservationSql, [
        userId,
        vehicleId,
        slotId,
        formattedStart,
        formattedEnd
      ]);

      const reservationId = resResult.insertId;

      // 6. Explicitly set slot status to RESERVED if trigger doesn't cover all cases
      await connection.execute(
        `UPDATE parking_slots SET status = 'RESERVED' WHERE slot_id = ?`,
        [slotId]
      );

      // 7. Calculate estimated fee and create pending payment record
      // Standard rate in INR: ₹20/hr (Bike), ₹40/hr (EV), ₹50/hr (Car), minimum 1 hour
      const durationHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
      const hourlyRate = vehicle.vehicle_type === 'BIKE' ? 20.00 : vehicle.vehicle_type === 'EV' ? 40.00 : 50.00;
      const estimatedAmount = Number((durationHours * hourlyRate).toFixed(2));

      const [payResult] = await connection.execute(
        `INSERT INTO payments (reservation_id, amount, payment_method, payment_status, payment_time)
         VALUES (?, ?, ?, 'PENDING', NOW())`,
        [reservationId, estimatedAmount, paymentMethod]
      );

      // 8. Create user notification
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, created_at)
         VALUES (?, ?, ?, NOW())`,
        [
          userId,
          'Reservation Confirmed',
          `Your reservation #${reservationId} for slot ${slot.slot_number} (${vehicle.registration_no}) has been confirmed.`
        ]
      );

      // Commit transaction
      await connection.commit();

      // Log action to MongoDB (outside MySQL transaction)
      ActivityLogService.log({
        action: 'Reservation created',
        actorId: userId,
        actorRole: userRole,
        actorEmail: userEmail,
        entityType: 'RESERVATION',
        entityId: reservationId,
        details: {
          slotId,
          slotNumber: slot.slot_number,
          vehicleId,
          registrationNo: vehicle.registration_no,
          startTime: formattedStart,
          endTime: formattedEnd,
          amount: estimatedAmount,
          paymentId: payResult.insertId
        },
        req
      });

      return {
        reservationId,
        slotId,
        slotNumber: slot.slot_number,
        vehicleId,
        registrationNo: vehicle.registration_no,
        startTime: formattedStart,
        endTime: formattedEnd,
        status: 'CONFIRMED',
        amount: estimatedAmount,
        paymentId: payResult.insertId,
        paymentStatus: 'PENDING'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancel a reservation safely inside a transaction
   */
  static async cancelReservation({
    reservationId,
    userId,
    userRole,
    userEmail,
    reason = 'Cancelled by user',
    req = null
  }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Fetch reservation with lock
      const [rows] = await connection.execute(
        `SELECT r.reservation_id, r.user_id, r.slot_id, r.vehicle_id, r.status, s.slot_number
         FROM reservations r
         JOIN parking_slots s ON r.slot_id = s.slot_id
         WHERE r.reservation_id = ?
         FOR UPDATE`,
        [reservationId]
      );

      if (rows.length === 0) {
        throw new Error(`Reservation #${reservationId} not found.`);
      }

      const resv = rows[0];

      if (userRole !== 'ADMIN' && resv.user_id !== userId) {
        throw new Error('You do not have permission to cancel this reservation.');
      }

      if (resv.status === 'CANCELLED') {
        throw new Error('This reservation has already been cancelled.');
      }

      if (resv.status === 'COMPLETED') {
        throw new Error('Cannot cancel a completed reservation.');
      }

      // Update reservation status to CANCELLED
      await connection.execute(
        `UPDATE reservations SET status = 'CANCELLED' WHERE reservation_id = ?`,
        [reservationId]
      );

      // Check if slot has other upcoming confirmed reservations
      const [otherReservations] = await connection.execute(
        `SELECT reservation_id FROM reservations
         WHERE slot_id = ? AND status IN ('CONFIRMED', 'ACTIVE') AND reservation_id != ?`,
        [resv.slot_id, reservationId]
      );

      // If no other active reservations, free up slot
      if (otherReservations.length === 0) {
        await connection.execute(
          `UPDATE parking_slots SET status = 'AVAILABLE' WHERE slot_id = ?`,
          [resv.slot_id]
        );
      }

      // Update any pending payment to FAILED/CANCELLED
      await connection.execute(
        `UPDATE payments SET payment_status = 'FAILED' WHERE reservation_id = ? AND payment_status = 'PENDING'`,
        [reservationId]
      );

      // Create cancellation notification
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, created_at)
         VALUES (?, ?, ?, NOW())`,
        [
          resv.user_id,
          'Reservation Cancelled',
          `Your reservation #${reservationId} for slot ${resv.slot_number} has been cancelled. (${reason})`
        ]
      );

      await connection.commit();

      // Log cancellation to MongoDB
      ActivityLogService.log({
        action: 'Reservation cancelled',
        actorId: userId,
        actorRole: userRole,
        actorEmail: userEmail,
        entityType: 'RESERVATION',
        entityId: reservationId,
        details: {
          slotId: resv.slot_id,
          slotNumber: resv.slot_number,
          reason
        },
        req
      });

      return {
        success: true,
        message: `Reservation #${reservationId} successfully cancelled.`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ReservationService;

