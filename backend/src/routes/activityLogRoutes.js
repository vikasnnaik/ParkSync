const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All activity log views are restricted to ADMIN
router.get('/', requireAuth, requireRole('ADMIN'), activityLogController.getActivityLogs);
router.get('/stats', requireAuth, requireRole('ADMIN'), activityLogController.getActivityStats);

module.exports = router;

