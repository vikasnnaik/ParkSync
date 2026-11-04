const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Admin route
router.get('/', requireAuth, requireRole('ADMIN'), userController.getAllUsers);

// Vehicles routes
router.get('/vehicles', requireAuth, userController.getUserVehicles);
router.post('/vehicles', requireAuth, userController.addVehicle);
router.delete('/vehicles/:id', requireAuth, userController.deleteVehicle);

module.exports = router;

