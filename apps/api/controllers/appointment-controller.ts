import { Request, Response } from 'express';
import { getCognitoUserId } from '../middlewares/authMiddleware';
import appointmentService from '../services/appointment-service'
import { parseAppointment} from '@yosemite-crew/fhir'
import helpers from '../utils/helpers';
import { IFHIRAppointmentData,  IParsedAppointmentDetails,  IProfileData, WebAppointmentType } from '@yosemite-crew/types';
import mongoose from 'mongoose';


const appointmentController = {

  bookAppointment: async (req: Request<unknown, unknown, {data:string}>, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req as Request);

      // Parse FHIR data if provided
      const data  = req.body.data;
      
      let appointmentDetails;
      if (data) {
        const parseData = JSON.parse(req.body.data) as IFHIRAppointmentData
        appointmentDetails =  parseAppointment(parseData);
      }
      

      if (!appointmentDetails) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing appointment details.",
        });
        return;
      }

      const {
        appointmentDate,
        purposeOfVisit,
        hospitalId,
        department,
        veterinarian,
        petId,
        slotsId,
      } : Partial<IParsedAppointmentDetails>= appointmentDetails;

         const formattedDateTime = helpers.formatAppointmentDateTime(appointmentDate as string)
      // Compute day of the week
      const dayOfWeek = new Date(appointmentDate as string).toLocaleDateString('en-US', { weekday: 'long' });
      // Check slot availability
      if(veterinarian === undefined || null || veterinarian === '') {
        res.status(200).json({
          status: 0,
          message: "Invalid veterinarian ID.",
        });
        return;
      }
      const isBooked = await appointmentService.checkAppointment(String(veterinarian), formattedDateTime.appointmentDate, formattedDateTime.appointmentTime);

      if (isBooked) {
        res.status(200).json({
          status: 0,
          message: "This time slot is already booked for the selected doctor.",
        });
        return
      }

      // Parallelize conversions, file uploads, and data fetching
      const uploadedFilesForHelper: Express.Multer.File[] = Array.isArray(req.files)
        ? req.files
        : req.files
          ? Object.values(req.files).flat()
          : [];
      const [ documentFiles, { petDetails, petOwner }] = await Promise.all([
        uploadedFilesForHelper.length > 0 ? helpers.uploadFiles(uploadedFilesForHelper ) : [],
        appointmentService.getPetAndOwner(petId as string, userId),
      ]);
      if(!petDetails || !petOwner) {
        res.status(400).json({
          status: 0,
          message: "Pet or owner details not found.",
        });
        return;
      }
      const hospitalNameResult = await appointmentService.getHospitalName(hospitalId as string );
      if (!hospitalNameResult) {
        res.status(400).json({
          status: 0,
          message: "Hospital details not found.",
        });
        return;
      }
      const hospitalName: IProfileData = hospitalNameResult;
      const initials = hospitalName.businessName
        ? hospitalName.businessName.split(' ')
          .map((word) => word[0])
          .join('')
        : 'XX';

      const appointmentToken = await appointmentService.updateToken(hospitalId as string, appointmentDate as string);

      const date = helpers.formatAppointmentDateTime(appointmentDate as string)
      const tokenNumber = `${initials}00${appointmentToken.tokenCounts}-${date.appointmentDate}`;

      const appointmentData :Partial<WebAppointmentType>= {
        userId,
        hospitalId,
        tokenNumber,
        department,
        veterinarian: veterinarian,
        petId,
        ownerName: `${petOwner.firstName} ${petOwner.lastName}`,
        petName: petDetails.petName,
        petAge: petDetails.petAge,
        petType: petDetails.petType,
        gender: petDetails.petGender,
        breed: petDetails.petBreed,
        day: dayOfWeek,
        appointmentDate:formattedDateTime.appointmentDate,
        slotsId,
        appointmentTime: formattedDateTime.appointmentTime,
        appointmentTime24: formattedDateTime.appointmentTime24,
        purposeOfVisit: purposeOfVisit ?? '',
        // concernOfVisit,
        appointmentSource: "App",
        uploadRecords: [{
          fileUrl: documentFiles[0]?.url,
          fileName: documentFiles[0]?.originalname,
          fileType: documentFiles[0]?.mimetype,
        }
        ],
      };
      

      const fhirAppointment = await appointmentService.bookAppointment(appointmentData);

      if (fhirAppointment) {
        res.status(200).json({ status: 1, message: "Appointment Booked successfully" });
        return
      }

      res.status(200).json({
        status: 0,
        message: "Appointment could not be booked",
      });
      return

    } catch (error: unknown) {
      res.status(500).json({
        status: 0,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  getAppointment: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await appointmentService.fetchAppointments(req);
      if (!result) {
         res.status(404).json({ status: 0, message: 'No Appointment found for this user' });
        return;
      }
        res.status(200).json({ status: 1, data: result });
        return
     

    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "An error occurred while retrieving appointments" });
    }
  },

  cancelAppointment: async (req: Request<{appointmentId:string}, unknown , unknown>, res: Response): Promise<void> => {
    try {
      const appointmentIdRaw = req.query.appointmentID;

      if(typeof appointmentIdRaw !== 'string' ||!appointmentIdRaw){
        res.status(200).json({message:'No appointment id provided'})
      }

      const result = await appointmentService.cancelAppointment(appointmentIdRaw);

      if (!result) {
        res.status(200).json({ status: 0, message: "This appointment not found" });
        return
      }

      res.status(200).json({ status: 1, message: "Appointment cancelled successfully",});
  
      
    } catch (error) {
      console.log(error);
      res.status(200).json({ status: 0, message: "Error while cancelling appointment", error });
      return
    }
  },

  rescheduleAppointment: async (req: Request<{appointmentID:string}, unknown, {timeslot:string,appointmentDate:string}>, res: Response): Promise<void> => {
    try {
    
       const appointmentIdRaw = req.query.appointmentID;
      if (typeof appointmentIdRaw !== "string" || !mongoose.Types.ObjectId.isValid(appointmentIdRaw)) {
         res.status(200).json({ status: 0, message: "Invalid Appointment ID format" });
        return;
      }
      const {appointmentDate, timeslot}=  JSON.parse(req.body.data);
      if(!appointmentDate || !timeslot){
        
        res.status(200).json({message:"Appointment Date and timeslot are missing", status:0})
        return
      }
      
      const normalData :Partial<WebAppointmentType> = {
        appointmentDate: appointmentDate,
        appointmentTime: timeslot,
        appointmentTime24: helpers.convertTo24Hour(timeslot),
      };
      const result = await appointmentService.rescheduleAppointment(normalData, appointmentIdRaw);

      res.status(200).json({ status: 1, message: "Appointment rescheduled successfully", data: result });
      return
    } catch (error: unknown) {
      console.log(error)
      res.status(500).json({
        status: 0,
        resourceType: "OperationOutcome",

      });
    }
  }
}

export default appointmentController
