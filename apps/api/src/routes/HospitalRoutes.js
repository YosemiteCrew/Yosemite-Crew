const express = require('express');
const HospitalController = require('../controllers/HospitalControllers');
const router = express.Router();

router.get('/getAllAppointments', HospitalController.getAllAppointments);
router.get(
  '/getAppUpcCompCanTotalCountOnDayBasis',
  HospitalController.getAppUpcCompCanTotalCountOnDayBasis
);
router.get('/departmentsOverView', HospitalController.departmentsOverView);
router.get(
  '/DepartmentBasisAppointmentGraph',
  HospitalController.DepartmentBasisAppointmentGraph
);
router.get(
  '/getDataForWeeklyAppointmentChart',
  HospitalController.getDataForWeeklyAppointmentChart
);
router.get(
  '/AppointmentGraphOnMonthBase',
  HospitalController.AppointmentGraphOnMonthBase
);
router.get('/WaitingRoomOverView', HospitalController.WaitingRoomOverView);
router.get(
  '/WaittingRoomOverViewPatientInQueue',
  HospitalController.WaittingRoomOverViewPatientInQueue
);
router.get(
  '/getDepartmentDataForHospitalProfile',
  HospitalController.getDepartmentDataForHospitalProfile
);
router.post('/saveVisibility', HospitalController.saveVisibility);
router.get('/getVisibility', HospitalController.getVisibility);
router.get('/getConfirmedAppointments', HospitalController.getConfirmedAppointments);
router.get('/getCompletedAppointments', HospitalController.getCompletedAppointments);
router.get('/getCanceledAppointments', HospitalController.getCanceledAppointments);
router.get('/getUpcomingAppointments', HospitalController.getUpcomingAppointments);

module.exports = router;
