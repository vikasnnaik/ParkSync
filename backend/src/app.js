const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');
const { getStatus: getMySQLStatus } = require('./config/db');
const { getMongoStatus } = require('./config/mongo');

dotenv.config();

const app = express();

// CORS configuration
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, postman) or matching origin
      if (
        !origin ||
        origin === allowedOrigin ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mysql: getMySQLStatus() ? 'connected' : 'disconnected',
    mongodb: getMongoStatus() ? 'connected' : 'disconnected'
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/areas', require('./routes/parkingAreaRoutes'));
app.use('/api/slots', require('./routes/parkingSlotRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/sessions', require('./routes/parkingSessionRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/violations', require('./routes/violationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;

