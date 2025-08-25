import express from "express";
import petController from '../controllers/pet-controller';
import appointmentController from '../controllers/appointment-controller';
import slotController from  '../controllers/slot-controller';
import feedbackController from '../controllers/feedback-controller';
import detailsController from '../controllers/details-controller';
import listController from '../controllers/list-controller';
import immunizationController from "../controllers/immunization-controller";
import diabetesController  from '../controllers/diabetes-controller';
import SharedDutiesController from "../controllers/shared-duties-controller";
import contactController  from "../controllers/contact-controller";
import planController from '../controllers/plan-controller';
import medicalRecordsController from '../controllers/medical-records-controller';
import assessmentsController from "../controllers/assessmentsController";

import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
  

const router = express.Router();
router.post("/Patient/addPet", verifyTokenAndRefresh,petController.addPet);
router.put("/Patient/editPet", verifyTokenAndRefresh, petController.editPet);
router.get("/Patient/getPets", verifyTokenAndRefresh,petController.getPet);
router.delete("/Patient/deletepet", verifyTokenAndRefresh, petController.deletePet);

router.post("/bookAppointment",verifyTokenAndRefresh, appointmentController.bookAppointment);
router.get("/getAppointments", verifyTokenAndRefresh, appointmentController.getAppointment);
router.put("/cancelAppointment", verifyTokenAndRefresh, appointmentController.cancelAppointment);
router.put("/rescheduleAppointment",verifyTokenAndRefresh, appointmentController.rescheduleAppointment);


router.get("/Slot/getTimeSlots", verifyTokenAndRefresh, slotController.getTimeSlots);
router.get("/Slot/getTimeSlotsByMonth",verifyTokenAndRefresh,slotController.timeSlotsByMonth);

router.post("/Observation/saveFeedBack",verifyTokenAndRefresh,feedbackController.addFeedBack);
router.get("/Observation/getFeedBack",verifyTokenAndRefresh,feedbackController.getFeedback);
router.put("/Observation/editFeedBack",verifyTokenAndRefresh,feedbackController.editFeedback);
router.delete("/Observation/deleteFeedBack",verifyTokenAndRefresh,feedbackController.deleteFeedback);
 
router.get("/Organization/petSummary/:petId",verifyTokenAndRefresh, detailsController.petSummaryDetails);
router.post("/Organization/addVetClinic", verifyTokenAndRefresh, detailsController.vetClinic);
router.get('/Organization/getVetClinicDetails', verifyTokenAndRefresh, detailsController.getVetClinicDetails)
router.get('/Organization/searchVet', verifyTokenAndRefresh, detailsController.searchVet)
router.post("/Organization/addBreederDetails", verifyTokenAndRefresh,  detailsController.breeder);
router.get('/Organization/getbreederDetails', verifyTokenAndRefresh, detailsController.getbreederDetails)
router.post("/Organization/addPetGroomer",verifyTokenAndRefresh, detailsController.petGroomer);
router.get('/Organization/getPetGroomerDetails', verifyTokenAndRefresh, detailsController.getPetGroomerDetails)
router.post("/Organization/addPetBoarding",verifyTokenAndRefresh, detailsController.petBoarding);
router.get('/Organization/getPetBoardingDetails', verifyTokenAndRefresh, detailsController.getPetBoardingDetails)
 
router.post("/sendquery", verifyTokenAndRefresh, contactController.contactUs);

router.get("/Organization/getLists",verifyTokenAndRefresh, listController.getLists);
router.get("/Organization/SeachOrganization",verifyTokenAndRefresh, listController.searchOrganization);
router.get("/Practitioner/getDoctorsLists",verifyTokenAndRefresh,listController.getDoctorsList);
router.get('/Practitioner/getDoctorCountByDepartmentWise', verifyTokenAndRefresh, listController.getDoctorCountDepartmentWise);
router.get("/Practitioner/getDoctorsTeam",verifyTokenAndRefresh,listController.doctorsTeam);


router.post("/Immunization/addVaccinationRecord", verifyTokenAndRefresh, immunizationController.createImmunization);
router.put("/Immunization/editVaccinationRecord", verifyTokenAndRefresh,immunizationController.editVaccination);
router.get("/Immunization/getVaccinationRecord", verifyTokenAndRefresh,immunizationController.getVaccination);
router.delete("/Immunization/deleteVaccinationRecord",verifyTokenAndRefresh,immunizationController.deleteVaccinationRecord);
router.get("/Immunization/recentVaccinationRecords", verifyTokenAndRefresh,immunizationController.recentVaccinationRecord);
 
router.post("/saveExercisePlan",verifyTokenAndRefresh, planController.exercisePlan);
router.get("/getexercise-list/:userId",verifyTokenAndRefresh, planController.getExercisePlan);
router.post("/savepainjournal",verifyTokenAndRefresh, planController.addPainJournal);
router.get("/getpainjournal/:userId",verifyTokenAndRefresh, planController.getPainJournal);

router.post('/DocumentReference/saveMedicalFolder', verifyTokenAndRefresh,  medicalRecordsController.saveMedicalRecordFolder);
router.get('/DocumentReference/getMedicalFolderList',  medicalRecordsController.getMedicalRecordFolderList);
router.delete('/DocumentReference/deleteMedicalFolder', verifyTokenAndRefresh, medicalRecordsController.deleteMedicalRecordFolder)
router.post("/DocumentReference/saveMedicalRecord", verifyTokenAndRefresh,medicalRecordsController.saveMedicalRecord);
router.get("/DocumentReference/getMedicalRecordList",verifyTokenAndRefresh, medicalRecordsController.medicalRecordList);
router.get("/DocumentReference/getMedicalUnreadRecords", verifyTokenAndRefresh, medicalRecordsController.getMedicalUnreadRecords);
router.get("/DocumentReference/getMedicalRecordById", verifyTokenAndRefresh, medicalRecordsController.getSpecificMedicalRecordById);
router.put("/DocumentReference/editMedicalRecord", verifyTokenAndRefresh, medicalRecordsController.editMedicalRecord);
router.delete("/DocumentReference/deleteMedicalRecord", verifyTokenAndRefresh, medicalRecordsController.deleteMedicalRecord);
router.get("/DocumentReference/getFilesOfAllMedicalRecords", verifyTokenAndRefresh, medicalRecordsController.getFilesOfAllMedicalRecords);
router.delete("/DocumentReference/deleteSpecificImageFromMedicalRecord", verifyTokenAndRefresh, medicalRecordsController.deleteSpecificImageFromMedicalRecord);
router.get('/DocumentReference/getMedicalRecordByFolderId', verifyTokenAndRefresh, medicalRecordsController.getMedicalRecordByFolderId);
router.put("/DocumentReference/placeFileInFolder", verifyTokenAndRefresh, medicalRecordsController.placeFileInFolder)
router.get("/DocumentReference/searchMedicalRecordByName",  medicalRecordsController.searchMedicalRecordByName)

router.post( "/Observation/saveDiabetesRecords",verifyTokenAndRefresh,diabetesController.diabetesRecords);
router.get("/Observation/getDiabetesLogs", verifyTokenAndRefresh,diabetesController.getDiabetesLogs);
router.delete("/Observation/deleteDiabetesLog", verifyTokenAndRefresh,diabetesController.deleteDiabetesLog);

router.post("/RelatedPerson/savePetCoOwner",verifyTokenAndRefresh, SharedDutiesController.savePetCoOwner);
router.delete("/RelatedPerson/deletePetCoOwner",verifyTokenAndRefresh, SharedDutiesController.deletePetCoOwner);
router.post("/Observation/saveSharedDuties",verifyTokenAndRefresh, SharedDutiesController.saveSharedDuties);
router.get("/Observation/getSharedDuties",verifyTokenAndRefresh, SharedDutiesController.getSharedDuties);
router.put("/Observation/editSharedDuties",verifyTokenAndRefresh, SharedDutiesController.editSharedDuties);
router.delete("/Observation/deleteSharedDuties",verifyTokenAndRefresh,SharedDutiesController.deleteSharedDuties);

router.get('/PainAssessments/:id',verifyTokenAndRefresh, assessmentsController.getPainAssessment);
router.post('/PainAssessments/Submit',verifyTokenAndRefresh, assessmentsController.savePainAssessment);

export default router;