const express = require("express");
const {
  handlehome,
} = require("../controllers/user");
const PetController = require('../controllers/PetController');
const AppointmentController = require('../controllers/AppointmentController');
const SlotController = require('../controllers/SlotController');
const FeedbackController = require('../controllers/FeedbackController');
const DetailsController = require('../controllers/DetailsController');

const { handleContactUs } = require("../controllers/contact");
const {
  handleAddVaccination,
  handleEditVaccination,
  handleGetVaccination,
} = require("../controllers/vaccination");
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
  handleDiabetesRecords,
  handleDiabetesLogs,
} = require("../controllers/diabetesRecords");
const {
  handleSaveSharedDuties,
  handleEditSharedDuties,
  handleGetSharedDuties,
} = require("../controllers/sharedDuties");
const {
  handleGetLists,
  handlegetDoctorsLists,
  handlegetDoctorsTeam
} = require("../controllers/lists");
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
router.put("/Patient/editPet/:Petid", verifyTokenAndRefresh, PetController.handleEditPet);
router.get("/Patient/getPets/:limit/:offset", verifyTokenAndRefresh,PetController.handleGetPet);
router.delete("/Patient/deletepet/:Petid", verifyTokenAndRefresh, PetController.handleDeletePet);
router.post("/bookAppointment",verifyTokenAndRefresh, AppointmentController.handleBookAppointment);
router.get("/getappointments", verifyTokenAndRefresh, AppointmentController.handleGetAppointment);
router.put("/cancelappointment/:appointmentID", verifyTokenAndRefresh, AppointmentController.handleCancelAppointment);
router.put("/rescheduleAppointment/:appointmentID",verifyTokenAndRefresh, AppointmentController.handleRescheduleAppointment);
router.get("/getTimeSlots/:appointmentDate/:doctorId", verifyTokenAndRefresh, SlotController.handlegetTimeSlots);
router.get("/getTimeSlotsByMonth/:slotMonth/:slotYear/:doctorId",verifyTokenAndRefresh,SlotController.handleTimeSlotsByMonth);
router.post("/saveFeedBack",verifyTokenAndRefresh,FeedbackController.handlesaveFeedBack);
router.get("/getFeedBack",verifyTokenAndRefresh,FeedbackController.handleGetFeedback);
router.put("/editFeedBack/:feedbackId",verifyTokenAndRefresh,FeedbackController.handleEditFeedBack);
router.delete("/deleteFeedBack/:feedbackId",verifyTokenAndRefresh,FeedbackController.handleDeleteFeedBack);


router.post("/Organization/addVetClinic", verifyTokenAndRefresh, DetailsController.handleVetClinic);
router.post("/Organization/addBreederDetails", verifyTokenAndRefresh,  DetailsController.handleBreeder);
router.post("/Organization/addPetGroomer",verifyTokenAndRefresh, DetailsController.handlePetGroomer);
router.post("/Organization/addPetBoarding",verifyTokenAndRefresh, DetailsController.handlePetBoarding);


router.post("/sendquery", verifyTokenAndRefresh,handleContactUs);
router.post("/getLists",handleGetLists);
router.post("/getDoctorsLists",handlegetDoctorsLists);

router.post("/getDoctorsTeam",handlegetDoctorsTeam);
router.post("/addVaccinationRecord",verifyTokenAndRefresh,handleAddVaccination);
router.put("/editVaccinationRecord/:id", verifyTokenAndRefresh,handleEditVaccination);
router.get("/getVaccinationRecord/:userId", verifyTokenAndRefresh,handleGetVaccination);
router.post("/saveExercisePlan",verifyTokenAndRefresh, handleExercisePlan);
router.get("/getexercise-list/:userId",verifyTokenAndRefresh, handleGetExercisePlan);
router.post("/savepainjournal",verifyTokenAndRefresh, handleAddPainJournal);
router.get("/getpainjournal/:userId",verifyTokenAndRefresh, handleGetPainJournal);
router.post("/saveMedicalRecord", verifyTokenAndRefresh,handlesaveMedicalRecord);
router.get("/getMedicalRecordList",verifyTokenAndRefresh, handleMedicalRecordList);
router.post(
  "/saveDiabetesRecords",verifyTokenAndRefresh,
  upload.array("PetImage"),
  handleDiabetesRecords
);
router.post("/getDiabetesLogs", verifyTokenAndRefresh,handleDiabetesLogs);
router.post("/saveSharedDuties",verifyTokenAndRefresh, handleSaveSharedDuties);
router.get("/getSharedDuties/:userId",verifyTokenAndRefresh, handleGetSharedDuties);
router.put("/editSharedDuties/:taskId",verifyTokenAndRefresh, handleEditSharedDuties);
router.get("/", handlehome);
module.exports = router;