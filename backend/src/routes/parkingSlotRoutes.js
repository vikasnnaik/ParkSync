const express = require('express');
const router = express.Router();
const parkingSlotController = require('../controllers/parkingSlotController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Available to drivers & admins
router.get('/', parkingSlotController.getAllSlots);
router.get('/available', parkingSlotController.getAvailableSlots);

// Admin only
router.post('/', requireAuth, requireRole('ADMIN'), parkingSlotController.createSlot);
router.put('/:id', requireAuth, requireRole('ADMIN'), parkingSlotController.updateSlot);
router.delete('/:id', requireAuth, requireRole('ADMIN'), parkingSlotController.deleteSlot);

module.exports = router;

