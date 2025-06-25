import express from "express";
 
import petController from '../controllers/pet-controller';
import appointmentController from '../controllers/appointmentController';
import slotController from  '../controllers/slot-controller';
import feedbackController from '../controllers/feedbackController';
import detailsController from '../controllers/detailsController';
import ListController from '../controllers/list-controller';
import immunizationController from "../controllers/immunization-controller";
import diabetesController  from '../controllers/diabetes-controller';
import SharedDutiesController from "../controllers/SharedDutiesController";
import contactUs  from "../controllers/contactController";
import planController from '../controllers/plan-controller';
 
import medicalRecordsController from '../controllers/medicalRecordsController';
 
 
 
const router = express.Router();
 
import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
 
router.post("/Patient/addPet", verifyTokenAndRefresh,petController.addPet);
router.put("/Patient/editPet", verifyTokenAndRefresh, petController.editPet);
router.get("/Patient/getPets", verifyTokenAndRefresh,petController.getPet);
router.delete("/Patient/deletepet", verifyTokenAndRefresh, petController.deletePet);
router.post("/bookAppointment",verifyTokenAndRefresh, appointmentController.bookAppointment);
router.get("/getAppointments", verifyTokenAndRefresh, appointmentController.getAppointment);
router.put("/cancelAppointment", verifyTokenAndRefresh, appointmentController.cancelAppointment);
router.put("/rescheduleAppointment",verifyTokenAndRefresh, appointmentController.rescheduleAppointment);
router.get("/Slot/getTimeSlots", verifyTokenAndRefresh, slotController.getTimeSlots);
router.get("/Slot/getTimeSlotsByMonth",verifyTokenAndRefresh,slotController.TimeSlotsByMonth);
router.post("/Observation/saveFeedBack",verifyTokenAndRefresh,feedbackController.addFeedBack);
router.get("/Observation/getFeedBack",verifyTokenAndRefresh,feedbackController.getFeedback);
router.put("/Observation/editFeedBack",verifyTokenAndRefresh,feedbackController.editFeedback);
router.delete("/Observation/deleteFeedBack",verifyTokenAndRefresh,feedbackController.deleteFeedback);
 
 
router.post("/Organization/addVetClinic", verifyTokenAndRefresh, detailsController.vetClinic);
router.post("/Organization/addBreederDetails", verifyTokenAndRefresh,  detailsController.breeder);
router.post("/Organization/addPetGroomer",verifyTokenAndRefresh, detailsController.petGroomer);
router.post("/Organization/addPetBoarding",verifyTokenAndRefresh, detailsController.petBoarding);
 
 
router.post("/sendquery", verifyTokenAndRefresh, contactUs);
router.get("/Organization/getLists",verifyTokenAndRefresh, ListController.GetLists);
router.get("/Organization/SeachOrganization",verifyTokenAndRefresh, ListController.SeachOrganization);
router.get("/Practitioner/getDoctorsLists",verifyTokenAndRefresh,ListController.getDoctorsList);
router.get("/Practitioner/getDoctorsTeam",verifyTokenAndRefresh,ListController.DoctorsTeam);


router.post("/Immunization/addVaccinationRecord", verifyTokenAndRefresh, immunizationController.createImmunization);
router.put("/Immunization/editVaccinationRecord", verifyTokenAndRefresh,immunizationController.editVaccination);
router.get("/Immunization/getVaccinationRecord", verifyTokenAndRefresh,immunizationController.getVaccination);
router.delete("/Immunization/deleteVaccinationRecord",verifyTokenAndRefresh,immunizationController.deleteVaccinationRecord);
router.get("/Immunization/recentVaccinationRecords", verifyTokenAndRefresh,immunizationController.recentVaccinationRecord);
 
router.post("/saveExercisePlan",verifyTokenAndRefresh, planController.exercisePlan);
router.get("/getexercise-list/:userId",verifyTokenAndRefresh, planController.getExercisePlan);
router.post("/savepainjournal",verifyTokenAndRefresh, planController.addPainJournal);
router.get("/getpainjournal/:userId",verifyTokenAndRefresh, planController.getPainJournal);
router.post("/DocumentReference/saveMedicalRecord", verifyTokenAndRefresh,medicalRecordsController.saveMedicalRecord);
router.get("/DocumentReference/getMedicalRecordList",verifyTokenAndRefresh, medicalRecordsController.medicalRecordList);
router.post( "/Observation/saveDiabetesRecords",verifyTokenAndRefresh,diabetesController.diabetesRecords);
router.get("/Observation/getDiabetesLogs", verifyTokenAndRefresh,diabetesController.getDiabetesLogs);
router.delete("/Observation/deleteDiabetesLog", verifyTokenAndRefresh,diabetesController.deleteDiabetesLog);
router.post("/RelatedPerson/savePetCoOwner",verifyTokenAndRefresh, SharedDutiesController.handleSavePetCoOwner);
router.delete("/RelatedPerson/deletePetCoOwner",verifyTokenAndRefresh, SharedDutiesController.handleDeletePetCoOwner);
router.post("/Observation/saveSharedDuties",verifyTokenAndRefresh, SharedDutiesController.handleSaveSharedDuties);
router.get("/Observation/getSharedDuties",verifyTokenAndRefresh, SharedDutiesController.handleGetSharedDuties);
router.put("/Observation/editSharedDuties",verifyTokenAndRefresh, SharedDutiesController.handleEditSharedDuties);
router.delete("/Observation/deleteSharedDuties",verifyTokenAndRefresh,SharedDutiesController.handledeleteSharedDuties);
export default router;