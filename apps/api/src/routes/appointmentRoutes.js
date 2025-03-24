const express = require('express');
const router = express.Router();
const webAppointmentController = require('../controllers/webAppointment');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const { uploadimage } = require('../controllers/addDepartmentController');

router.post('/webappointment', verifyTokenAndRefresh,webAppointmentController.createWebAppointment);
router.get('/getslots', verifyTokenAndRefresh,webAppointmentController.getDoctorsSlotes);
router.post("/uploadimage",uploadimage)

module.exports = router;
