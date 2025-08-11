
import { Request, Response } from "express";
import pets from "../models/pet.model";
import AppUser from "../models/appuser-model";
import { FHIRSlotBundle, IUser, pets as Ipet, NormalPetData, WebAppointmentType ,FHIRAppointmentBooking} from "@yosemite-crew/types";
import { convertFHIRToAppointment, convertPetDataToFhir, convertTimeSlotsToFHIR, convertToFHIRDoctorOptions } from "@yosemite-crew/fhir";
import { OperationOutcome, SearchPetsRequestBody } from "@yosemite-crew/types/dist/web-appointments-types/web-appointments";
import { ProfileData, WebUser } from "../models/WebUser";
import AddDoctors from "../models/AddDoctor";
import { AppointmentsToken, webAppointments } from "../models/web-appointment";
import { DoctorsTimeSlotes, UnavailableSlot } from "../models/doctors.slotes.model";

// const { json } = require('body-parser');
// import DoctorsTimeSlotes from "../models/doctors.slotes.model";
// import {
//   AppointmentsToken,
//   webAppointments,
// } from "../models/WebAppointment";
// import { FHIRToNormalConverter } from "../utils/WebAppointmentHandler";
// import FHIRSlotConverter from "../utils/FhirSlotConverter";

// import type{NormalizedAppointment} from "@yosemite-crew/types";
// function convertTo12HourFormat(dateObj: Date): string {
//   let hours: number = dateObj.getHours();
//   const minutes: string = dateObj.getMinutes().toString().padStart(2, "0");
//   const period: string = hours >= 12 ? "PM" : "AM";

//   hours = hours % 12 || 12;
//   return `${hours}:${minutes} ${period}`;
// }



const webAppointmentController = {
  searchPetsForBookAppointment: async (
    req: Request<object, object, SearchPetsRequestBody>,
    res: Response
  ): Promise<void> => {
    try {
      const rawNames = req.query.names;
      const rawMicroChip = req.query.microChip;

      // Sanitize microChip to avoid potential CodeQL issues
      // eslint-disable-next-line no-useless-escape
      const microChip = typeof rawMicroChip === 'string' ? rawMicroChip.trim().replace(/[^\w\-]/g, '') : '';
      const names = typeof rawNames === 'string' ? rawNames.trim() : '';
      // Validate input
      if ((names && microChip) || (!names && !microChip)) {
        const errorResponse: OperationOutcome = {
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "invalid",
            details: { text: "Please provide either 'names' or 'microChip', but not both." }
          }]
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Helper function to get combined pet parent name
      const getPetParentName = async (cognitoUserId: string) => {
        const user = await AppUser.findOne({ cognitoId: cognitoUserId });
        return user ? `${user.firstName} ${user.lastName}` : "Unknown Owner";
      };

      // Search by microChip
      if (microChip) {
        const pet: Ipet | null = await pets.findOne({ microChipNumber: microChip });

        if (!pet) {
          res.status(404).json({ message: "No pet found with provided microchip number." });
          return;
        }

        const petParentName = await getPetParentName(pet.cognitoUserId as string);
        const petData = {
          petId: pet._id?.toString(),
          petName: pet.petName,
          microChipNumber: pet.microChipNumber,
          passportNumber: pet.passportNumber,
          petImage: `${process.env.CLOUD_FRONT_URI}/${pet.petImage?.[0]?.url ?? ""}`,
          petParentId: pet.cognitoUserId,
          petParentName: petParentName
        };

        const fhirData = convertPetDataToFhir(petData as NormalPetData);
        // const resp = convertFhirToNormalPetData(fhirData)
        res.status(200).json({ data: fhirData });
        return;
      }

      // Search by names (owner name or pet name)
      const appUser: IUser | null = await AppUser.findOne({
        $or: [
          { firstName: new RegExp(names, "i") },
          { lastName: new RegExp(names, "i") }
        ]
      });

      if (appUser) {
        const petList: Ipet[] = await pets.find({ cognitoUserId: appUser.cognitoId });
        const petParentName = `${appUser.firstName} ${appUser.lastName}`;

        const formattedPets = petList.map((pet) => ({
          petId: pet._id?.toString(),
          petName: pet.petName,
          microChipNumber: pet.microChipNumber,
          passportNumber: pet.passportNumber,
          petImage: `${process.env.CLOUD_FRONT_URI}/${pet.petImage?.[0]?.url ?? ""}`,
          petParentId: pet.cognitoUserId,
          petParentName: petParentName
        }));


        const fhirData = convertPetDataToFhir(formattedPets as NormalPetData[]);
        res.status(200).json({ data: fhirData });
        return;
      }

      // Search by pet name only
      const petsByName: Ipet[] = await pets.find({
        petName: new RegExp(names, "i")
      });

      if (petsByName.length === 0) {
        res.status(404).json({ message: "No pet or parent matched with the given name." });
        return;
      }

      const formattedPets = await Promise.all(petsByName.map(async (pet) => ({
        petId: pet._id?.toString(),
        petName: pet.petName,
        microChipNumber: pet.microChipNumber,
        passportNumber: pet.passportNumber,
        petImage: `${process.env.CLOUD_FRONT_URI}/${pet.petImage?.[0]?.url ?? ""}`,
        petParentId: pet.cognitoUserId,
        petParentName: await getPetParentName(pet.cognitoUserId as string)
      })));


      const fhirData = convertPetDataToFhir(formattedPets as NormalPetData[]);
      res.status(200).json({ data: fhirData });

    } catch (error) {
      console.error("Error searching pets:", error);
      const errorResponse: OperationOutcome = {
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: "exception",
          details: { text: "Internal server error while searching for pets." }
        }]
      };
      res.status(500).json(errorResponse);
    }
  },


  getDoctorsByDepartmentId: async (req: Request, res: Response) => {
    try {
      const { userId, departmentId } = req.query as { userId: string, departmentId: string };

      // Step 1: Get business ID from WebUser
      const user = await WebUser.findOne({ cognitoId: userId }).select("bussinessId -_id");
      if (!user || !user.bussinessId) {
        res.status(404).json({ message: "Business ID not found for user." });
        return
      }

      // Step 2: Find all vets under the same business
      const vetUsers = await WebUser.find({
        bussinessId: user.bussinessId,
        department: departmentId,
        role: "vet",
      }).select("cognitoId -_id");

      const vetIds = vetUsers.map((v) => v.cognitoId);
      if (vetIds.length === 0) {
        res.status(200).json({ message: "No vets found.", data: [] });
        return
      }

      // Step 3: Find doctor profile data
      const allDoctors = await AddDoctors.find({ userId: { $in: vetIds }, status: "On-Duty" }).select("firstName lastName userId -_id");

      // Step 4: Format response as { label, value }
      const formattedDoctors = allDoctors.map((doc) => ({
        label: `${doc.firstName} ${doc.lastName}`,
        value: doc.userId,
      }));

      res.status(200).json({
        message: "Fetched doctors successfully",

        data: convertToFHIRDoctorOptions(formattedDoctors)
      });
      return
    } catch (error) {
      console.error("Error fetching doctors by department ID:", error);
      res.status(500).json({
        message: "Internal server error",
        error: (error as Error).message,
      });
      return
    }
  },

  createWebAppointment: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        petName,
        ownerName,
        passportNumber,
        microChipNumber,
        purposeOfVisit,
        appointmentType,
        department,
        veterinarian,
        appointmentDate,
        // appointmentTime,
        day,
        slotsId, // This is the slot ID from frontend
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      } = convertFHIRToAppointment( req.body as FHIRAppointmentBooking) as WebAppointmentType;

      // Validate appointmentDate format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "invalid",
            details: { text: "appointmentDate must be in YYYY-MM-DD format." },
          }],
        });
        return
      }

      // Get hospital info from user
      const user = await WebUser.findOne({cognitoId:veterinarian});
      if (!user || !user.bussinessId) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "not-found",
            details: { text: "User or hospital information not found." },
          }],
        });
        return
      }

      // Get hospital details
      const hospital = await ProfileData.findOne({ userId: user.bussinessId });
      if (!hospital) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "not-found",
            details: { text: "Hospital information not found." },
          }],
        });
        return
      }
     const existingAppointment = await webAppointments.findOne({
        veterinarian,
        appointmentDate,
        slotsId,
        status: { $ne: 'cancelled' } // Only check non-cancelled appointments
      });

      if (existingAppointment) {
         res.status(409).json({ // 409 Conflict
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "duplicate",
            details: { 
              text: "An appointment already exists for this time slot.",
              existingAppointment: existingAppointment
            },
          }],
        });
        return
      }
      // Get the slot details
      const slot = await DoctorsTimeSlotes.findOne(

        { 'timeSlots._id': slotsId },
        { 'timeSlots.$': 1 }
      );

      if (!slot || !slot.timeSlots || slot.timeSlots.length === 0) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "not-found",
            details: { text: "Selected time slot not found." },
          }],
        });
        return
      }
     
      const timeSlot = slot.timeSlots[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const timeSlot24 = slot.timeSlots[0].time24
  
const initials = hospital.businessName
        ? hospital.businessName.split(" ")
            .map((word: string) => word[0])
            .join("")
        : "XX";
const Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
    { hospitalId:hospital.userId, appointmentDate },
    {
      $inc: { tokenCounts: 1 },
      $setOnInsert: { appointmentDate }, // Ensure appointmentDate is set in the new document
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
      const tokenNumber = `${initials}00${Appointmenttoken.tokenCounts}-${appointmentDate}`;

      // Create the appointment
      const newAppointment = await webAppointments.create({
        hospitalId: user.bussinessId,
        tokenNumber,
        ownerName,
        petName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        passportNumber,
        microChipNumber,
        purposeOfVisit,
        appointmentType,
        appointmentSource: 'web',
        department,
        veterinarian,
        appointmentDate,
        day,
        appointmentTime: timeSlot.time,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        appointmentTime24:timeSlot24,
        slotsId: slotsId,
        status: 'booked'
      });

      res.status(200).json({
        resourceType: "OperationOutcome",
        status: "success",
        issue: [{
          severity: "information",
          code: "informational",
          details: {
            text: "Appointment created successfully",
            appointment: newAppointment,
            tokenNumber
          },
        }],
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error("Error in createWebAppointment:", error);
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: "exception",
          details: {
            text: "Internal server error while creating appointment.",
            diagnostics: errorMessage,
          },
        }],
      });
    }
  },
  getDoctorsSlotes: async (req: Request, res: Response): Promise<void> => {
    interface TimeSlot {
      toObject(): unknown[];
      _id: string;
      time: string;
      selected?: boolean;
      // Add other properties if they exist in your timeSlots
    }

    interface ForBookingTimeSlot extends TimeSlot {
      selected: boolean;
    }

    interface UnavailableSlotDocument {
      userId: string;
      date: string;
      day: string;
      slots: string[];
    }

    interface DoctorsTimeSlotesDocument {
      userId: string;
      day: string;
      timeSlots: TimeSlot[];
    }

    interface WebAppointment {
      veterinarian: string;
      appointmentDate: string;
      slotsId: string;
    }

    try {
      const { userId, day, date } = req.query as {
        userId?: string;
        day?: string;
        date?: string;
      };

      // ========= VALIDATION =========
      if (!userId || !day || !date) {
        const missingParams: string[] = [];
        if (!userId) missingParams.push("userId");
        if (!day) missingParams.push("day");
        if (!date) missingParams.push("date");

        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: { text: `Missing required parameter(s): ${missingParams.join(", ")}` },
            },
          ],
        });
        return;
      }

      // UUID format validation
      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        res.status(400).json({ message: "Invalid doctorId format" });
        return;
      }

      const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      if (!validDays.includes(day)) {
        res.status(400).json({ message: "Invalid day value" });
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD" });
        return;
      }

      // ========= STEP 1: FETCH UNAVAILABLE SLOTS =========
      const unavailableRecord: UnavailableSlotDocument | null = await UnavailableSlot.findOne({ userId: userId, date, day });
      const unavailableTimes: string[] = unavailableRecord ? unavailableRecord.slots : [];

      // ========= STEP 2: FETCH BOOKED SLOTS =========
      const bookedSlots: WebAppointment[] = await webAppointments.find({
        veterinarian: userId,
        appointmentDate: date,
      });
      const bookedSlotIds: string[] = bookedSlots.map((slot: WebAppointment) => slot.slotsId.toString());

      // ========= STEP 3: FETCH DOCTOR'S SLOTS =========
      const doctorTimeSlot: DoctorsTimeSlotesDocument | null = await DoctorsTimeSlotes.findOne({ doctorId: userId, day }, { "timeSlots.time24": 0 });
      if (!doctorTimeSlot) {
        res.status(200).json({
          message: "No slots found for this doctor/day",
          timeSlots: [],
        });
        return;
      }

      // ========= STEP 4: REMOVE UNAVAILABLE =========
      const filteredSlots: TimeSlot[] = doctorTimeSlot.timeSlots
        .filter((slot: TimeSlot) => !unavailableTimes.includes(slot.time));

      // ========= STEP 5: UPDATE selected IF BOOKED =========
      const updatedTimeSlots: ForBookingTimeSlot[] | object = filteredSlots.map((slot: TimeSlot) => {
        const isBooked = bookedSlotIds.includes(slot._id.toString());

        return {
          ...slot.toObject(),
          selected: isBooked ? true : slot.selected || false,
        };
      }) as object;
      const FhirData = convertTimeSlotsToFHIR(updatedTimeSlots as []);

      // ========= STEP 6: RETURN =========
      res.status(200).json({
        message: "Data fetched successfully",
        timeSlots: FhirData as FHIRSlotBundle,
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: { text: errorMessage },
          },
        ],
      });
    }
  }

}

export default webAppointmentController;
