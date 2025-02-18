const express = require("express");
const HospitalController = require("../controllers/HospitalControllers");
const router = express.Router();

router.get("/getAllAppointments", HospitalController.getAllAppointments);
router.get(
  "/getAppUpcCompCanTotalCountOnDayBasis",
  HospitalController.getAppUpcCompCanTotalCountOnDayBasis
);
router.get("/departmentsOverView", HospitalController.departmentsOverView);
router.get(
  "/DepartmentBasisAppointmentGraph",
  HospitalController.DepartmentBasisAppointmentGraph
);
router.get(
  "/getDataForWeeklyAppointmentChart",
  HospitalController.getDataForWeeklyAppointmentChart
);
router.get(
  "/AppointmentGraphOnMonthBase",
  HospitalController.AppointmentGraphOnMonthBase
);
module.exports = router;
