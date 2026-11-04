# ParkSync: Intelligent Parking Reservation, Monitoring and Violation Management System

> **DBMS Level 3 Full-Stack Mini Project**  
> **Authors:** Vikas N Naik (PES2UG24CS583) & Yashash C (PES2UG24CS611)  
> **Course:** Database Management Systems (5th Semester CSE Lab)

---

## 1. Project Overview

**ParkSync** is a full-stack smart parking management and reservation platform designed to solve real-world parking congestion in commercial complexes, campuses, airports, and hospitals. It offers real-time bay availability tracking, collision-free slot booking with database concurrency locks, barrier check-in/check-out session logging, simulated payment gateway integration, and parking violation enforcement.

The application demonstrates **Polyglot Database Architecture**:
1. **MySQL 8.0 (Relational Database)**: Manages relational transactional models (`users`, `parking_areas`, `vehicles`, `parking_slots`, `reservations`, `parking_sessions`, `payments`, `violations`, `notifications`, and `payment_audit`), enforcing foreign key constraints, ACID transaction safety, database views, and automated triggers.
2. **MongoDB (NoSQL Document Store)**: Asynchronously records system activity and audit event logs in the `activity_logs` collection without burdening relational transactions.

---

## 2. Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios, React Router v7 |
| **Backend** | Node.js, Express.js (REST API architecture) |
| **SQL Database** | MySQL 8.0 (`mysql2/promise` connection pooling) |
| **NoSQL Database**| MongoDB 6.0+ (`mongoose` ODM) |
| **Security** | JWT (JSON Web Tokens), `bcryptjs` password hashing, Parameterized SQL queries |

---

## 3. Architecture & Communication Flow

```
┌──────────────────┐               ┌──────────────────┐
│                  │  HTTP / JSON  │                  │
│   React + Vite   │ ◄───────────► │  Express Backend │
│   Tailwind UI    │  Axios Client │  REST API (:5000)│
│                  │               │                  │
└──────────────────┘               └────────┬─────────┘
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
      ┌─────────────────────┐                               ┌─────────────────────┐
      │      MySQL 8.0      │                               │    MongoDB NoSQL    │
      │   (`parksync_db`)   │                               │  (`parksync_logs`)  │
      ├─────────────────────┤                               ├─────────────────────┤
      │ • ACID Transactions │                               │ • Async Event Logs  │
      │ • SELECT FOR UPDATE │                               │ • `activity_logs`   │
      │ • SQL Triggers      │                               │ • Audit Trails      │
      │ • SQL Views         │                               │ • Fault-tolerant    │
      └─────────────────────┘                               └─────────────────────┘
```

---

## 4. System Features

### 👤 Driver Role
- **Authentication**: Register with role `DRIVER`, log in with encrypted password verification.
- **Browse Parking Hubs**: View parking areas with live occupancy percentages and locations.
- **Slot Availability Matrix**: Interactive, color-coded bay map (Green: Available, Amber: Reserved, Purple: Occupied, Red: Maintenance). Filter by area, designated vehicle type (Car, Bike, EV, Disabled), and bay numbers.
- **Conflict-Free Reservation Engine**: Select vehicle and time window. Automatic price estimation based on vehicle rate. Prevents double-booking with pessimistic row locking.
- **My Reservations**: View active, upcoming, and completed bookings. Cancel active bookings with one click.
- **Parking Sessions**: Track real-time barrier check-ins, check-outs, and accumulated parking fees.
- **Payment Gateway (Demo)**: Review generated receipts and simulate payments (UPI, Card, Wallet, Cash).
- **Violations & Fines**: View issued parking infractions and settle penalties via simulated fine payments.
- **Notifications**: In-app alerts for booking confirmations, cancellations, and payment status updates.

### 🛡️ Administrator Role
- **Executive Dashboard**: Real-time KPI statistics on slot occupancy rates, total revenue collected, active sessions, and unpaid violation fines.
- **Parking Area Management**: Add, edit, and configure parking facilities, locations, and capacity thresholds.
- **Slot Management**: Create bays, assign designated slot types (Car, Bike, EV, Disabled), set floor levels, and toggle maintenance modes.
- **Reservations Control**: Master ledger of all reservations with status overrides (CONFIRMED, ACTIVE, COMPLETED, CANCELLED).
- **Session Barrier Control**: Simulate vehicle arrival (check-in) and departure (check-out) with automatic slot freeing.
- **Payment Ledger & Trigger Audit**: View all payment transactions and examine historical status transitions generated automatically by the MySQL `trg_payment_audit` trigger.
- **Violation Ticketing**: Issue citations with fine penalties directly to vehicle license plates.
- **MongoDB NoSQL Activity Logs**: Filter, search, and inspect JSON payloads of system-wide actions in real time.

---

## 5. Folder Structure

```
ParkSync/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # MySQL 8.0 pool configuration & health check
│   │   │   └── mongo.js              # MongoDB Mongoose connection with graceful degradation
│   │   ├── controllers/
│   │   │   ├── activityLogController.js
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── notificationController.js
│   │   │   ├── parkingAreaController.js
│   │   │   ├── parkingSessionController.js
│   │   │   ├── parkingSlotController.js
│   │   │   ├── paymentController.js
│   │   │   ├── reservationController.js
│   │   │   ├── userController.js
│   │   │   └── violationController.js
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verification & role-based access control
│   │   │   └── errorHandler.js       # Centralized MySQL & API error handling
│   │   ├── models/
│   │   │   └── ActivityLog.js        # Mongoose schema for MongoDB activity_logs
│   │   ├── routes/                   # Modular Express routers
│   │   ├── services/
│   │   │   ├── activityLogService.js # MongoDB logging service
│   │   │   └── reservationService.js # Transactional booking logic & lock safety
│   │   ├── utils/
│   │   │   └── checkDb.js            # Database health & table verification utility
│   │   ├── app.js                    # Express application setup & middleware
│   │   └── server.js                 # HTTP server entry point
│   ├── .env.example
│   ├── .env                          # Local database credentials
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js             # Axios instance with JWT interceptor & API methods
│   │   ├── components/
│   │   │   ├── common/               # Badge, ConfirmModal, EmptyState, Loader, StatCard
│   │   │   └── layout/               # MainLayout, Navbar, Sidebar
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Global authentication state
│   │   ├── pages/
│   │   │   ├── admin/                # Admin views (Dashboard, Areas, Slots, Logs, etc.)
│   │   │   ├── auth/                 # Login & Register
│   │   │   └── driver/               # Driver views (Dashboard, Booking, Slots, etc.)
│   │   ├── App.jsx                   # Route configuration
│   │   ├── index.css                 # Tailwind directives
│   │   └── main.jsx
│   ├── .env.example
│   ├── .env
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── database/
│   └── schema.sql                    # Full MySQL DDL, Views & Triggers reference
├── package.json                      # Monorepo convenience scripts
└── README.md                         # Documentation
```

---

## 6. Database Setup & Configuration

### MySQL Configuration
1. Open `backend/.env`.
2. Configure your MySQL credentials:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:5173
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password_here
   MYSQL_DATABASE=parksync_db
   ```
3. Test your MySQL connection and verify existing database tables:
   ```bash
   npm run check-db
   ```
   *(If on a fresh machine where `parksync_db` has not yet been imported, load `database/schema.sql` into MySQL Workbench or via command line `mysql -u root -p < database/schema.sql`).*

### MongoDB Configuration
1. Ensure the MongoDB service is running locally on port 27017 (or provide a cloud MongoDB Atlas URI):
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/parksync_logs
   ```
2. *Graceful fallback:* If MongoDB is not running, the application starts normally with a clear status indicator. Activity logs are safely skipped without breaking core MySQL reservation operations.

---

## 7. Installation & Running the Application

### Step 1: Install Dependencies
From the project root:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Step 2: Start the Backend Server
```bash
cd backend
npm run dev
```
Backend will start on: **`http://localhost:5000`**  
Health Check endpoint: **`http://localhost:5000/api/health`**

### Razorpay Integration Test
To run the automated Razorpay E2E integration test suite:
```bash
cd backend
npm run test-razorpay
```
*(Verifies Razorpay SDK initialization, order creation, HMAC SHA256 signature verification, tampered signature rejection, MySQL status updates, trigger auditing, MongoDB event logging, and idempotency).*

### Step 3: Start the Frontend Application
In a separate terminal:
```bash
cd frontend
npm run dev
```
Frontend will be accessible at: **`http://localhost:5173`**

---

## 8. Demo User Credentials (Quick Viva Access)

You can log in with your existing database users or use the one-click demo credentials provided on the login page:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@parksync.com` | `admin123` | Full administrative control |
| **Driver** | `driver@parksync.com` | `driver123` | Vehicle registration, slot booking |

*(New users can also be registered at any time on `/register`)*

---

## 9. API Endpoint Reference

### Authentication
- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Authenticate and receive JWT token
- `GET /api/auth/profile` — Get authenticated user details

### Parking Areas & Slots
- `GET /api/areas` — List all parking facilities with live availability counts
- `POST /api/areas` — Create parking area *(Admin)*
- `PUT /api/areas/:id` — Update parking area *(Admin)*
- `DELETE /api/areas/:id` — Delete parking area *(Admin)*
- `GET /api/slots` — Browse slots with search, area, and type filters
- `GET /api/slots/available` — Query slots available for a specific time window
- `POST /api/slots` — Add a parking slot *(Admin)*
- `PUT /api/slots/:id` — Update slot status/type *(Admin)*
- `DELETE /api/slots/:id` — Delete slot *(Admin)*

### Reservations & Concurrency
- `POST /api/reservations` — Create reservation inside an ACID transaction with pessimistic row lock
- `GET /api/reservations/my` — Get user's reservations (uses SQL View `reservation_details`)
- `GET /api/reservations` — List all reservations across areas *(Admin)*
- `POST /api/reservations/:id/cancel` — Cancel booking and release slot
- `PUT /api/reservations/:id/status` — Administrative status change *(Admin)*

### Sessions, Payments & Violations
- `GET /api/sessions` — List active or past parking barrier sessions
- `POST /api/sessions/start` — Vehicle entry simulation
- `POST /api/sessions/:id/end` — Vehicle exit simulation (calculates fee)
- `GET /api/payments` — Retrieve payment receipts
- `GET /api/payments/config/razorpay` — Get public Razorpay Key ID for Checkout
- `POST /api/payments/create-order` — Create Razorpay order with trusted server-side calculated amount
- `POST /api/payments/verify` — Verify Razorpay cryptographic signature (HMAC SHA256) & update DB atomically
- `POST /api/payments/failure` — Handle/log payment failure or dismissal
- `POST /api/payments/:id/pay` — Safe demo payment processing (triggers `trg_payment_audit`)
- `GET /api/payments/audit` — View `payment_audit` table entries *(Admin)*
- `GET /api/violations` — View vehicle violations and fine amounts
- `POST /api/violations` — Issue a new violation ticket *(Admin)*
- `POST /api/violations/:id/pay` — Settle violation fine via demo payment

### NoSQL & Dashboards
- `GET /api/activity-logs` — Paginated MongoDB activity log records *(Admin)*
- `GET /api/dashboard/driver` — Aggregated driver metrics
- `GET /api/dashboard/admin` — Master administrative KPIs & live occupancy %
- `GET /api/health` — System health and dual database status check

---

## 10. Key DBMS Concepts Demonstrated

1. **Relational Data Modeling & Normalization**:
   - Structured in 3NF / BCNF to prevent update, insertion, and deletion anomalies.
   - Referenced integrity maintained across 10 tables using primary keys (`INT AUTO_INCREMENT`) and foreign keys with `ON DELETE CASCADE` or `SET NULL`.
2. **ACID Transactions & Concurrency Control**:
   - Implemented in `ReservationService.createReservation` using `START TRANSACTION`, `COMMIT`, and `ROLLBACK`.
   - Employs **Pessimistic Row Locking** (`SELECT ... FOR UPDATE`) on target slots to prevent race conditions when two drivers attempt to book the exact same slot concurrently.
   - Comprehensive time-window overlap formula:
     ```sql
     WHERE slot_id = ?
       AND status IN ('CONFIRMED', 'ACTIVE')
       AND start_time < :requested_end
       AND end_time > :requested_start
     ```
3. **Database Triggers**:
   - `trg_reservation_slot_status`: Changes slot status to `RESERVED` on reservation confirmation.
   - `trg_reservation_cancelled`: Restores slot status to `AVAILABLE` on reservation cancellation.
   - `trg_payment_success`: Updates reservation status upon successful payment.
   - `trg_payment_audit`: Automatically inserts an audit record into `payment_audit` whenever a payment status transition occurs.
4. **Database Views**:
   - `reservation_details`: Encapsulates a multi-table join (`reservations`, `users`, `vehicles`, `parking_slots`, `parking_areas`, and `payments`) for streamlined queries.
5. **Polyglot Persistence**:
   - Relational ACID transactional integrity in MySQL combined with asynchronous document storage in MongoDB for decoupled, high-throughput event logging.

---

## 11. Viva Demonstration Guide

When presenting to professors or examiners:
1. **Show Architecture**: Point out the live database indicators in the top navigation bar demonstrating that both MySQL and MongoDB are online.
2. **Show Booking Conflict Prevention**: Reserve Slot A-101 for a specific time window. Open a second browser session and attempt to reserve the same slot for overlapping hours — observe the friendly collision rejection.
3. **Show Trigger in Action**: Go to Payments and click **Pay Demo**. Then switch to Admin -> Payments -> **Trigger Audit Trail** to show the row inserted into `payment_audit` by MySQL trigger `trg_payment_audit`.
4. **Show NoSQL Integration**: Go to Admin -> **Activity Logs (NoSQL)** to show the real-time event documents written to MongoDB collection `activity_logs`.

