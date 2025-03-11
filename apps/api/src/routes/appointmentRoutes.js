const express = require('express');
const router = express.Router();
const webAppointmentController = require('../controllers/webAppointment');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');

router.post('/webappointment', verifyTokenAndRefresh,webAppointmentController.createWebAppointment);
router.get('/getslots', verifyTokenAndRefresh,webAppointmentController.getDoctorsSlotes);

module.exports = router;
