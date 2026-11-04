const express = require('express');
const router = express.Router();
const parkingAreaController = require('../controllers/parkingAreaController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public/Driver accessible
router.get('/', parkingAreaController.getAllAreas);
router.get('/:id', parkingAreaController.getAreaById);

// Admin only
router.post('/', requireAuth, requireRole('ADMIN'), parkingAreaController.createArea);
router.put('/:id', requireAuth, requireRole('ADMIN'), parkingAreaController.updateArea);
router.delete('/:id', requireAuth, requireRole('ADMIN'), parkingAreaController.deleteArea);

module.exports = router;

