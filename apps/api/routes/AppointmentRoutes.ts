import express from 'express';
const router = express.Router();
import webAppointmentController from "../controllers/WebAppointment"
// import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
//import { uploadimage } from '../controllers/AddDepartmentController';

// router.post('/Appointment', verifyTokenAndRefresh,webAppointmentController.createWebAppointment);
// router.get('/schedule', verifyTokenAndRefresh,webAppointmentController.getDoctorsSlotes);
// // router.post("/uploadimage",uploadimage)
router.get('/pets', webAppointmentController.searchPetsForBookAppointment)
export default router;
