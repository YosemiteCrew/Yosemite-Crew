const express = require("express");
const {
  handlehome,
} = require("../controllers/user");
const PetController = require('../controllers/PetController');
const AppointmentController = require('../controllers/AppointmentController');
const SlotController = require('../controllers/SlotController');
const FeedbackController = require('../controllers/FeedbackController');
const DetailsController = require('../controllers/DetailsController');
const ListController = require('../controllers/ListController');
const ImmunizationController = require("../controllers/ImmunizationController");
const DiabetesController = require("../controllers/DiabetesController");

const { handleContactUs } = require("../controllers/contact");

const {
  handleExercisePlan,
  handleAddPainJournal,
  handleGetExercisePlan,
  handleGetPainJournal,
} = require("../controllers/plan");
const {
  handlesaveMedicalRecord,
  handleMedicalRecordList,
} = require("../controllers/medicalRecords");

const {
  handleSaveSharedDuties,
  handleEditSharedDuties,
  handleGetSharedDuties,
} = require("../controllers/sharedDuties");

const router = express.Router();
const multer = require("multer");
const fs = require('fs');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./Uploads/Images");
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB limit
});
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');

router.post("/Patient/addPet", verifyTokenAndRefresh,PetController.handleAddPet);
router.put("/Patient/editPet", verifyTokenAndRefresh, PetController.handleEditPet);
router.get("/Patient/getPets", verifyTokenAndRefresh,PetController.handleGetPet);
router.delete("/Patient/deletepet", verifyTokenAndRefresh, PetController.handleDeletePet);
router.post("/bookAppointment",verifyTokenAndRefresh, AppointmentController.handleBookAppointment);
router.get("/getAppointments", verifyTokenAndRefresh, AppointmentController.handleGetAppointment);
router.put("/cancelAppointment", verifyTokenAndRefresh, AppointmentController.handleCancelAppointment);
router.put("/rescheduleAppointment",verifyTokenAndRefresh, AppointmentController.handleRescheduleAppointment);
router.get("/Slot/getTimeSlots", verifyTokenAndRefresh, SlotController.handlegetTimeSlots);
router.get("/Slot/getTimeSlotsByMonth",verifyTokenAndRefresh,SlotController.handleTimeSlotsByMonth);
router.post("/Observation/saveFeedBack",verifyTokenAndRefresh,FeedbackController.handleSaveFeedBack);
router.get("/Observation/getFeedBack",verifyTokenAndRefresh,FeedbackController.handleGetFeedback);
router.put("/Observation/editFeedBack",verifyTokenAndRefresh,FeedbackController.handleEditFeedback);
router.delete("/Observation/deleteFeedBack",verifyTokenAndRefresh,FeedbackController.handleDeleteFeedback);


router.post("/Organization/addVetClinic", verifyTokenAndRefresh, DetailsController.handleVetClinic);
router.post("/Organization/addBreederDetails", verifyTokenAndRefresh,  DetailsController.handleBreeder);
router.post("/Organization/addPetGroomer",verifyTokenAndRefresh, DetailsController.handlePetGroomer);
router.post("/Organization/addPetBoarding",verifyTokenAndRefresh, DetailsController.handlePetBoarding);


router.post("/sendquery", verifyTokenAndRefresh,handleContactUs);
router.get("/Organization/getLists",verifyTokenAndRefresh, ListController.handleGetLists);
router.get("/Practitioner/getDoctorsLists",verifyTokenAndRefresh,ListController.handlegetDoctorsList);
router.get("/Practitioner/getDoctorsTeam/:businessId",verifyTokenAndRefresh,ListController.handleGetDoctorsTeam);

router.post("/Immunization/addVaccinationRecord",verifyTokenAndRefresh,ImmunizationController.handlecreateImmunization);
router.put("/Immunization/editVaccinationRecord", verifyTokenAndRefresh,ImmunizationController.handleEditVaccination);
router.get("/Immunization/getVaccinationRecord", verifyTokenAndRefresh,ImmunizationController.handleGetVaccination);
router.delete("/Immunization/deleteVaccinationRecord",verifyTokenAndRefresh,ImmunizationController.handleDeleteVaccinationRecord);
router.get("/Immunization/recentVaccinationRecords", verifyTokenAndRefresh,ImmunizationController.recentVaccinationRecord);

router.post("/saveExercisePlan",verifyTokenAndRefresh, handleExercisePlan);
router.get("/getexercise-list/:userId",verifyTokenAndRefresh, handleGetExercisePlan);
router.post("/savepainjournal",verifyTokenAndRefresh, handleAddPainJournal);
router.get("/getpainjournal/:userId",verifyTokenAndRefresh, handleGetPainJournal);
router.post("/saveMedicalRecord", verifyTokenAndRefresh,handlesaveMedicalRecord);
router.get("/getMedicalRecordList",verifyTokenAndRefresh, handleMedicalRecordList);
router.post( "/Observation/saveDiabetesRecords",verifyTokenAndRefresh,DiabetesController.handleDiabetesRecords);
router.get("/Observation/getDiabetesLogs", verifyTokenAndRefresh,DiabetesController.handleGetDiabetesLogs);
router.delete("/Observation/deleteDiabetesLog", verifyTokenAndRefresh,DiabetesController.handleDeleteDiabetesLog);
router.post("/saveSharedDuties",verifyTokenAndRefresh, handleSaveSharedDuties);
router.get("/getSharedDuties/:userId",verifyTokenAndRefresh, handleGetSharedDuties);
router.put("/editSharedDuties/:taskId",verifyTokenAndRefresh, handleEditSharedDuties);
router.get("/", handlehome);
module.exports = router;