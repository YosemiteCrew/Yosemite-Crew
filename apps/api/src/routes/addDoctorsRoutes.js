const express = require('express');
const AddDoctorsControllers = require('../controllers/addDoctorController');
const router = express.Router();
const {
  verifyTokenAndRefresh,
  refreshToken,
} = require('../middlewares/authMiddleware');

// Define the route to add doctors
router.post('/add-doctors', AddDoctorsControllers.addDoctor);
router.get(
  '/getDoctorsBySpecilizationId/:id',
  AddDoctorsControllers.getDoctorsBySpecilizationId
);
router.get('/getOverview', AddDoctorsControllers.getOverview);
router.get(
  '/searchDoctorsByName',
  verifyTokenAndRefresh,
  AddDoctorsControllers.searchDoctorsByName
);
router.get('/getDoctors/:id', AddDoctorsControllers.getDoctors);
router.put('/updateprofile/:id', AddDoctorsControllers.updateDoctorProfile);
router.delete(
  '/:userId/documents/:docId',
  AddDoctorsControllers.deleteDocumentsToUpdate
);
router.post('/addDoctorsSlots/:id', AddDoctorsControllers.AddDoctorsSlote);
router.get('/getDoctorsSlotes', AddDoctorsControllers.getDoctorsSlotes);
router.get(
  '/getAppointmentForDoctorDashboard',
  AddDoctorsControllers.getAppointmentsForDoctorDashboard
);
router.get(
  '/getLast7DaysAppointmentsTotalCount',
  AddDoctorsControllers.getLast7DaysAppointmentsTotalCount
);
router.put(
  '/AppointmentAcceptedAndCancel/:id',
  AddDoctorsControllers.AppointmentAcceptedAndCancel
);
router.put('/updateAvailability', AddDoctorsControllers.updateAvailability);
router.get(
  '/getAvailabilityStatus',
  AddDoctorsControllers.getAvailabilityStatus
);
module.exports = router;
