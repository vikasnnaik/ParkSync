const express = require('express');
const router = express.Router();
const parkingSessionController = require('../controllers/parkingSessionController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, parkingSessionController.getSessions);
router.post('/start', requireAuth, parkingSessionController.startSession);
router.post('/:id/end', requireAuth, parkingSessionController.endSession);

module.exports = router;

