const express = require('express');
const HospitalController = require('../controllers/HospitalControllers');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/getAllAppointments', verifyTokenAndRefresh,HospitalController.getAllAppointments);
router.get(
  '/getAppUpcCompCanTotalCountOnDayBasis',verifyTokenAndRefresh,
  HospitalController.getAppUpcCompCanTotalCountOnDayBasis
);
router.get('/departmentsOverView', verifyTokenAndRefresh,HospitalController.departmentsOverView);
router.get(
  '/DepartmentBasisAppointmentGraph',verifyTokenAndRefresh,
  HospitalController.DepartmentBasisAppointmentGraph
);
router.get(
  '/getDataForWeeklyAppointmentChart',verifyTokenAndRefresh,
  HospitalController.getDataForWeeklyAppointmentChart
);
router.get(
  '/AppointmentGraphOnMonthBase',verifyTokenAndRefresh,
  HospitalController.AppointmentGraphOnMonthBase
);
router.get('/WaitingRoomOverView',verifyTokenAndRefresh, HospitalController.WaitingRoomOverView);
router.get(
  '/WaittingRoomOverViewPatientInQueue',verifyTokenAndRefresh,
  HospitalController.WaittingRoomOverViewPatientInQueue
);
router.get(
  '/getDepartmentDataForHospitalProfile',verifyTokenAndRefresh,
  HospitalController.getDepartmentDataForHospitalProfile
);
router.post('/saveVisibility',verifyTokenAndRefresh, HospitalController.saveVisibility);
router.get('/getVisibility', HospitalController.getVisibility);
router.get('/getConfirmedAppointments',verifyTokenAndRefresh, HospitalController.getConfirmedAppointments);
router.get('/getCompletedAppointments',verifyTokenAndRefresh, HospitalController.getCompletedAppointments);
router.get('/getCanceledAppointments',verifyTokenAndRefresh, HospitalController.getCanceledAppointments);
router.get('/getUpcomingAppointments',verifyTokenAndRefresh, HospitalController.getUpcomingAppointments);
router.get('/getDoctorsTotalAppointments',verifyTokenAndRefresh,HospitalController.getDoctorsTotalAppointments)
router.get('/hospitalDashboard',verifyTokenAndRefresh, HospitalController.hospitalDashboard);
router.get("/getAppointmentsForHospitalDashboard",verifyTokenAndRefresh,HospitalController.getAppointmentsForHospitalDashboard)
router.get('/getMessages',verifyTokenAndRefresh,HospitalController.getMessages)

module.exports = router;
