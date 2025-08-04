import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware';
import AddDoctorsControllers from '../controllers/AddDoctorController';
const router = express.Router();
import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';

// Define the route to add doctors
router.post('/Practitioner', verifyToken, AddDoctorsControllers.addDoctor);
router.get(
  '/getDoctorsBySpecilizationId/:id',
  AddDoctorsControllers.getDoctorsBySpecilizationId
);
router.get('/getForAppDoctorsBySpecilizationId', verifyTokenAndRefresh, AddDoctorsControllers.getForAppDoctorsBySpecilizationId);
// router.get('/MeasureReport', AddDoctorsControllers.getOverview);
router.get(
  '/Practitioner',
  verifyTokenAndRefresh,
  AddDoctorsControllers.searchDoctorsByName
);
router.get('/getDoctors', AddDoctorsControllers.getDoctors);
router.put('/updateprofile/:id', verifyTokenAndRefresh, AddDoctorsControllers.updateDoctorProfile);
router.delete(
  '/:userId/documents/:docId',
  AddDoctorsControllers.deleteDocumentsToUpdate
);
router.get('/getDoctorsSlotes', verifyTokenAndRefresh, AddDoctorsControllers.getDoctorsSlotes);
router.get(
  '/getAppointmentForDoctorDashboard', verifyTokenAndRefresh,
  AddDoctorsControllers.getAppointmentsForDoctorDashboard
);
// router.get(
//   '/getLast7DaysAppointmentsTotalCount',verifyTokenAndRefresh,
//   AddDoctorsControllers.getLast7DaysAppointmentsTotalCount
// );
router.put(
  '/Appointment/:id', verifyTokenAndRefresh,
  AddDoctorsControllers.AppointmentAcceptedAndCancelFHIR
);
router.put('/updateAvailability', verifyToken, AddDoctorsControllers.updateAvailability);
router.get(
  '/getAvailabilityStatus', verifyToken,
  AddDoctorsControllers.getAvailabilityStatus
);
export default router;
