const express = require("express");
const {
  handleUserRegistration,
  handleUserLogin,
  handlehome,
} = require("../controllers/user");
const {
  handleAddPet,
  handleGetPet,
  handleDeletePet,
  handleEditPet,
} = require("../controllers/pet");
const {
  handleVetClinic,
  handleBreeder,
  handlePetGroomer,
  handlePetBoarding,
} = require("../controllers/details");
const {
  handleBookAppointment,
  handleGetAppointment,
  handleCancelAppointment,
  handleGetTimeSlots,
  handleRescheduleAppointment,
  handleTimeSlotsByMonth,
} = require("../controllers/appointment");
const { handleContactUs } = require("../controllers/contact");
const {
  handleAddVaccination,
  handleEditVaccination,
  handleGetVaccination,
} = require("../controllers/vaccination");
const {
  handlePhysioPlan,
  handleAddPainJournal,
  handleGetPhysioPlan,
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
  handlelists,
} = require("../controllers/lists");
const router = express.Router();
const multer = require("multer");
const fs = require('fs');
const uploadDir = './apps/api/src/Uploads/Images';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./apps/api/src/Uploads/Images");
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

router.post("/addPet", verifyTokenAndRefresh,handleAddPet);
router.post("/editPet", verifyTokenAndRefresh, upload.single("petImage"), handleEditPet);
router.post("/getpets", verifyTokenAndRefresh,handleGetPet);
router.post("/deletepet", verifyTokenAndRefresh, handleDeletePet);
router.post("/addVetDetails", verifyTokenAndRefresh, handleVetClinic);
router.post("/addBreederDetails", verifyTokenAndRefresh,  handleBreeder);
router.post("/addPetGroomer",verifyTokenAndRefresh, handlePetGroomer);
router.post("/addPetBoarding",verifyTokenAndRefresh, handlePetBoarding);
router.post("/bookAppointment",handleBookAppointment);
router.post("/getappointments", verifyTokenAndRefresh, handleGetAppointment);
router.post("/getTimeSlots", verifyTokenAndRefresh, handleGetTimeSlots);
router.post("/rescheduleAppointment",verifyTokenAndRefresh, handleRescheduleAppointment);
router.post("/cancelappointment", verifyTokenAndRefresh, handleCancelAppointment);
router.post("/getTimeSlotsByMonth",handleTimeSlotsByMonth);
router.post("/sendquery", verifyTokenAndRefresh,handleContactUs);
router.post("/getLists",handlelists);
router.post(
  "/addVaccinationRecord",verifyTokenAndRefresh,
  upload.single("vaccineImage"),
  handleAddVaccination
);
router.post(
  "/editVaccinationRecord", verifyTokenAndRefresh,
  upload.single("vaccineImage"),
  handleEditVaccination
);
router.post("/getVaccinationRecord", verifyTokenAndRefresh,handleGetVaccination);
router.post("/savePhysioPlan",verifyTokenAndRefresh, handlePhysioPlan);
router.post("/getphysio-list",verifyTokenAndRefresh, handleGetPhysioPlan);
router.post("/savepainjournal",verifyTokenAndRefresh, handleAddPainJournal);
router.post("/getpainjournal",verifyTokenAndRefresh, handleGetPainJournal);
router.post(
  "/saveMedicalRecord", verifyTokenAndRefresh,
  upload.array("medicalDocs"),
  handlesaveMedicalRecord
);
router.post("/getMedicalRecordList",verifyTokenAndRefresh, handleMedicalRecordList);
router.post(
  "/saveDiabetesRecords",verifyTokenAndRefresh,
  upload.array("PetImage"),
  handleDiabetesRecords
);
router.post("/getDiabetesLogs", verifyTokenAndRefresh,handleDiabetesLogs);
router.post("/saveSharedDuties",verifyTokenAndRefresh, handleSaveSharedDuties);
router.post("/getSharedDuties",verifyTokenAndRefresh, handleGetSharedDuties);
router.post("/editSharedDuties",verifyTokenAndRefresh, handleEditSharedDuties);
router.get("/", handlehome);
module.exports = router;
