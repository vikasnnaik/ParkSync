const express = require('express');
const router = express.Router();
const violationController = require('../controllers/violationController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, violationController.getViolations);
router.get('/vehicle-location', requireAuth, requireRole('ADMIN'), violationController.getVehicleLocation);
router.get('/vehicle-location/:identifier', requireAuth, requireRole('ADMIN'), violationController.getVehicleLocation);
router.post('/', requireAuth, requireRole('ADMIN'), violationController.createViolation);
router.put('/:id/status', requireAuth, requireRole('ADMIN'), violationController.updateViolationStatus);
router.post('/:id/pay', requireAuth, violationController.payViolation);

module.exports = router;

