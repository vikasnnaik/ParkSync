const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/', requireAuth, reservationController.createReservation);
router.get('/my', requireAuth, reservationController.getMyReservations);
router.get('/', requireAuth, requireRole('ADMIN'), reservationController.getAllReservations);
router.get('/:id', requireAuth, reservationController.getReservationById);
router.post('/:id/cancel', requireAuth, reservationController.cancelReservation);
router.put('/:id/status', requireAuth, requireRole('ADMIN'), reservationController.updateReservationStatus);

module.exports = router;

