import express from 'express';
const router = express.Router();
const webAppointmentController = require('../controllers/WebAppointment');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const { uploadimage } = require('../controllers/AddDepartmentController');

router.post('/Appointment', verifyTokenAndRefresh,webAppointmentController.createWebAppointment);
router.get('/schedule', verifyTokenAndRefresh,webAppointmentController.getDoctorsSlotes);
// router.post("/uploadimage",uploadimage)

module.exports = router;
