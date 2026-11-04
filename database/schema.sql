-- ========================================================
-- ParkSync: Intelligent Parking Reservation, Monitoring 
-- and Violation Management System
-- Database Schema for MySQL 8.0 (parksync_db)
-- ========================================================

CREATE DATABASE IF NOT EXISTS parksync_db;
USE parksync_db;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    supabase_uid VARCHAR(64) UNIQUE NULL,
    phone VARCHAR(20) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    role ENUM('DRIVER', 'ADMIN') NOT NULL DEFAULT 'DRIVER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PARKING AREAS TABLE
CREATE TABLE IF NOT EXISTS parking_areas (
    area_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    area_type VARCHAR(50) DEFAULT 'Commercial',
    total_capacity INT NOT NULL DEFAULT 50
);

-- 3. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    registration_no VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type ENUM('CAR', 'BIKE', 'EV') NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(50),
    color VARCHAR(30),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. PARKING SLOTS TABLE
CREATE TABLE IF NOT EXISTS parking_slots (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    slot_number VARCHAR(20) NOT NULL,
    slot_type ENUM('CAR', 'BIKE', 'EV', 'DISABLED') NOT NULL DEFAULT 'CAR',
    status ENUM('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
    floor_level VARCHAR(20) DEFAULT '1',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES parking_areas(area_id) ON DELETE CASCADE,
    UNIQUE KEY uq_area_slot (area_id, slot_number)
);

-- 5. RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES parking_slots(slot_id) ON DELETE CASCADE
);

-- 6. PARKING SESSIONS TABLE
CREATE TABLE IF NOT EXISTS parking_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NULL,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    entry_time DATETIME NOT NULL,
    exit_time DATETIME NULL,
    status ENUM('ONGOING', 'COMPLETED') NOT NULL DEFAULT 'ONGOING',
    parking_fee DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES parking_slots(slot_id) ON DELETE CASCADE
);

-- 7. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('CASH', 'CARD', 'UPI', 'WALLET') NOT NULL,
    payment_status ENUM('SUCCESS', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    payment_time DATETIME NULL,
    transaction_id VARCHAR(100) NULL UNIQUE,
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE
);

-- 8. VIOLATIONS TABLE
CREATE TABLE IF NOT EXISTS violations (
    violation_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    slot_id INT NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    violation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    fine_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES parking_slots(slot_id) ON DELETE CASCADE
);

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 10. PAYMENT AUDIT TABLE
CREATE TABLE IF NOT EXISTS payment_audit (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- VIEWS
-- ========================================================
CREATE OR REPLACE VIEW reservation_details AS
SELECT 
    r.reservation_id,
    r.user_id,
    u.name AS user_name,
    u.email AS user_email,
    u.phone AS user_phone,
    r.vehicle_id,
    v.registration_no,
    v.vehicle_type,
    r.slot_id,
    s.slot_number,
    s.slot_type,
    a.area_id,
    a.name AS area_name,
    a.location AS area_location,
    r.start_time,
    r.end_time,
    r.status AS reservation_status,
    r.created_at,
    p.payment_id,
    p.amount,
    p.payment_status,
    p.payment_method
FROM reservations r
JOIN users u ON r.user_id = u.user_id
JOIN vehicles v ON r.vehicle_id = v.vehicle_id
JOIN parking_slots s ON r.slot_id = s.slot_id
JOIN parking_areas a ON s.area_id = a.area_id
LEFT JOIN payments p ON r.reservation_id = p.reservation_id;

-- ========================================================
-- TRIGGERS
-- ========================================================

-- Trigger 1: Automatically update slot status to RESERVED when a reservation is confirmed
DELIMITER $$
CREATE TRIGGER trg_reservation_slot_status
AFTER INSERT ON reservations
FOR EACH ROW
BEGIN
    IF NEW.status = 'CONFIRMED' THEN
        UPDATE parking_slots SET status = 'RESERVED' WHERE slot_id = NEW.slot_id;
    END IF;
END$$

-- Trigger 2: Free up slot when reservation is cancelled
CREATE TRIGGER trg_reservation_cancelled
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        UPDATE parking_slots SET status = 'AVAILABLE' WHERE slot_id = NEW.slot_id;
    END IF;
END$$

-- Trigger 3: Payment audit logger trigger
CREATE TRIGGER trg_payment_audit
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF OLD.payment_status != NEW.payment_status THEN
        INSERT INTO payment_audit (payment_id, old_status, new_status, changed_at)
        VALUES (NEW.payment_id, OLD.payment_status, NEW.payment_status, NOW());
    END IF;
END$$

-- Trigger 4: Payment success trigger
CREATE TRIGGER trg_payment_success
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF NEW.payment_status = 'SUCCESS' AND OLD.payment_status != 'SUCCESS' THEN
        UPDATE reservations SET status = 'CONFIRMED' WHERE reservation_id = NEW.reservation_id;
    END IF;
END$$
DELIMITER ;

