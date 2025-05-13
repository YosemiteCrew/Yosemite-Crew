
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
  
      // Parse FHIR data if provided
      let appointmentDetails = {};
      if (req.body?.data) {
        appointmentDetails = await FHIRTransformer.parseAppointment(JSON.parse(req.body.data));
      }
  
      const {
        appointmentDate,
        purposeOfVisit,
        hospitalId,
        department,
        doctorId,
        petId,
        slotsId,
        timeslot,
        concernOfVisit,
      } = appointmentDetails;
  
      // Compute day of the week
      const dayOfWeek = new Date(appointmentDate).toLocaleDateString('en-US', { weekday: 'long' });
  
      // Check slot availability
      const isBooked = await AppointmentService.checkAppointment(doctorId, appointmentDate, timeslot);
      if (isBooked) {
        return res.status(200).json({
          status: 0,
          message: "This time slot is already booked for the selected doctor.",
        });
      }
  
      // Parallelize conversions, file uploads, and data fetching
      const [appointmentTime24, documentFiles, { petDetails, petOwner }] = await Promise.all([
        helpers.convertTo24Hour(timeslot),
        req.files?.files ? PetService.uploadFiles(req.files.files) : [],
        AppointmentService.getPetAndOwner(petId, userId),
      ]);

      const hospitalName =  await AppointmentService.getHospitalName(hospitalId);
      const initials = hospitalName.businessName
      ? hospitalName.businessName.split(' ')
          .map((word) => word[0])
          .join('')
      : 'XX';

      let Appointmenttoken = await AppointmentService.updateToken(hospitalId, appointmentDate);

      const tokenNumber = `${initials}00${Appointmenttoken.tokenCounts}-${appointmentDate}`;
  
      const appointmentData = {
        userId,
        hospitalId,
        tokenNumber,
        department,
        veterinarian: doctorId,
        petId,
        ownerName: `${petOwner.firstName} ${petOwner.lastName}`,
        petName: petDetails.petName,
        petAge: petDetails.petAge,
        petType: petDetails.petType,
        gender: petDetails.petGender,
        breed: petDetails.petBreed,
        day: dayOfWeek,
        appointmentDate,
        slotsId,
        appointmentTime: timeslot,
        appointmentTime24,
        purposeOfVisit,
        concernOfVisit,
        appointmentSource: "App",
        document: documentFiles,
      };

     
      
      const fhirAppointment = await AppointmentService.bookAppointment(appointmentData);
  
      if (fhirAppointment) {
        return res.status(200).json({ status: 1, message: "Appointment Booked successfully" });
      }
  
      return res.status(200).json({
        status: 0,
        message: "Appointment could not be booked",
      });
  
    } catch (error) {
      res.status(200).json({
        status: 0,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
  
 
  static async handleGetAppointment(req, res) {
    try {
      const result = await AppointmentService.fetchAppointments(req);
      if(result){
        return res.status(200).json({ status: 1, data: result});
      }
      res.status(200).json({ status: 0, message: 'No Appointment found for this user'});
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "An error occurred while retrieving appointments" });
    }
  }

  static async handleCancelAppointment(req, res) {
    try {
      const appointmentId = req.query.appointmentID;
     // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(appointmentId)) {
        return res.status(200).json({ status: 0, message: "Invalid Appointment ID format" });
      }
      const result = await AppointmentService.cancelAppointment(appointmentId);
  
      if (!result) {
        return res.status(200).json({ status: 0, message: "This appointment not found" });
      }
  
      const fhirData = formatFHIR.toFHIR(result,process.env.BASE_URL);
  
      res.status(200).json({ status: 1, message: "Appointment cancelled successfully", data: fhirData });
    } catch (error) {
      res.status(200).json({ status: 0, message: "Error while cancelling appointment", error });
    }
  }

  static async handleRescheduleAppointment(req, res) {
   
    try {
      const fhirdata =req.body?.data;
      const appointmentId = req.query.appointmentID;
        // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(appointmentId)) {
          return res.status(400).json({ message: "Invalid Appointment ID format" });
      }
      const normalData = FHIRConverter.fromFHIRAppointment(JSON.parse(fhirdata));
      const result = await AppointmentService.rescheduleAppointment(normalData,appointmentId);
  
      res.status(200).json({ status: 1, message: "Appointment rescheduled successfully", data:result});
    } catch (error) {
      res.status(error.statusCode || 200).json({
        status: 0,
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
