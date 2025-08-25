import express from 'express';
const router = express.Router();
import { verifyToken } from '../middlewares/authMiddleware';
import { emergencyAppointments } from '../controllers/emergency-appointment';



router.post('/createappointment',verifyToken, emergencyAppointments.createEmergencyAppointment)
router.get('/doctors',verifyToken,emergencyAppointments.getDoctorsWithDepartment)
router.get('/getEmergencyAppointment',verifyToken,emergencyAppointments.getEmergencyAppointment)

export default router