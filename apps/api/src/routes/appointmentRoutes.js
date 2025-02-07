const express = require('express');
const router = express.Router();
const webAppointmentController = require('../controllers/webAppointment');

router.post('/webappointment', webAppointmentController.createWebAppointment);
router.get('/getslots', webAppointmentController.getDoctorsSlotes);

module.exports = router;
