import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware';
import HospitalController from '../controllers/HospitalControllers';
const router = express.Router();

router.get('/getAllAppointmentsToAction', verifyToken,HospitalController.getAllAppointmentsToAction);

// router.get('/departmentsOverView', verifyTokenAndRefresh,HospitalController.departmentsOverView);
// router.get(
//   '/DepartmentBasisAppointmentGraph',verifyTokenAndRefresh,
//   HospitalController.DepartmentBasisAppointmentGraph
// );
// router.get(
//   '/getDataForWeeklyAppointmentChart',verifyTokenAndRefresh,
//   HospitalController.getDataForWeeklyAppointmentChart
// );
router.get(
  '/AppointmentGraphOnMonthBase',verifyToken,
  HospitalController.AppointmentGraphOnMonthBase
);

// router.get(
//   '/WaittingRoomOverViewPatientInQueue',verifyTokenAndRefresh,
//   HospitalController.WaittingRoomOverViewPatientInQueue
// );
// router.get(
//   '/getDepartmentDataForHospitalProfile',verifyTokenAndRefresh,
//   HospitalController.getDepartmentDataForHospitalProfile
// );
// router.post('/saveVisibility',verifyTokenAndRefresh, HospitalController.saveVisibility);
// router.get('/getVisibility', HospitalController.getVisibility);
// router.get('/getConfirmedAppointments',verifyTokenAndRefresh, HospitalController.getConfirmedAppointments);
// router.get('/getCompletedAppointments',verifyTokenAndRefresh, HospitalController.getCompletedAppointments);
// router.get('/getCanceledAppointments',verifyTokenAndRefresh, HospitalController.getCanceledAppointments);
// router.get('/getUpcomingAppointments',verifyTokenAndRefresh, HospitalController.getUpcomingAppointments);
// router.get('/getDoctorsTotalAppointments',verifyTokenAndRefresh,HospitalController.getDoctorsTotalAppointments)
// router.get('/MeasureReport/hospitalDashboard',verifyTokenAndRefresh, HospitalController.hospitalDashboard);
// router.get('/Appointment/summaryByDoctor',verifyTokenAndRefresh, HospitalController.getDoctorsTotalAppointments)

router.all("/Appointment",verifyToken,HospitalController.getAppointmentsForHospitalDashboard)
router.get("/AppointmentOverviewStats",verifyToken,HospitalController.AppointmentOverviewStats)
// router.all('/MeasureReport',verifyTokenAndRefresh, HospitalController.WaitingRoomOverView);
router.all('/List',verifyToken,HospitalController.AppointmentGraphs)
// router.get("/Rating", HospitalController.handleGetRating)

// router.get('/getMessages',verifyTokenAndRefresh,HospitalController.getMessages)

export default router;
