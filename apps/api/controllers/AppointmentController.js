
const moment = require('moment');
const PetService = require('../services/PetService');
const { v4: uuidv4 } = require('uuid'); // for FHIR resource id
const { getCognitoUserId } = require('../utils/jwtUtils');
const AppointmentService = require("../services/AppointmentService");
const formatFHIR = require("../utils/fhirAppointmentFormatter");
const helpers = require('../utils/helpers');
const FHIRTransformer = require('../utils/FHIRTransformer');
const FHIRConverter = require('../utils/FHIRConverter');
const { Types } = require('mongoose'); // for ObjectId validation

class AppointmentController {
  static async handleBookAppointment(req, res) {
    try {
      const userId = getCognitoUserId(req);
      const fhirdata =req.body?.data;
      let {
        appointmentDate,
        purposeOfVisit,
        hospitalId,
        department,
        doctorId,
        petId,
        slotsId,
        timeslot,
        concernOfVisit,
      } = '';
      if (fhirdata) {
        const converted = await FHIRTransformer.parseAppointment(JSON.parse(fhirdata)); 
        appointmentDate = converted.appointmentDate;
        timeslot = converted.timeslot;
        purposeOfVisit = converted.purposeOfVisit;
        concernOfVisit = converted.concernOfVisit;
        petId = converted.petId;
        doctorId = converted.doctorId;
        hospitalId = converted.hospitalId;
        department = converted.department;
        slotsId = converted.slotsId;
      }
      const appointmentDateObj = new Date(appointmentDate);
      const dayofweek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][appointmentDateObj.getDay()];

      const checkAppointment = await AppointmentService.checkAppointment(doctorId,appointmentDate,timeslot);
      if (checkAppointment) {
        return res.status(400).json({
          status: 0,
          message: "This time slot is already booked for the selected doctor.",
        });
      }
      const [appointmentTime24, imageUrls, { petDetails, petOwner }] = await Promise.all([
        helpers.convertTo24Hour(timeslot),
        req.files ? PetService.uploadFiles(req.files.files) : Promise.resolve(''),
        AppointmentService.getPetAndOwner(petId, userId),
      ]);
  
      const appointmentData = {
        userId,
        hospitalId,
        department,
        veterinarian: doctorId,
        petId,
        ownerName: `${petOwner.firstName} ${petOwner.lastName}`,
        petName: petDetails.petName,
        petAge: petDetails.petAge,
        petType: petDetails.petType,
        gender: petDetails.petGender,
        breed: petDetails.petBreed,
        day: dayofweek,
        appointmentDate,
        slotsId,
        appointmentTime: timeslot,
        appointmentTime24,
        purposeOfVisit,
        concernOfVisit,
        appointmentSource: "App",
        document: imageUrls,
      };
  
      await AppointmentService.bookAppointment(appointmentData);
  
      const fhirAppointment = formatFHIR.formatAppointmentToFHIR({
        appointmentDate,
        appointmentTime24,
        purposeOfVisit,
        concernOfVisit,
        petId,
        doctorId,
        petName: petDetails.petName,
        document: imageUrls,
      });
  
      res.status(200).json(fhirAppointment);
    } catch (error) {
      console.error("Appointment booking error:", error);
      res.status(500).json({
        status: 0,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  static async handleGetAppointment(req, res) {
    try {
      const result = await AppointmentService.fetchAppointments(req);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "An error occurred while retrieving appointments" });
    }
  }

  static async handleCancelAppointment(req, res) {
    try {
      const appointmentId = req.params.appointmentID;
     // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ message: "Invalid Appointment ID format" });
      }
      const result = await AppointmentService.cancelAppointment(appointmentId);
  
      if (!result) {
        return res.status(404).json({ message: "This appointment not found" });
      }
  
      const fhirData = formatFHIR.toFHIR(result,process.env.BASE_URL);
  
      res.status(200).json({ data: fhirData });
    } catch (error) {
      console.error("Cancel Appointment Error:", error);
      res.status(500).json({ message: "Error while cancelling appointment", error });
    }
  }

  static async handleRescheduleAppointment(req, res) {
   
    try {
      const fhirdata =req.body?.data;
      const appointmentId = req.params.appointmentID;
        // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(appointmentId)) {
          return res.status(400).json({ message: "Invalid Appointment ID format" });
      }
      const normalData = FHIRConverter.fromFHIRAppointment(JSON.parse(fhirdata));
      const result = await AppointmentService.rescheduleAppointment(normalData,appointmentId);
  
      res.status(200).json(result);
    } catch (error) {
      res.status(error.statusCode || 500).json({
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: error.code || "exception",
          diagnostics: error.message,
        }],
      });
    } 
}
}

module.exports = AppointmentController
