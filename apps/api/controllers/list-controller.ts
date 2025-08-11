
import BusinessService, { formatKey } from '../services/BusinessService';
import {BusinessFhirFormatter} from '@yosemite-crew/fhir';
import mongoose from 'mongoose';
import validator from 'validator';
import { Request, Response } from 'express';
import AddDoctors from '../models/AddDoctor';
import { AddDoctorDoc, Department, Organization, WebAppointmentType } from '@yosemite-crew/types';
import { WebUser } from '../models/WebUser';
import { fetchDepartmentsAndRating } from '../utils/enrichmentHelper';

const baseUrl = process.env.BASE_URL;
const listController = {

  getDoctorsList: async (req: Request, res: Response): Promise<void> => {
    const { departmentId, limit, offset } = req.query as { departmentId?: string; limit?: string; offset?: string };
    if (!mongoose.Types.ObjectId.isValid(departmentId as string)) {
      res.status(200).json({ status: 0, message: "Invalid department ID" });
      return;
    }
    const parsedLimit = limit ? parseInt(limit) : 10;
    const parsedOffset = offset ? parseInt(offset) : 0;
    try {
      const specializationId = departmentId;

      interface DoctorWithDepartment extends AddDoctorDoc {
        departmentInfo?: Department
        rating?: number;
      }
      const doctors: DoctorWithDepartment[] = await AddDoctors.aggregate([
        {
          $match: {
            "professionalBackground.specialization": specializationId
          }
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: specializationId }
          }
        },
        {
          $lookup: {
            from: "departments",
            localField: "departmentObjId",
            foreignField: "_id",
            as: "departmentInfo"
          }
        },
        {
          $unwind: {
            path: "$departmentInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "feedbacks",
            localField: "userId",
            foreignField: "toId",
            as: "ratings"
          }
        },
        {
          $set: {
            rating: {
              $cond: [
                { $gt: [{ $size: "$ratings" }, 0] },
                { $round: [{ $avg: "$ratings.rating" }, 1] },
                0
              ]
            }
          }
        },
        {
          $project: {
            ratings: 0
          }
        },
        { $skip: parsedOffset || 0 },
        { $limit: parsedLimit || 10 }
      ]);

        const fhirDoctors = doctors.map((doc) => {
        const firstName = doc.firstName || "";
        const lastName = doc.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const departmentName = doc.departmentInfo?.departmentName || "Unknown";
        const consultationFee :number | unknown= doc?.consultFee || 0;
        const experience = doc.yearsOfExperience || 0;
        const docImage = doc.image || "";
        const qualifications = Array.isArray(doc?.qualification)
          ? doc?.qualification
          : doc?.qualification
            ? [doc?.qualification]
            : [];

        return {
          resourceType: "Practitioner",
          id: doc.userId,
          name: [
            {
              text: fullName
            }
          ],
          department: [
            {
              code: {
                text: departmentName
              }
            }
          ],
          qualification: qualifications.map((q: string) => ({
            code: {
              text: q
            }
          })),
          extension: [
            {
              url: `${baseUrl}/fhir/StructureDefinition/average-rating`,
              valueDecimal: doc.rating || 0,
              title: "averageRating",
            },
            {
              url: `${baseUrl}/fhir/StructureDefinition/consultation-fee`,
              valueDecimal: consultationFee || 0,
              title: "consultationFee",
            },
            {
              url: `${baseUrl}/fhir/StructureDefinition/experience-years`,
              valueInteger: experience,
              title: "experienceYears",
            },
            {
              url: `${baseUrl}/fhir/StructureDefinition/doctor-image`,
              valueString: docImage,
              title: "doctorImage",
            }
          ]
        };
      }
      );

      res.status(200).json({
        status: 1, data: {
          resourceType: "Bundle",
          type: "searchset",
          total: fhirDoctors.length,
          entry: fhirDoctors.map((practitioner) => ({ resource: practitioner }))
        }
      });
      return

    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        res.status(200).json({ status: 0, error: error.message || "Failed to fetch doctors." });
        return
      } else {
        res.status(200).json({ status: 0, error: "Failed to fetch doctors." });
        return
      }
    }
  },

  doctorsTeam: async (req: Request, res: Response): Promise<void> => {
    try {
      const { businessId } = req.query;
      const today = new Date().toISOString().split("T")[0];
      const currentTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      type FutureAppointments = Omit<AddDoctorDoc, 'futureAppointments' | 'hasUpcomingAppointment'> & {
        futureAppointments: WebAppointmentType[];
        hasUpcomingAppointment: boolean;
      };

      const fhirDoctors: FutureAppointments[] = await AddDoctors.aggregate([
        { $match: { bussinessId: businessId } },
        {
          $lookup: {
            from: "webappointments",
            let: { veterinarian: "$userId", todayDate: today, nowTime: currentTime },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$veterinarian", "$$veterinarian"] },
                      {
                        $or: [
                          {
                            $and: [
                              { $eq: ["$appointmentDate", "$$todayDate"] },
                              { $gt: ["$appointmentTime24", "$$nowTime"] }
                            ]
                          },
                          { $gt: ["$appointmentDate", "$$todayDate"] }
                        ]
                      }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 1,
                  appointmentDate: 1,
                  appointmentTime24: 1,
                  ownerName: 1,
                  petName: 1,
                  purposeOfVisit: 1
                }
              }
            ],
            as: "futureAppointments"
          }
        },
        {
          $addFields: {
            hasUpcomingAppointment: {
              $gt: [{ $size: "$futureAppointments" }, 0]
            }
          }
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            "personalInfo.firstName": 1,
            "personalInfo.lastName": 1,
            "personalInfo.image": 1,
            futureAppointments: 1,
            hasUpcomingAppointment: 1
          }
        }
      ]);

      const fhirPractitioners = fhirDoctors.map((doc) => {
        const practitioner = {
          resourceType: "Practitioner",
          id: doc.userId,
          name: [
            {
              use: "official",
              // family: doc.personalInfo?.lastName || "",
              family: doc.lastName || "Unknown",
              given: [doc.firstName || ""]
            }
          ],
          photo: doc.image ? [{ url: doc.image }] : []
        };

        const appointments = doc.futureAppointments.map((appt) => ({
          resourceType: "Appointment",
          id: appt._id,
          status: "booked",
          description: appt.purposeOfVisit || "Consultation",
          start: `${appt.appointmentDate}T${appt.appointmentTime24}:00`,
          hasUpcomingAppointment: true, // ✅ This is the added flag
          participant: [
            {
              actor: {
                // reference: `Practitioner/${typeof doc._id === "string" ? doc._id : doc?._id.toString() as string}`,
                reference: `Practitioner/${doc.userId}`,
                display: `${doc.firstName} ${doc.lastName}`
              },
              status: "accepted"
            },
            {
              actor: {
                display: `${appt.ownerName ?? ""} (${appt.petName ?? ""})`
              },
              status: "accepted"
            }
          ]
        }));

        return {
          practitioner,
          appointments
        }
      });

      if (!fhirPractitioners.length) {
        res.status(200).json({ status: 0, message: "No doctor found" });
      }

      res.status(200).json({
        status: 1,
        data: fhirPractitioners
      });
      return
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Doctor fetch error:", error.message);
        res.status(500).json({ status: 0, error: error.message || "Error fetching doctors and appointments." });
        return
      } else {
        // Handle unexpected error types    
        console.error("Doctor fetch error:", error);
        res.status(500).json({ status: 0, error: "Error fetching doctors and appointments." });
        return
      }
    }
  },

  getLists: async (req: Request, res: Response): Promise<void> => {
    try {
      let { type, offset = 0, limit = 10 } = req.query as { type?: string; offset?: string; limit?: string };

      // Sanitize and validate query parameters
      type = typeof type === 'string' ? validator.escape(type.trim()) : '';
      offset = validator.isInt(offset.toString(), { min: 0 }) ? parseInt(String(offset), 10) : 0;
      limit = validator.isInt(limit.toString(), { min: 1, max: 100 }) ? parseInt(String(limit), 10) : 10;

      let businessType ='';
      if(type !=='hospital'){
        businessType=type;
      }

      const allowedTypes: string[] = ['','veterinaryBusiness', 'breedingFacility', 'petSitter', 'groomerShop', 'all'];

      // const businessType = type;

      if (!allowedTypes.includes(businessType)) {
        res.status(200).json({ status: 0, message: "Invalid Business Type" });
        return;
      }

      const businessData: Record<string, unknown> = {};

      const fetchUsers = async (type: string) => {
        console.log(type,'typppe');
        const matchStage = type ? { role: type } : {};
        const countQuery = matchStage;
        const [users, totalCount] = await Promise.all([
          WebUser.aggregate([
            { $match: matchStage },
            {
              $lookup: {
                from: 'profiledatas',
                localField: 'cognitoId',
                foreignField: 'userId',
                as: 'profileData',
              }
            },
            {
              $unwind: {
                path: '$profileData',
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $lookup: {
                from: 'departments',
                let: { userIdFromProfile: '$profileData.userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$userId', '$$userIdFromProfile']
                      }
                    }
                  },
                  {
                    $project: {
                      departmentId: '$_id',
                      _id: 0,
                      departmentName: 1,
                      userId: 1,

                    }
                  }
                ],
                as: 'departments'
              }
            },

            { $skip: offset },
            { $limit: limit },
          ]),
         WebUser.countDocuments(countQuery),
        ]);

        if (type === 'hospital') {
          await fetchDepartmentsAndRating(users);
        }

        return { data: users, count: totalCount };
      };

      if (businessType === 'all') {

        for (const type of allowedTypes.filter((t) => t !== 'all')) {
          const key: string = formatKey(type);
          businessData[key] = await fetchUsers(type);
        }
      } else {

        const key = formatKey(businessType);
        businessData[key] = await fetchUsers(businessType);
      }

      const fhirGroupedBundles: Record<string, unknown> = {};

      for (const key in businessData) {
        const group = (businessData[key] as { data: Organization[] }).data;
        const nestedResources = [];

        for (const org of group) {
          const fhirOrg = BusinessFhirFormatter.toFhirOrganization(org) as Record<string, unknown>; 
          const fhirDepts = BusinessFhirFormatter.toFhirHealthcareServices(org);

          fhirOrg.healthcareServices = fhirDepts;
          nestedResources.push(fhirOrg);
        }

        fhirGroupedBundles[key] = {
          resourceType: "Bundle",
          type: "collection",
          total: nestedResources.length,
          entry: nestedResources.map(resource => ({ resource }))
        };
      }

      res.status(200).json({
        status: 1,
        data: fhirGroupedBundles
      });
      return

    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
        res.status(500).json({ status: 0, error: err.message });
        return
      } else {
        // Handle unexpected error types
        console.error(err);
        res.status(500).json({ status: 0, error: "An unexpected error occurred." });
        return
      }
    }
  },

  searchOrganization: async (req: Request, res: Response): Promise<void> => {
    try {
      interface BusinessSearchResult {
        data: Organization[];
        count: number;
      }
      let { search, offset = 0, limit = 10 } = req.query as { search?: string; offset?: string; limit?: string };

      // Sanitize and validate query parameters
      search = typeof search === 'string' ? validator.escape(search.trim()) : '';
      offset = validator.isInt(String(offset), { min: 0 }) ? parseInt(String(offset), 10) : 0;
      limit = validator.isInt(limit.toString(), { min: 1, max: 100 }) ? parseInt(String(limit), 10) : 10;



      const businessData: BusinessSearchResult = await BusinessService.getBusinessSearchList(search, offset, limit);

      const nestedResources = [];

      for (const org of businessData.data) {
        const fhirOrg = BusinessFhirFormatter.toFhirOrganization(org) as Record<string, unknown>;
        const fhirDepts = BusinessFhirFormatter.toFhirHealthcareServices(org);
        fhirOrg.healthcareServices = fhirDepts;
        nestedResources.push(fhirOrg);
      }

      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        total: businessData.count,
        entry: nestedResources.map(resource => ({ resource }))
      };

      res.status(200).json({
        status: 1,
        data: bundle
      });
      return

    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        res.status(500).json({ status: 0, error: err.message });
        return
      }
      else {
        console.error(err);
        res.status(500).json({ status: 0, error: "An unexpected error occurred." });
        return
      }
    }
  }

}

export default listController;








