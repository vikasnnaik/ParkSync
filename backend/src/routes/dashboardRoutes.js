const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/driver', requireAuth, dashboardController.getDriverStats);
router.get('/admin', requireAuth, requireRole('ADMIN'), dashboardController.getAdminStats);

module.exports = router;

