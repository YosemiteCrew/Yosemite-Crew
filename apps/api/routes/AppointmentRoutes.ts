import express from 'express';
const router = express.Router();
import webAppointmentController from "../controllers/WebAppointment"
import { verifyToken } from '../middlewares/authMiddleware';
// import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
//import { uploadimage } from '../controllers/AddDepartmentController';

// router.post('/Appointment', verifyTokenAndRefresh,webAppointmentController.createWebAppointment);
// router.get('/schedule', verifyTokenAndRefresh,webAppointmentController.getDoctorsSlotes);
// // router.post("/uploadimage",uploadimage)
router.get('/pets', webAppointmentController.searchPetsForBookAppointment)
router.get('/getDoctorsByDepartmentId', webAppointmentController.getDoctorsByDepartmentId)
router.get("/getDoctorSlots",verifyToken, webAppointmentController.getDoctorsSlotes)
router.post("/appointment",verifyToken, webAppointmentController.createWebAppointment)
router.get("/getAllAppointments",verifyToken, webAppointmentController.getAllAppointments)
router.get("/getAllAppointmentsUpComming",verifyToken, webAppointmentController.getAllAppointmentsUpComming)
export default router;
