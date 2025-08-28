
import { Request, Response } from "express";
import { emergencyAppointment } from "../models/emergency-appointment";
import { FHIREmergencyAppointment, FHIRPractitioner, NormalDoctor, NormalEmergencyAppointment, NormalEmergencyAppointmentForTable } from "@yosemite-crew/types";
import { ProfileData, WebUser } from "../models/WebUser";
import { convertDoctorsToFHIR, convertEmergencyAppointmentFromFHIR, convertEmergencyAppointmentToFHIRForTable } from "@yosemite-crew/fhir";
import { AppointmentsToken } from "../models/web-appointment";
import mongoose from "mongoose";
const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0'); // Use getDate() for day of month
  return `${year}-${month}-${day}`;
};

function getCurrentTimeOnly(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 -> 12
  return `${hours}:${minutes} ${ampm}`; // e.g. 11:30 AM
}


export const emergencyAppointments = {
  createEmergencyAppointment: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {

      const { data } = req.body as { data: FHIREmergencyAppointment };

      const NormalData: NormalEmergencyAppointment = convertEmergencyAppointmentFromFHIR(data);
      if (typeof NormalData.userId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(NormalData.userId)) {
        res.status(400).json({ message: 'Invalid userId format' });
        return;
      }

      if (!NormalData || !NormalData.department || !NormalData.veterinarian) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }
      const appointmentDate = getCurrentDate(); // Set to current date, e.g., "2025-08-14"
      const appointmentTime = getCurrentTimeOnly();
      let id;
      const hospitalId = await WebUser.findOne({ cognitoId: NormalData.userId });
      if (hospitalId) {
        id = hospitalId.bussinessId;
      }

      const hospital = await ProfileData.findOne({ userId: id });
      if (!hospital) {
        res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "not-found",
            details: { text: "Hospital information not found." },
          }],
        });
        return;
      }

      const initials = hospital.businessName
        ? hospital.businessName.split(" ")
          .map((word: string) => word[0])
          .join("")
        // .substring(0, 2) // Limit to 2 characters
        : "XX";

      const Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
        { hospitalId: id, appointmentDate },
        {
          $inc: { tokenCounts: 1 },
          $setOnInsert: { appointmentDate },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      const tokenNumber = `${initials}-EM-00${Appointmenttoken.tokenCounts}-${appointmentDate}`;

      const newAppointment = await emergencyAppointment.create({
        userId: NormalData.userId ?? "",
        hospitalId: id ?? "",
        tokenNumber: tokenNumber ?? "",
        ownerName: NormalData.ownerName ?? "",
        petName: NormalData.petName ?? "",
        department: NormalData.department,
        veterinarian: NormalData.veterinarian,
        petType: NormalData.petType ?? "",
        petBreed: NormalData.petBreed ?? "",
        gender: NormalData.gender ?? "",
        phoneNumber: NormalData.phoneNumber ?? "",
        email: NormalData.email ?? "",
        appointmentTime,
        appointmentDate,
      });

      res.status(201).json({
        message: "Emergency appointment created successfully",
        data: newAppointment,
      });
    } catch (error) {
      console.error("Error creating emergency appointment:", error);
      res.status(500).json({
        message: "Failed to create emergency appointment",
        error: (error as Error).message,
      });
    }
  },
  getDoctorsWithDepartment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.query as { userId: string };
      if (typeof userId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        res.status(400).json({ message: 'Invalid userId format' });
        return;
      }
      // Step 1: Find hospital's businessId
      const hospital = await WebUser.findOne({ cognitoId: userId }).select("bussinessId");
      if (!hospital) {
        res.status(404).json({ message: "Hospital not found" });
        return;
      }

      // Step 2: Aggregation to get doctors with full name
      const doctors: NormalDoctor[] = await WebUser.aggregate([
        {
          $match: {
            bussinessId: hospital.bussinessId,
            role: "vet",
          },
        },
        {
          $lookup: {
            from: "adddoctors", // collection name
            localField: "cognitoId",
            foreignField: "userId",
            as: "doctorDetails",
          },
        },
        {
          $unwind: {
            path: "$doctorDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0, // remove _id
            cognitoId: 1,
            department: 1,
            fullName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$doctorDetails.firstName", ""] },
                    " ",
                    { $ifNull: ["$doctorDetails.lastName", ""] }
                  ]
                }
              }
            }
          },
        },
      ]);

      const fhirData: FHIRPractitioner[] = convertDoctorsToFHIR(doctors);
      res.status(200).json({ data: fhirData });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  getEmergencyAppointment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, page = '1', limit = '10' } = req.query as { 
        userId?: string; 
        page?: string; 
        limit?: string;
      };

      // Validate and parse pagination parameters
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        res.status(400).json({ 
          message: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100" 
        });
        return;
      }

      const skip = (pageNum - 1) * limitNum;
      const matchQuery: { [key: string]: unknown } = {};

      // Build UTC date filter
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tomorrowUTC = new Date(todayUTC);
      tomorrowUTC.setUTCDate(todayUTC.getUTCDate() + 1);

      matchQuery.createdAt = { $gte: todayUTC, $lt: tomorrowUTC };

      if (userId) {
        if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
          res.status(400).json({ message: "Invalid userId format" });
          return;
        }

        const webUser = await WebUser.findOne({ cognitoId: userId }).lean();
        if (!webUser) {
          res.status(404).json({ message: "User not found" });
          return;
        }

        if (webUser.role === "vet") {
          matchQuery.veterinarian = userId;
        } else if (webUser.role === "veterinaryBusiness") {
          matchQuery.hospitalId = userId;
        } else {
          matchQuery.hospitalId = webUser.bussinessId || "";
        }
      } else {
        res.status(400).json({ message: "userId is required" });
        return;
      }

      // Get total count for pagination metadata
      const totalCount = await emergencyAppointment.countDocuments(matchQuery);
      const totalPages = Math.ceil(totalCount / limitNum);

      // Aggregation with lookups and pagination
      const appointments = await emergencyAppointment.aggregate([
        { $match: matchQuery },

        // Convert department string -> ObjectId
        {
          $addFields: {
            departmentObjId: {
              $cond: {
                if: { $eq: [{ $type: "$department" }, "string"] },
                then: { $toObjectId: "$department" },
                else: "$department"
              }
            }
          }
        },

        // Lookup department
        {
          $lookup: {
            from: "admindepartments",
            localField: "departmentObjId",
            foreignField: "_id",
            as: "departmentInfo"
          }
        },

        // Lookup doctor by veterinarian userId
        {
          $lookup: {
            from: "adddoctors",
            localField: "veterinarian",
            foreignField: "userId",
            as: "doctorInfo"
          }
        },

        // Unwind arrays
        { $unwind: { path: "$departmentInfo", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$doctorInfo", preserveNullAndEmptyArrays: true } },

        // Sort by creation date (newest first)
        { $sort: { createdAt: -1 } },

        // Add pagination stages
        { $skip: skip },
        { $limit: limitNum },

        // Shape final output
        {
          $project: {
            _id: 1,
            userId: 1,
            hospitalId: 1,
            tokenNumber: 1,
            ownerName: 1,
            petName: 1,
            veterinarian: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$doctorInfo.firstName", ""] },
                    " ",
                    { $ifNull: ["$doctorInfo.lastName", ""] }
                  ]
                }
              }
            },
            departmentName: "$departmentInfo.name",
            appointmentStatus: 1,
            petType: 1,
            petBreed: 1,
            gender: 1,
            phoneNumber: 1,
            email: 1,
            appointmentTime: 1,
            createdAt: 1
          }
        }
      ]);

      if (!appointments || appointments.length === 0) {
        res.status(200).json({ 
          message: "No appointments found",
          data: [],
          pagination: {
            currentPage: pageNum,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limitNum,
            hasNext: false,
            hasPrev: false
          }
        });
        return;
      }

      const fhirAppointments = appointments.map((appt: NormalEmergencyAppointmentForTable) =>
        convertEmergencyAppointmentToFHIRForTable(appt)
      );

      res.status(200).json({
        message: "Emergency appointments retrieved successfully",
        data: fhirAppointments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      });

    } catch (error) {
      console.error("Error retrieving emergency appointments:", error);
      res.status(500).json({
        message: "Failed to retrieve emergency appointments",
        error: (error as Error).message,
      });
    }
  },
   updateEmergencyAppointmentStatus: async (req: Request, res: Response): Promise<void> => {
      try {
        const  appointmentId  = req.params.Id;
        const { status } = req.body as { status: string };
  
        // Validate appointmentId
        if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
          res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "invalid",
                details: { text: "Invalid or missing appointmentId" },
              },
            ],
          });
          return;
        }
  
        // Validate status
        const validStatuses = ["booked", "fulfilled", "cancelled", "accepted", "inProgress", "checkedIn", "noshow"];
        if (!status || typeof status !== "string" || !validStatuses.includes(status)) {
          res.status(400).json({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "invalid",
                details: { text: `Invalid or missing status. Valid statuses: ${validStatuses.join(", ")}` },
              },
            ],
          });
          return;
        }
  
        // Find and update the appointment
        const updatedAppointment = await emergencyAppointment.findByIdAndUpdate(
          appointmentId,
          { appointmentStatus: status },
          { new: true }
        );
  
        if (!updatedAppointment) {
          res.status(404).json({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "not-found",
                details: { text: "Appointment not found" },
              },
            ],
          });
          return;
        }
  
        // Return FHIR OperationOutcome for success
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: { text: "Appointment status updated successfully" },
            },
          ],
        });
      } catch (error) {
        console.error("Error updating appointment status:", error);
        res.status(500).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "exception",
              details: { text: "Internal server error" },
            },
          ],
        });
      }
    },
};
