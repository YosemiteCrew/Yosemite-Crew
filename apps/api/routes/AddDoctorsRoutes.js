const express = require('express');
const AddDoctorsControllers = require('../controllers/AddDoctorController');
const router = express.Router();
const {
  verifyTokenAndRefresh,
  // refreshToken,
} = require('../middlewares/authMiddleware');

// Define the route to add doctors
router.post('/Practitioner',verifyTokenAndRefresh, AddDoctorsControllers.addDoctor);
router.get(
  '/getDoctorsBySpecilizationId/:id',
  AddDoctorsControllers.getDoctorsBySpecilizationId
);
router.get('/getForAppDoctorsBySpecilizationId',verifyTokenAndRefresh, AddDoctorsControllers.getForAppDoctorsBySpecilizationId);
// router.get('/MeasureReport', AddDoctorsControllers.getOverview);
router.get(
  '/Practitioner',
  verifyTokenAndRefresh,
  AddDoctorsControllers.searchDoctorsByName
);
router.get('/getDoctors/:id', AddDoctorsControllers.getDoctors);
router.put('/updateprofile/:id', verifyTokenAndRefresh,AddDoctorsControllers.updateDoctorProfile);
router.delete(
  '/:userId/documents/:docId',
  AddDoctorsControllers.deleteDocumentsToUpdate
);
router.post('/addDoctorsSlots/:id',verifyTokenAndRefresh, AddDoctorsControllers.AddDoctorsSlote);
router.get('/getDoctorsSlotes',verifyTokenAndRefresh, AddDoctorsControllers.getDoctorsSlotes);
router.get(
  '/getAppointmentForDoctorDashboard',verifyTokenAndRefresh,
  AddDoctorsControllers.getAppointmentsForDoctorDashboard
);
// router.get(
//   '/getLast7DaysAppointmentsTotalCount',verifyTokenAndRefresh,
//   AddDoctorsControllers.getLast7DaysAppointmentsTotalCount
// );
router.put(
  '/Appointment/:id',verifyTokenAndRefresh,
  AddDoctorsControllers.AppointmentAcceptedAndCancelFHIR
);
router.put('/updateAvailability', verifyTokenAndRefresh,AddDoctorsControllers.updateAvailability);
router.get(
  '/getAvailabilityStatus',verifyTokenAndRefresh,
  AddDoctorsControllers.getAvailabilityStatus
);
module.exports = router;
