
import { Request, Response } from "express";
import pets from "../models/pet.model";
import AppUser from "../models/appuser-model";
import { IUser, pets as Ipet, NormalPetData } from "@yosemite-crew/types";
import { convertPetDataToFhir } from "@yosemite-crew/fhir";
import { OperationOutcome, SearchPetsRequestBody } from "@yosemite-crew/types/dist/web-appointments-types/web-appointments";

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
      const { names, microChip } = req.query;

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
          { firstName: new RegExp(names as string, "i") },
          { lastName: new RegExp(names as string, "i") }
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
        petName: new RegExp(names as string, "i")
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
  }


  //   createWebAppointment:async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     console.log("Raw FHIR Data:", JSON.stringify(req.body, null, 2));

  //     const fhirConverter = new FHIRToNormalConverter(req.body);
  //     const normalData = fhirConverter.convertToNormal() as NormalizedAppointment;

  //     console.log("Converted Data:", normalData);

  //     const {
  //       hospitalId,
  //       HospitalName,
  //       ownerName,
  //       phone,
  //       addressline1,
  //       street,
  //       city,
  //       state,
  //       zipCode,
  //       petName,
  //       petAge,
  //       petType,
  //       gender,
  //       breed,
  //       purposeOfVisit,
  //       appointmentType,
  //       appointmentSource,
  //       department,
  //       veterinarian,
  //       appointmentDate,
  //       day,
  //       timeSlots,
  //     } = normalData;

  //     // Validate required fields
  //     if (!hospitalId || !HospitalName || !ownerName || !appointmentDate) {
  //       console.error("Missing required fields:", { hospitalId, HospitalName, ownerName, appointmentDate });
  //       res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "required",
  //             details: { text: "Required fields are missing: hospitalId, HospitalName, ownerName, and appointmentDate are required." },
  //           },
  //         ],
  //       });
  //       return;
  //     }

  //     // Validate appointmentDate format (YYYY-MM-DD)
  //     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  //     if (!dateRegex.test(appointmentDate)) {
  //       res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "appointmentDate must be in YYYY-MM-DD format." },
  //           },
  //         ],
  //       });
  //       return;
  //     }

  //     // Validate timeSlots
  //     if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0 || !timeSlots[0]?.time) {
  //       res.status(400).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "error",
  //             code: "invalid",
  //             details: { text: "timeSlots must be a non-empty array with at least one valid time slot." },
  //           },
  //         ],
  //       });
  //       return;
  //     }

  //     // Convert time to 12-hour and 24-hour formats


  //     const initials = HospitalName
  //       ? HospitalName.split(" ")
  //           .map((word: string) => word[0])
  //           .join("")
  //       : "XX";
  //     console.log("Normaldata", initials, appointmentDate);

  //     // Create or update token for the hospital and date
  //     // Explicitly set appointmentDate in the new document during upsert
  //  // In your createWebAppointment function
  // const Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
  //   { hospitalId, appointmentDate },
  //   {
  //     $inc: { tokenCounts: 1 },
  //     $setOnInsert: { appointmentDate }, // Ensure appointmentDate is set in the new document
  //   },
  //   { new: true, upsert: true, setDefaultsOnInsert: true }
  // );

  //     console.log("Normaldata", initials, Appointmenttoken);

  //     const tokenCounts = Appointmenttoken?.tokenCounts ?? 1;
  //     const tokenNumber = `${initials}00${tokenCounts}-${appointmentDate}`;
  //     console.log("Generated Token Number:", tokenNumber);

  //     const response = await webAppointments.create({
  //       hospitalId,
  //       tokenNumber,
  //       ownerName,
  //       phone,
  //       addressline1,
  //       street,
  //       city,
  //       state,
  //       zipCode,
  //       petName,
  //       petAge,
  //       petType,
  //       gender,
  //       breed,
  //       purposeOfVisit,
  //       appointmentType,
  //       appointmentSource,
  //       department,
  //       veterinarian,
  //       appointmentDate,
  //        appointmentTime: timeSlots?.[0]?.time || "",
  //         day,
  //         appointmentTime24: timeSlots?.[0]?.time24 || "",
  //         slotsId: timeSlots?.[0]?._id || "",
  //     });

  //     if (response) {
  //       res.status(200).json({
  //         resourceType: "OperationOutcome",
  //         status: "success",
  //         issue: [
  //           {
  //             severity: "information",
  //             code: "informational",
  //             details: {
  //               text: "Appointment created successfully",
  //             },
  //           },
  //         ],
  //         data: response,
  //       });
  //       return;
  //     }

  //     res.status(400).json({
  //       resourceType: "OperationOutcome",
  //       issue: [
  //         {
  //           severity: "error",
  //           code: "bad",
  //           details: { text: "Appointment creation failed" },
  //         },
  //       ],
  //     });
  //   } catch (error: any) {
  //     console.error("Error in createWebAppointment:", error);
  //     res.status(500).json({
  //       resourceType: "OperationOutcome",
  //       issue: [
  //         {
  //           severity: "error",
  //           code: "exception",
  //           details: {
  //             text: "Internal server error while creating appointment.",
  //           },
  //           diagnostics: error.message,
  //         },
  //       ],
  //     });
  //   }
  // },

  //   getDoctorsSlotes: async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const { doctorId, day, date } = req.query.params as {
  //       doctorId?: string;
  //       day?: string;
  //       date?: string;
  //     };
  //     // Validation checks
  //     if (!doctorId) {
  //        res.status(400).json({
  //         resourceType: 'OperationOutcome',
  //         issue: [
  //           {
  //             severity: 'information',
  //             code: 'informational',
  //             details: { text: 'Missing required parameter: doctorId' },
  //           },
  //         ],
  //       });
  //     }

  //     if (!day) {
  //        res.status(400).json({
  //         resourceType: 'OperationOutcome',
  //         issue: [
  //           {
  //             severity: 'information',
  //             code: 'informational',
  //             details: { text: 'Missing required parameter: day' },
  //           },
  //         ],
  //       });
  //     }

  //     if (!date) {
  //        res.status(400).json({
  //         resourceType: 'OperationOutcome',
  //         issue: [
  //           {
  //             severity: 'information',
  //             code: 'informational',
  //             details: { text: 'Missing required parameter: date' },
  //           },
  //         ],
  //       });
  //     }

  //     // doctorId format validation (UUID v4)
  //     if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
  //        res.status(400).json({ message: 'Invalid doctorId format' });
  //     }

  //     const validDays = [
  //       'Monday',
  //       'Tuesday',
  //       'Wednesday',
  //       'Thursday',
  //       'Friday',
  //       'Saturday',
  //       'Sunday',
  //     ];

  //     if (typeof day !== 'string' || !validDays.includes(day)) {
  //        res.status(400).json({ message: 'Invalid day value' });
  //     }

  //     if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  //        res
  //         .status(400)
  //         .json({ message: 'Invalid date format. Expected YYYY-MM-DD' });
  //     }

  //     const bookedSlots = await webAppointments.find({
  //       veterinarian: doctorId,
  //       appointmentDate: date,
  //     });

  //     const doctorTimeSlot = await DoctorsTimeSlotes.findOne({ doctorId, day });
  //   console.log("kjjjjkjkjkjkjkjkj",doctorTimeSlot);
  //     if (doctorTimeSlot) {
  //       const filteredSlots = doctorTimeSlot.timeSlots.filter(
  //         (slot: any) => slot.selected === true
  //       );

  //       const bookedSlotIds = bookedSlots.map((slot: any) =>
  //         slot.slotsId.toString()
  //       );

  //       const updatedTimeSlots = filteredSlots.map((slot: any) => ({
  //         ...slot.toObject(),
  //         isBooked: bookedSlotIds.includes(slot._id.toString()),
  //       }));

  //       const fhirConverter = new FHIRSlotConverter(updatedTimeSlots, doctorId, null, date);
  //       const fhirBundle = fhirConverter.convertToFHIRBundle();

  //        res.status(200).json({
  //         message: 'Data fetched successfully',
  //         timeSlots: fhirBundle,
  //       });
  //     } else {
  //        res.status(200).json({
  //         message: 'Data fetch Failed',
  //         timeSlots: [],
  //       });
  //     }
  //   } catch (error: any) {
  //      res.status(500).json({
  //       resourceType: 'OperationOutcome',
  //       issue: [
  //         {
  //           severity: 'error',
  //           code: 'exception',
  //           details: {
  //             text: error.message,
  //           },
  //         },
  //       ],
  //     });
  //   }}
};

export default webAppointmentController;
