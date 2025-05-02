const { webAppointments } = require("../models/WebAppointment");
const Department = require("../models/AddDepartment");
const AddDoctors = require("../models/addDoctor");
const { ProfileData } = require("../models/WebUser");
// const YoshPet = require('../models/YoshPet');
// const YoshUser = require('../models/YoshUser');

const S3_BASE_URL = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`;
const AWS = require("aws-sdk");
const ProfileVisibility = require("../models/profileVisibility");
const Message = require("../models/ChatModel");
const FHIRConverter = require("../utils/DoctorsHandler");
const { GraphDataToFHIR } = require("../utils/HospitalFhirHandler");
const { AppointmentFHIRConverter } = require("../utils/WebAppointmentHandler");
const { AppointmentsFHIRConverter } = require("../utils/HospitalFhirHandler");

const { validateFHIR } = require("../Fhirvalidator/FhirValidator");
const { json, text } = require("body-parser");
const {
  DepartmentFromFHIRConverter,
} = require("../utils/DepartmentFhirHandler");
const { response } = require("express");
const FeedBack = require("../models/FeedBack");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}); // Replace with your CloudFront domain if applicable

const HospitalController = {
  // getAllAppointments: async (req, res) => {
  //   try {
  //     const { offset = 0, limit = 5, userId } = req.query;
  //     console.log(req.query);
  //     const today = new Date().toISOString().split("T")[0]; // Today's date in "YYYY-MM-DD" format

  //     const parsedOffset = parseInt(offset, 10);
  //     const parsedLimit = parseInt(limit, 10);

  //     const response = await webAppointments.aggregate([
  //       {
  //         $match: {
  //           isCanceled: { $ne: 2 },
  //           $or: [{ hospitalId: userId }, { veterinarian: userId }],
  //           appointmentDate: today,
  //         },
  //       },
  //       {
  //         $addFields: {
  //           departmentObjId: { $toObjectId: "$department" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "adddoctors",
  //           localField: "veterinarian",
  //           foreignField: "userId",
  //           as: "doctorInfo",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "departments",
  //           localField: "departmentObjId",
  //           foreignField: "_id",
  //           as: "departmentInfo",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$doctorInfo",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$departmentInfo",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $facet: {
  //           metadata: [{ $count: "total" }],
  //           data: [{ $skip: parsedOffset }, { $limit: parsedLimit }],
  //         },
  //       },
  //       {
  //         $project: {
  //           total: { $arrayElemAt: ["$metadata.total", 0] },
  //           Appointments: {
  //             $map: {
  //               input: "$data",
  //               as: "appointment",
  //               in: {
  //                 _id: "$$appointment._id",
  //                 tokenNumber: "$$appointment.tokenNumber",
  //                 petName: "$$appointment.petName",
  //                 ownerName: "$$appointment.ownerName",
  //                 slotsId: "$$appointment.slotsId",
  //                 petType: "$$appointment.petType",
  //                 breed: "$$appointment.breed",
  //                 purposeOfVisit: "$$appointment.purposeOfVisit",
  //                 appointmentDate: {
  //                   $dateToString: {
  //                     format: "%d %b %Y",
  //                     date: { $toDate: "$$appointment.appointmentDate" },
  //                   },
  //                 },
  //                 appointmentTime: "$$appointment.appointmentTime",
  //                 appointmentStatus: "$$appointment.appointmentStatus",
  //                 department: "$$appointment.departmentInfo.departmentName",
  //                 veterinarian: {
  //                   $concat: [
  //                     "$$appointment.doctorInfo.personalInfo.firstName",
  //                     " ",
  //                     "$$appointment.doctorInfo.personalInfo.lastName",
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     ]);

  //     if (!response.length || !response[0].Appointments.length) {
  //       return res
  //         .status(404)
  //         .json({ message: "No slots found for the doctor." });
  //     }

  //     return res.status(200).json({
  //       message: "Data fetched successfully",
  //       totalAppointments: response[0].total || 0,
  //       Appointments: response[0].Appointments,
  //     });
  //   } catch (error) {
  //     console.error("Error in getAppointmentsForDoctorDashboard:", error);
  //     return res.status(500).json({
  //       message: "An error occurred while fetching slots.",
  //       error: error.message,
  //     });
  //   }
  // },
  // departmentsOverView: async (req, res) => {

  // }
  // ,
  AppointmentGraphs: async (req, res) => {
    const { reportType } = req.query;

    console.log("type", reportType);

    switch (reportType) {
      case "AppointmentGraphs":
        if (req.method === "GET") {
          try {
            const { LastDays, userId } = req.query;
            const days = parseInt(LastDays, 10) || 7;

            console.log("LastDays", LastDays);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - (days - 1));

            console.log("Fetching data from:", startDate, "to", endDate);

            const departmentWiseAppointments = await webAppointments.aggregate([
              {
                $match: {
                  createdAt: { $gte: startDate, $lte: endDate },
                  hospitalId: userId,
                },
              },
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                },
              },
              {
                $group: {
                  _id: "$departmentObjId",
                  count: { $sum: 1 },
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "_id",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  // departmentId: "$_id",
                  departmentName: {
                    $ifNull: ["$departmentInfo.departmentName", "Unknown"],
                  },
                  count: 1,
                },
              },
            ]);
            console.log("Appointments", departmentWiseAppointments);

            const data = new DepartmentFromFHIRConverter(
              departmentWiseAppointments
            ).toFHIR();

            return res.status(200).json(data);
          } catch (error) {
            console.error("Error in DepartmentBasisAppointmentGraph:", error);
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Internal server error. Please try again later.",
                  },
                  diagnostics: error.message,
                },
              ],
            });
          }
        }
      case "WeeklyAppointmentGraph":
        if (req.method === "GET") {
          try {
            const { userId } = req.query;

            console.log("WeeklyAppointmentGraph", userId);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const weeklyAppointments = await webAppointments.aggregate([
              {
                $match: {
                  appointmentDate: {
                    $gte: sevenDaysAgo.toISOString().split("T")[0],
                  },
                  hospitalId: userId,
                },
              },
              {
                $group: {
                  _id: "$day",
                  count: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  day: "$_id",
                  count: 1,
                },
              },
            ]);
            console.table(weeklyAppointments);

            const weekData = {
              Monday: 0,
              Tuesday: 0,
              Wednesday: 0,
              Thursday: 0,
              Friday: 0,
              Saturday: 0,
              Sunday: 0,
            };

            weeklyAppointments.forEach(({ day, count }) => {
              weekData[day] = count;
            });

            const responseData = Object.entries(weekData).map(
              ([day, count]) => ({
                day,
                count,
              })
            );

            console.log("Appointments ( last 7 days )", responseData);

            const data = new DepartmentFromFHIRConverter(
              responseData
            ).convertToFHIR();

            return res.status(200).json(data);
          } catch (error) {
            console.error("Error in getDataForWeeklyAppointmentChart:", error);
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "An error occurred while retrieving dashboard data",
                  },
                },
              ],
            });
          }
        }
        break;
    }
  },
  // getDataForWeeklyAppointmentChart: async (req, res) => {},

  AppointmentGraphOnMonthBase: async (req, res) => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    try {
      const { days, userId } = req.query;
      const monthsToFetch = parseInt(days, 10) || 6; // Default to last 6 months if not provided

      if (!userId) {
        return res.status(400).json({ message: "UserId is required" });
      }

      console.log("UserId:", userId);

      const endMonth = new Date();
      const startMonth = new Date();
      startMonth.setMonth(endMonth.getMonth() - (monthsToFetch - 1));
      startMonth.setDate(1);

      // Define date range (first day of startMonth to first day of next month of endMonth)
      const gt = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
      const lt = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1);

      const aggregatedAppointments = await webAppointments.aggregate([
        {
          $match: {
            hospitalId: userId,
            appointmentDate: {
              $gte: gt.toISOString().split("T")[0],
              $lt: lt.toISOString().split("T")[0],
            },
          },
        },
        {
          $group: {
            _id: { month: { $month: { $toDate: "$appointmentDate" } } },
            totalAppointments: { $sum: 1 },
            successful: {
              $sum: {
                $cond: [{ $eq: ["$appointmentStatus", "fulfilled"] }, 1, 0],
              },
            },
            canceled: {
              $sum: {
                $cond: [{ $eq: ["$appointmentStatus", "cancelled"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id.month",
            totalAppointments: 1,
            successful: 1,
            canceled: 1,
          },
        },
      ]);

      console.log("Aggregated Data:", aggregatedAppointments);

      const results = [];
      let currentDate = new Date(startMonth);

      while (currentDate <= endMonth) {
        const month = currentDate.getMonth() + 1; // Get month number (1-12)
        const monthName = monthNames[month - 1];

        const existingData = aggregatedAppointments.find(
          (item) => item.month === month
        );

        results.push(
          existingData
            ? { ...existingData, monthName }
            : {
                month,
                monthName,
                totalAppointments: 0,
                successful: 0,
                canceled: 0,
              }
        );

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      results.sort((a, b) => a.month - b.month);

      const data = new GraphDataToFHIR(results).convertToFHIR();

      return res.status(200).json({
        message: "Appointment data for the last X months fetched successfully",
        data: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Error in AppointmentGraphOnMonthBase:", error);
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            details: {
              text: error.message,
            },
          },
        ],
      });
    }
  },
  WaitingRoomOverView: async (req, res) => {
    const { type } = req.query;
    switch (type) {
      case "waitingroomOverview":
        if (req.method === "GET") {
          try {
            const { Organization } = req.query;
            const userId = Organization.split("/")[1];
            if (!userId) {
              return res.status(400).json({ message: "userId is required" });
            }

            const currentDate = new Date().toISOString().split("T")[0];
            const currentDateStart = new Date();
            currentDateStart.setHours(0, 0, 0, 0);
            const currentDateEnd = new Date();
            currentDateEnd.setHours(23, 59, 59, 999);

            const appointmentStats = await webAppointments.aggregate([
              {
                $match: { hospitalId: userId, appointmentDate: currentDate },
              },
              {
                $group: {
                  _id: null,
                  totalAppointments: {
                    $sum: {
                      $cond: [{ $not: { $eq: ["$isCanceled", 2] } }, 1, 0],
                    },
                  },
                  successful: {
                    $sum: { $cond: [{ $eq: ["$isCanceled", 5] }, 1, 0] },
                  },
                  canceled: {
                    $sum: { $cond: [{ $in: ["$isCanceled", [2, 3]] }, 1, 0] },
                  },
                  checkedIn: {
                    $sum: { $cond: [{ $eq: ["$isCanceled", 4] }, 1, 0] },
                  },
                },
              },
            ]);

            const availableDoctorsCount = await AddDoctors.countDocuments({
              bussinessId: userId,
              isAvailable: "1",
            });

            const appointmentsCreatedTodayCount =
              await webAppointments.countDocuments({
                hospitalId: userId,
                createdAt: { $gte: currentDateStart, $lte: currentDateEnd },
              });

            const result = {
              totalAppointments: appointmentStats[0]?.totalAppointments || 0,
              successful: appointmentStats[0]?.successful || 0,
              canceled: appointmentStats[0]?.canceled || 0,
              checkedIn: appointmentStats[0]?.checkedIn || 0,
              availableDoctors: availableDoctorsCount,
              appointmentsCreatedToday: appointmentsCreatedTodayCount,
            };
            console.log("result", result);
            const data = new FHIRConverter(result).overviewConvertToFHIR();
            console.log("hello", JSON.stringify(data, null, 2));

            return res.status(200).json(JSON.stringify(data)); // Removed JSON.stringify to ensure valid JSON format
          } catch (error) {
            console.error("Error in WaitingRoomOverView:", error);
            return res.status(500).json({ message: "Internal server error" });
          }
        }
        break;

      case "dashboardOverview":
        if (req.method === "GET") {
          try {
            const { subject, reportType } = req.query;

            if (!subject || !reportType) {
              return res
                .status(400)
                .json({ message: "Missing required query parameters" });
            }

            const match = subject.match(/^Organization\/(.+)$/);
            if (!match) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                reportType: reportType,
                issue: [
                  {
                    severity: "error",
                    code: "invalid-subject",
                    details: {
                      text: "Invalid subject format. Expected Organization/12345",
                    },
                  },
                ],
              });
            }

            const userId = match[1];
            const { LastDays = 7 } = req.query;
            const days = parseInt(LastDays, 10) || 7;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - (days - 1));

            const formatDate = (date) => date.toISOString().split("T")[0];

            const formattedStartDate = formatDate(startDate);
            const formattedEndDate = formatDate(endDate);

            const appointmentCounts = await webAppointments.countDocuments({
              hospitalId: userId,
              appointmentStatus: "fulfilled",
              appointmentDate: {
                $gte: formattedStartDate,
                $lte: formattedEndDate,
              },
            });

            const totalDoctors = await AddDoctors.countDocuments({
              bussinessId: userId,
            });
            const totalDepartments = await Department.countDocuments({
              bussinessId: userId,
            });

            const data = new FHIRConverter({
              totalDoctors,
              totalDepartments,
              appointmentCounts,
            }).overviewConvertToFHIR();

            return res.status(200).json(JSON.stringify(data));
          } catch (error) {
            console.error("Error getting hospital dashboard data:", error);
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: error.message,
                  },
                },
              ],
            });
          }
        }
        break;

      case "HospitalSideDoctorOverview":
        if (req.method === "GET") {
          try {
            const { subject, reportType } = req.query;

            if (!subject || !reportType) {
              return res
                .status(400)
                .json({ message: "Missing required query parameters" });
            }

            const match = subject.match(/^Organization\/(.+)$/);
            if (!match) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                reportType: reportType,
                issue: [
                  {
                    severity: "error",
                    code: "invalid-subject",
                    details: {
                      text: "Invalid subject format. Expected Organization/12345",
                    },
                  },
                ],
              });
            }

            const organizationId = match[1];
            console.log("userId", organizationId);

            const aggregation = await AddDoctors.aggregate([
              {
                $match: { bussinessId: organizationId },
              },
              {
                $group: {
                  _id: "$professionalBackground.specialization",
                },
              },
              {
                $count: "totalSpecializations",
              },
            ]);

            const totalDoctors = await AddDoctors.countDocuments({
              bussinessId: organizationId,
            });

            const availableDoctors = await AddDoctors.countDocuments({
              bussinessId: organizationId,
              isAvailable: "1",
            });

            // const averageRaing = await AddDoctors.feedback({})

            const overview = {
              totalDoctors,
              totalSpecializations: aggregation[0]?.totalSpecializations || 0,
              availableDoctors,
            };
            console.log("Overview:", overview);

            const data = new FHIRConverter(overview).overviewConvertToFHIR();
            return res.status(200).json(JSON.stringify(data));
          } catch (error) {
            console.error("Error fetching overview data:", error);
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: error.message,
                  },
                },
              ],
            });
          }
        }
        break;

      // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Appointment Management>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

      case "AppointmentManagement":
        if (req.method === "GET") {
          try {
            const { LastDays, userId } = req.query;

            if (!LastDays) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "error",
                    code: "exception",
                    details: { text: "Missing required parameter: LastDays" },
                  },
                ],
              });
            } else if (!userId) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "error",
                    code: "exception",
                    details: { text: "missing required parameter: userId" },
                  },
                ],
              });
            }
            const days = parseInt(LastDays, 10) || 7; // Default to 7 days if not provided

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - (days - 1));

            // const today = new Date().toISOString().split('T')[0]; // Today's date in "YYYY-MM-DD" format

            const appointments = await webAppointments.aggregate([
              {
                $addFields: {
                  appointmentDateObj: { $toDate: "$appointmentDate" }, // Convert string to Date
                },
              },
              {
                $match: {
                  appointmentDateObj: { $gte: startDate, $lte: endDate },
                  $or: [{ hospitalId: userId }, { veterinarian: userId }],
                },
              },
              {
                $group: {
                  _id: null,
                  newAppointments: {
                    $sum: { $cond: [{ $eq: ["$isCanceled", 0] }, 1, 0] },
                  },
                  upcomingAppointments: {
                    $sum: {
                      $cond: [
                        { $gt: ["$appointmentDateObj", new Date()] },
                        1,
                        0,
                      ],
                    },
                  },
                  canceled: {
                    $sum: { $cond: [{ $eq: ["$isCanceled", 2] }, 1, 0] },
                  },
                  successful: {
                    $sum: { $cond: [{ $eq: ["$isCanceled", 3] }, 1, 0] },
                  },
                },
              },
            ]);

            const result = appointments[0] || {
              newAppointments: 0,
              upcomingAppointments: 0,
              canceled: 0,
              successful: 0,
            };
            const data = new FHIRConverter(result).overviewConvertToFHIR();
            return res.status(200).json({ data });
          } catch (error) {
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "fatal",
                  code: "exception",
                  details: {
                    text: "An error occurred while fetching data.",
                  },
                  diagnostics: error.message,
                },
              ],
            });
          }
        }
      case "DepartmentOverview":
        if (req.method === "GET") {
          try {
            const { LastDays, userId } = req.query;
            const days = parseInt(LastDays, 10) || 7;

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - (days - 1));

            // Sanitize userId (since it's from Cognito and user input)
            if (
              typeof userId !== "string" ||
              userId.length > 100 ||
              userId.includes("$") ||
              userId.includes(".")
            ) {
              return res.status(400).json({ message: "Invalid userId." });
            }

            const matchConditions = {
              createdAt: {
                $gte: startDate,
                $lte: endDate,
              },
              $or: [{ hospitalId: userId }, { bussinessId: userId }],
            };

            const countAggregation = [
              { $match: matchConditions },
              { $count: "totalCount" },
            ];

            // STEP 1: Find petIds that only appear once in the entire collection
            const oneTimePetIdsResult = await webAppointments.aggregate([
              {
                $match: {
                  petId: { $ne: null },
                },
              },
              {
                $group: {
                  _id: "$petId",
                  totalAppointments: { $sum: 1 },
                },
              },
              {
                $match: {
                  totalAppointments: 1,
                },
              },
            ]);

            const oneTimePetIds = oneTimePetIdsResult.map((p) => p._id);

            const uniquePetCount = await webAppointments.countDocuments({
              petId: { $in: oneTimePetIds },
              createdAt: {
                $gte: startDate,
                $lte: endDate,
              },
              $or: [{ hospitalId: userId }, { bussinessId: userId }],
            });

            // console.log("oneTimePetIds", uniquePetCount);
            // STEP 3: Run department, doctor, and appointment counts
            const [departmentsCount, doctorsCount, appointmentsCount] =
              await Promise.all([
                Department.aggregate(countAggregation),
                AddDoctors.aggregate(countAggregation),
                webAppointments.aggregate(countAggregation),
              ]);

            const result = {
              totalDepartments:
                departmentsCount.length > 0
                  ? departmentsCount[0].totalCount
                  : 0,
              totalDoctors:
                doctorsCount.length > 0 ? doctorsCount[0].totalCount : 0,
              totalAppointments:
                appointmentsCount.length > 0
                  ? appointmentsCount[0].totalCount
                  : 0,
              newPetsCount: uniquePetCount,
            };

            const data = new FHIRConverter(result).overviewConvertToFHIR();

            console.log("result", JSON.stringify(data, null, 2));

            return res.status(200).json({
              message: "Data counts fetched successfully",
              data,
            });
          } catch (error) {
            console.error("Error in departmentsOverView:", error);
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message,
                },
              ],
            });
          }
        }
        break;
      case "DoctorDashOverview":
        if (req.method === "GET") {
          try {
            const { doctorId } = req.query;

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);

            if (
              typeof doctorId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(doctorId)
            ) {
              return res
                .status(400)
                .json({ message: "Invalid doctorId format" });
            }

            const totalAppointments = await webAppointments.countDocuments({
              veterinarian: doctorId,
              createdAt: {
                $gte: startDate,
                $lte: endDate,
              },
            });

            const totalRating = await FeedBack.countDocuments({
              doctorId: doctorId,
            });

            // const totalAssessment = await

            const data = new FHIRConverter({
              totalAppointments,
              totalRating,
            }).overviewConvertToFHIR();
            return res.status(200).json(data);
          } catch (error) {
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message,
                },
              ],
            });
          }
        }
    }
  },

  // WaittingRoomOverViewPatientInQueue: async (req, res) => {
  //   try {
  //     const { userId, offset = 0, limit = 10 } = req.query;
  //     const parsedOffset = parseInt(offset);
  //     const parsedLimit = parseInt(limit);
  //     const currentDate = new Date().toISOString().split("T")[0];

  //     const response = await webAppointments.aggregate([
  //       {
  //         $match: {
  //           hospitalId: userId,
  //           appointmentDate: currentDate,
  //         },
  //       },
  //       {
  //         $addFields: {
  //           departmentObjId: { $toObjectId: "$department" },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "adddoctors",
  //           localField: "veterinarian",
  //           foreignField: "userId",
  //           as: "doctorInfo",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "departments",
  //           localField: "departmentObjId",
  //           foreignField: "_id",
  //           as: "departmentInfo",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$doctorInfo",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$departmentInfo",
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $sort: { appointmentDate: 1 }, // Sort by appointment date (optional)
  //       },
  //       {
  //         $skip: parsedOffset,
  //       },
  //       {
  //         $limit: parsedLimit,
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           petName: 1,
  //           tokenNumber: 1,
  //           ownerName: 1,
  //           slotsId: 1,
  //           petType: 1,
  //           breed: 1,
  //           appointmentSource: 1,
  //           isCanceled: 1,
  //           purposeOfVisit: 1,
  //           appointmentDate: {
  //             $dateToString: {
  //               format: "%d %b %Y",
  //               date: { $toDate: "$appointmentDate" },
  //             },
  //           },
  //           appointmentTime: 1,
  //           appointmentStatus: 1,
  //           department: "$departmentInfo.departmentName",
  //           veterinarian: {
  //             $concat: [
  //               "$doctorInfo.personalInfo.firstName",
  //               " ",
  //               "$doctorInfo.personalInfo.lastName",
  //             ],
  //           },
  //         },
  //       },
  //     ]);

  //     const totalAppointments = await webAppointments.countDocuments({
  //       hospitalId: userId,
  //       appointmentDate: currentDate,
  //     });

  //     if (!response.length) {
  //       return res.status(404).json({
  //         resourceType: "OperationOutcome",
  //         issue: [
  //           {
  //             severity: "information",
  //             code: "not-found",
  //             details: {
  //               text: "No appointments found for the specified date.",
  //             },
  //           },
  //         ],
  //       });
  //     }
  //     console.log({ total: totalAppointments, totalAppointments: response });
  //     const data = AppointmentFHIRConverter.convertAppointments({
  //       total: totalAppointments,
  //       Appointments: response,
  //     });

  //     return res.status(200).json(JSON.stringify(data, null, 2));
  //   } catch (error) {
  //     console.error("Error in getAppointmentsForDoctorDashboard:", error);
  //     return res.status(500).json({
  //       resourceType: "OperationOutcome",
  //       error: error,
  //       issue: [
  //         {
  //           severity: "error",
  //           code: "exception",
  //           details: {
  //             text: error.message,
  //           },
  //         },
  //       ],
  //     });
  //   }
  // },
  getDepartmentDataForHospitalProfile: async (req, res) => {
    try {
      const { userId } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }
      const profileData = await ProfileData.findOne(
        { userId },
        {
          _id: 0,
          address: {
            addressLine1: 1,
            city: 1,
            street: 1,
            state: 1,
            zipCode: 1,
            email: 1,
          },
          phoneNumber: 1,
          businessName: 1,
          logo: 1,
          website: 1,
          selectedServices: 1,
        }
      );

      if (profileData?.logo) {
        profileData.logo = s3.getSignedUrl("getObject", {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: profileData.logo,
        });
      }

      const departmentData = await Department.aggregate([
        {
          $match: { bussinessId: userId },
        },
        {
          $lookup: {
            from: "adddoctors",
            let: { deptId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$professionalBackground.specialization", "$$deptId"],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  fullName: {
                    $concat: [
                      { $ifNull: ["$personalInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$personalInfo.lastName", ""] },
                    ],
                  },
                },
              },
            ],
            as: "doctors",
          },
        },
        {
          $addFields: {
            doctorCount: { $size: "$doctors" },
            doctorNames: "$doctors.fullName",
          },
        },
        {
          $project: {
            departmentName: 1,
            doctorCount: 1,
            doctorNames: 1,
            description: 1,
            email: 1,
            phone: 1,
            _id: 1,
          },
        },
      ]);

      console.log("Response:", departmentData, "Profile Data:", profileData);

      res.status(200).json({
        profile: profileData,
        departments: departmentData,
      });
    } catch (error) {
      console.error("Error getting department data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  saveVisibility: async (req, res) => {
    try {
      const { facilitys, selectedServices, selectedDepartments, images } =
        req.body;
      const { userId } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      await ProfileVisibility.deleteOne({ hospitalId: userId });

      // Create and save the new profile visibility data
      const profileVisibility = new ProfileVisibility({
        hospitalId: userId,
        facility: facilitys,
        department: selectedDepartments,
        services: selectedServices,
        images,
        createdAt: new Date(), // Set the current timestamp
      });

      await profileVisibility.save();
      res.status(201).json(profileVisibility);
    } catch (error) {
      console.error("Error saving visibility:", error);
      res.status(400).json({ message: error.message });
    }
  },

  getVisibility: async (req, res) => {
    try {
      const { userId } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const visibilityData = await ProfileVisibility.findOne({
        hospitalId: userId,
      });

      if (visibilityData) {
        res.status(200).json(visibilityData);
      }
    } catch (error) {
      console.error("Error getting visibility:", error);
    }
  },

  // getConfirmedAppointments: async (req, res) => {},
  // getCompletedAppointments: async (req, res) => {},
  // getCanceledAppointments: async (req, res) => {},
  // getUpcomingAppointments: async (req, res) => {},

  getDoctorsTotalAppointments: async (req, res) => {
    try {
      const { userId, LastDays, search, page = 1, limit = 10 } = req.query;
      const days = parseInt(LastDays, 10) || 7;
      const pageNumber = parseInt(page, 10);
      const pageSize = parseInt(limit, 10);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      // Base pipeline (without pagination)
      const basePipeline = [
        {
          $match: {
            hospitalId: userId,
            createdAt: { $gte: startDate, $lte: endDate },
            appointmentStatus: "fulfilled",
          },
        },
        {
          $group: {
            _id: "$veterinarian",
            department: { $first: "$department" },
            totalAppointments: { $sum: 1 },
          },
        },
        { $addFields: { departmentId: { $toObjectId: "$department" } } },
        {
          $lookup: {
            from: "adddoctors",
            localField: "_id",
            foreignField: "userId",
            as: "doctorInfo",
          },
        },
        { $unwind: "$doctorInfo" },
        {
          $lookup: {
            from: "departments",
            localField: "departmentId",
            foreignField: "_id",
            as: "departmentInfo",
          },
        },
        { $unwind: "$departmentInfo" },
      ];

      // Search filter
      if (search) {
        basePipeline.push({
          $match: {
            $or: [
              {
                "doctorInfo.personalInfo.firstName": {
                  $regex: search,
                  $options: "i",
                },
              },
              {
                "doctorInfo.personalInfo.lastName": {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          },
        });
      }

      // Count total documents
      const countPipeline = [...basePipeline, { $count: "totalCount" }];
      const totalDocs = await webAppointments.aggregate(countPipeline);
      const totalCount = totalDocs.length > 0 ? totalDocs[0].totalCount : 0;

      // Apply sorting and pagination
      const paginationPipeline = [
        { $sort: { "doctorInfo.personalInfo.firstName": 1 } },
        { $skip: (pageNumber - 1) * pageSize },
        { $limit: pageSize },
        {
          $project: {
            _id: 0,
            doctorId: "$_id",
            doctorName: {
              $concat: [
                "$doctorInfo.personalInfo.firstName",
                " ",
                "$doctorInfo.personalInfo.lastName",
              ],
            },
            image: { $concat: [S3_BASE_URL, "$doctorInfo.personalInfo.image"] },
            department: "$departmentInfo.departmentName",
            totalAppointments: 1,
          },
        },
      ];

      // Execute paginated query
      const totalAppointments = await webAppointments.aggregate([
        ...basePipeline,
        ...paginationPipeline,
      ]);

      const data = new AppointmentFHIRConverter({
        totalAppointments,
        page: pageNumber,
        totalPages: Math.ceil(totalCount / pageSize),
        totalCount,
      }).toFHIRBundle();

      res.status(200).json(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error getting total appointments:", error);
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: error.message,
            },
          },
        ],
      });
    }
  },
  // hospitalDashboard: async (req, res) => {

  // },
  getAppointmentsForHospitalDashboard: async (req, res) => {
    const { type } = req.query;
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HOSPITAL DASHBOARD APPOINTMENT LIST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    //  console.log("type:", type);
    switch (type) {
      case "AppointmentLists":
        if (req.method === "GET") {
          try {
            const { organization, offset = 0, limit } = req.query;
            console.log("req.query", typeof limit);

            const hospitalId = organization.split("/")[1];

            // console.log("hospitalId",hospitalId)

            const parsedOffset = parseInt(offset, 10);
            const parsedLimit = parseInt(limit, 10);

            const response = await webAppointments.aggregate([
              {
                $match: {
                  appointmentStatus: { $eq: "pending" },
                  $or: [
                    { hospitalId: hospitalId },
                    { veterinarian: hospitalId },
                  ],
                  // appointmentDate: today,
                },
              },
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $facet: {
                  metadata: [{ $count: "total" }],
                  data: [{ $skip: parsedOffset }, { $limit: parsedLimit }],
                },
              },
              {
                $project: {
                  total: { $arrayElemAt: ["$metadata.total", 0] },
                  Appointments: {
                    $map: {
                      input: "$data",
                      as: "appointment",
                      in: {
                        _id: "$$appointment._id",
                        tokenNumber: "$$appointment.tokenNumber",
                        petName: "$$appointment.petName",
                        ownerName: "$$appointment.ownerName",
                        slotsId: "$$appointment.slotsId",
                        petType: "$$appointment.petType",
                        breed: "$$appointment.breed",
                        purposeOfVisit: "$$appointment.purposeOfVisit",
                        appointmentDate: {
                          $dateToString: {
                            format: "%d %b %Y",
                            date: { $toDate: "$$appointment.appointmentDate" },
                          },
                        },
                        appointmentTime: "$$appointment.appointmentTime",
                        appointmentStatus: "$$appointment.appointmentStatus",
                        department:
                          "$$appointment.departmentInfo.departmentName",
                        veterinarian: {
                          $concat: [
                            "$$appointment.doctorInfo.personalInfo.firstName",
                            " ",
                            "$$appointment.doctorInfo.personalInfo.lastName",
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ]);

            if (!response.length || !response[0].Appointments.length) {
              return res.status(200).json({
                status: 0,
                message: "No appointments available.",
              });
            }

            const data = AppointmentFHIRConverter.convertAppointments(
              response[0]
            );

            // console.log("data", JSON.stringify(data, null, 2));

            // console.log("validator", validateFHIR(data));

            return res.status(200).json({ status: 1, data });
          } catch (error) {
            console.error(
              "Error in getAppointmentsForHospitalDashboard:",
              error
            );
            return res.status(500).json({
              message: "An error occurred while fetching slots.",
              error: error.message,
            });
          }
        }

        break;
      case "PatientsInQueue":
        if (req.method === "GET") {
          try {
            const { organization, offset = 0, limit = 10 } = req.query;
            const parsedOffset = parseInt(offset);
            const parsedLimit = parseInt(limit);
            const currentDate = new Date().toISOString().split("T")[0];
            const userId = organization.split("/")[1];

            if (
              typeof userId !== "string" ||
              !/^[a-fA-F0-9-]{36}$/.test(userId)
            ) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "invalid",
                    code: "error",
                    details: {
                      text: "invalid id format",
                    },
                  },
                ],
              });
            }
            // Validate date (YYYY-MM-DD)
            if (
              typeof currentDate !== "string" ||
              !/^\d{4}-\d{2}-\d{2}$/.test(currentDate)
            ) {
              return res.status(400).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "invalid",
                    code: "error",
                    details: {
                      text: "Invalid date format. Expected YYYY-MM-DD",
                    },
                  },
                ],
              });
            }

            const response = await webAppointments.aggregate([
              {
                $match: {
                  hospitalId: userId,
                  appointmentDate: currentDate,
                },
              },
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $sort: { appointmentDate: 1 },
              },
              {
                $skip: parsedOffset,
              },
              {
                $limit: parsedLimit,
              },
              {
                $project: {
                  _id: 1,
                  petName: 1,
                  tokenNumber: 1,
                  ownerName: 1,
                  slotsId: 1,
                  petType: 1,
                  breed: 1,
                  appointmentSource: 1,
                  isCanceled: 1,
                  purposeOfVisit: 1,
                  appointmentDate: {
                    $dateToString: {
                      format: "%d %b %Y",
                      date: { $toDate: "$appointmentDate" },
                    },
                  },
                  appointmentTime: 1,
                  appointmentStatus: 1,
                  department: "$departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$doctorInfo.personalInfo.firstName",
                      " ",
                      "$doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
            ]);

            const totalAppointments = await webAppointments.countDocuments({
              hospitalId: userId,
              appointmentDate: currentDate,
            });

            if (!response.length) {
              return res.status(404).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "Information",
                    code: "informational",
                    details: {
                      text: "No patient in Queue",
                    },
                  },
                ],
              });
            }

            const data = AppointmentFHIRConverter.convertAppointments({
              total: totalAppointments,
              Appointments: response,
            });

            return res.status(200).json(JSON.stringify(data, null, 2));
          } catch (error) {
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: error.message,
                  },
                },
              ],
            });
          }
        }
        break;

      // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Appointment Management Confirmed UpComing Completed Canceled >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

      case "Confirmed":
        if (req.method === "GET") {
          try {
            const { userId, page = 1, limit = 8 } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;

            const daysMap = {
              1: "Sunday",
              2: "Monday",
              3: "Tuesday",
              4: "Wednesday",
              5: "Thursday",
              6: "Friday",
              7: "Saturday",
            };

            // Get total count of confirmed appointments
            const totalCount = await webAppointments.countDocuments({
              $or: [{ veterinarian: userId }, { hospitalId: userId }],
              appointmentStatus: "booked",
            });

            const confirmedAppointments = await webAppointments.aggregate([
              {
                $match: {
                  $or: [{ veterinarian: userId }, { hospitalId: userId }],
                  appointmentStatus: "booked",
                },
              }, // Only confirmed appointments
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                  parsedAppointmentDate: {
                    $dateFromString: { dateString: "$appointmentDate" },
                  },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $addFields: {
                  dayOfWeek: { $dayOfWeek: "$parsedAppointmentDate" },
                  formattedDate: {
                    $dateToString: {
                      format: "%d %b",
                      date: "$parsedAppointmentDate",
                      timezone: "UTC",
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  hospitalId: 1,
                  appointmentDate: "$formattedDate",
                  appointmentDay: "$dayOfWeek",
                  appointmentTime: 1,
                  ownerName: 1,
                  petName: 1,
                  department: "$departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$doctorInfo.personalInfo.firstName",
                      " ",
                      "$doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
              { $skip: skip },
              { $limit: limitNumber },
            ]);

            const formattedAppointments = confirmedAppointments.map(
              (appointment) => ({
                ...appointment,
                appointmentDate: `${daysMap[appointment.appointmentDay]}, ${
                  appointment.appointmentDate
                }`,
              })
            );

            // Calculate total pages
            const totalPages = Math.ceil(totalCount / limitNumber);

            const data = new AppointmentsFHIRConverter({
              status: type,
              page: pageNumber,
              limit: limitNumber,
              totalPages,
              totalCount,
              hasMore: pageNumber < totalPages,
              appointments: formattedAppointments,
            }).toFHIRBundle();
            res.status(200).json(data);
          } catch (error) {
            console.error("Error getting confirmed appointments:", error);
            res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message, // Or provide a custom message
                },
              ],
            });
          }
        }
        break;
      case "UpComing":
        if (req.method === "GET") {
          try {
            const { userId, page = 1, limit = 10 } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;

            const daysMap = {
              1: "Sunday",
              2: "Monday",
              3: "Tuesday",
              4: "Wednesday",
              5: "Thursday",
              6: "Friday",
              7: "Saturday",
            };

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const formattedDate = todayStart.toISOString().split("T")[0];

            const totalCount = await webAppointments.countDocuments({
              $or: [{ veterinarian: userId }, { hospitalId: userId }],
              appointmentStatus: "booked",
              appointmentDate: {
                $gt: formattedDate,
              },
            });
            const confirmedAppointments = await webAppointments.aggregate([
              {
                $match: {
                  $or: [{ veterinarian: userId }, { hospitalId: userId }],
                  appointmentStatus: "booked",
                  appointmentDate: {
                    $gt: formattedDate,
                  },
                },
              },
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                  parsedAppointmentDate: {
                    $dateFromString: { dateString: "$appointmentDate" },
                  },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $addFields: {
                  dayOfWeek: { $dayOfWeek: "$parsedAppointmentDate" },
                  formattedDate: {
                    $dateToString: {
                      format: "%d %b",
                      date: "$parsedAppointmentDate",
                      timezone: "UTC",
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  hospitalId: 1,
                  appointmentDate: "$formattedDate",
                  appointmentDay: "$dayOfWeek",
                  appointmentTime: 1,
                  ownerName: 1,
                  petName: 1,
                  department: "$departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$doctorInfo.personalInfo.firstName",
                      " ",
                      "$doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
              { $skip: skip },
              { $limit: limitNumber },
            ]);

            const formattedAppointments = confirmedAppointments.map(
              (appointment) => ({
                ...appointment,
                appointmentDate: `${daysMap[appointment.appointmentDay]}, ${
                  appointment.appointmentDate
                }`,
              })
            );

            const totalPages = Math.ceil(totalCount / limitNumber);

            const data = new AppointmentsFHIRConverter({
              status: type,
              page: pageNumber,
              limit: limitNumber,
              totalPages,
              totalCount,
              hasMore: pageNumber < totalPages,
              appointments: formattedAppointments,
            }).toFHIRBundle();

            console.log("-----------------------------------", {
              status: "Confirmed",
              page: pageNumber,
              limit: limitNumber,
              totalPages,
              totalCount,
              hasMore: pageNumber < totalPages,
              appointments: formattedAppointments,
            });
            res.status(200).json(data);
          } catch (error) {
            console.error("Error getting completed appointments:", error);
            res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message, // Or provide a custom message
                },
              ],
            });
          }
        }
        break;
      case "Cancelled":
        if (req.method === "GET") {
          try {
            const { userId, page = 1, limit = 10 } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;

            const daysMap = {
              1: "Sunday",
              2: "Monday",
              3: "Tuesday",
              4: "Wednesday",
              5: "Thursday",
              6: "Friday",
              7: "Saturday",
            };
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            oneMonthAgo.setHours(0, 0, 0, 0);

            const formattedDate = oneMonthAgo.toISOString().split("T")[0];
            console.log("oneMonthAgo", formattedDate);

            const totalCount = await webAppointments.countDocuments({
              $or: [{ veterinarian: userId }, { hospitalId: userId }],
              appointmentStatus: "cancelled",
              appointmentDate: { $lt: formattedDate },
            });
            const confirmedAppointments = await webAppointments.aggregate([
              {
                $match: {
                  $or: [{ veterinarian: userId }, { hospitalId: userId }],
                  appointmentStatus: "cancelled",
                  appointmentDate: { $lt: formattedDate },
                },
              }, // Only confirmed appointments
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                  parsedAppointmentDate: {
                    $dateFromString: { dateString: "$appointmentDate" },
                  },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $addFields: {
                  dayOfWeek: { $dayOfWeek: "$parsedAppointmentDate" },
                  formattedDate: {
                    $dateToString: {
                      format: "%d %b",
                      date: "$parsedAppointmentDate",
                      timezone: "UTC",
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  hospitalId: 1,
                  appointmentDate: "$formattedDate",
                  appointmentDay: "$dayOfWeek",
                  appointmentTime: 1,
                  ownerName: 1,
                  petName: 1,
                  department: "$departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$doctorInfo.personalInfo.firstName",
                      " ",
                      "$doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
              { $skip: skip },
              { $limit: limitNumber },
            ]);

            const formattedAppointments = confirmedAppointments.map(
              (appointment) => ({
                ...appointment,
                appointmentDate: `${daysMap[appointment.appointmentDay]}, ${
                  appointment.appointmentDate
                }`,
              })
            );

            const totalPages = Math.ceil(totalCount / limitNumber);
            const data = new AppointmentsFHIRConverter({
              status: type,
              page: pageNumber,
              limit: limitNumber,
              totalPages,
              totalCount,
              hasMore: pageNumber < totalPages,
              appointments: formattedAppointments,
            }).toFHIRBundle();
            res.status(200).json(data);
          } catch (error) {
            console.error("Error getting Cancelled appointments:", error);
            res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message, // Or provide a custom message
                },
              ],
            });
          }
        }
        break;
      case "Completed":
        if (req.method === "GET") {
          try {
            const { userId, page = 1, limit = 10 } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;

            const daysMap = {
              1: "Sunday",
              2: "Monday",
              3: "Tuesday",
              4: "Wednesday",
              5: "Thursday",
              6: "Friday",
              7: "Saturday",
            };
            const totalCount = await webAppointments.countDocuments({
              $or: [{ veterinarian: userId }, { hospitalId: userId }],
              appointmentStatus: "fulfilled",
            });
            const confirmedAppointments = await webAppointments.aggregate([
              {
                $match: {
                  $or: [{ veterinarian: userId }, { hospitalId: userId }],
                  appointmentStatus: "fulfilled",
                },
              }, // Only confirmed appointments
              {
                $addFields: {
                  departmentObjId: { $toObjectId: "$department" },
                  parsedAppointmentDate: {
                    $dateFromString: { dateString: "$appointmentDate" },
                  },
                },
              },
              {
                $lookup: {
                  from: "adddoctors",
                  localField: "veterinarian",
                  foreignField: "userId",
                  as: "doctorInfo",
                },
              },
              {
                $lookup: {
                  from: "departments",
                  localField: "departmentObjId",
                  foreignField: "_id",
                  as: "departmentInfo",
                },
              },
              {
                $unwind: {
                  path: "$doctorInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $unwind: {
                  path: "$departmentInfo",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $addFields: {
                  dayOfWeek: { $dayOfWeek: "$parsedAppointmentDate" },
                  formattedDate: {
                    $dateToString: {
                      format: "%d %b",
                      date: "$parsedAppointmentDate",
                      timezone: "UTC",
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  hospitalId: 1,
                  appointmentDate: "$formattedDate",
                  appointmentDay: "$dayOfWeek",
                  appointmentTime: 1,
                  ownerName: 1,
                  petName: 1,
                  department: "$departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$doctorInfo.personalInfo.firstName",
                      " ",
                      "$doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
              { $skip: skip },
              { $limit: limitNumber },
            ]);

            const formattedAppointments = confirmedAppointments.map(
              (appointment) => ({
                ...appointment,
                appointmentDate: `${daysMap[appointment.appointmentDay]}, ${
                  appointment.appointmentDate
                }`,
              })
            );

            const totalPages = Math.ceil(totalCount / limitNumber);
            const data = new AppointmentsFHIRConverter({
              status: type,
              page: pageNumber,
              limit: limitNumber,
              totalPages,
              totalCount,
              hasMore: pageNumber < totalPages,
              appointments: formattedAppointments,
            }).toFHIRBundle();

            res.status(200).json(data);
          } catch (error) {
            console.error("Error getting completed appointments:", error);
            res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  details: {
                    text: "Network error occurred while processing the request.",
                  },
                  diagnostics: error.message, // Or provide a custom message
                },
              ],
            });
          }
        }

        break;
        case "calenderaAppointment":
          if (req.method === "GET") {
            try {
              const { organization } = req.query;
              const userId = organization.split("/")[1];
              if (!userId) {
                return res.status(400).json({ message: "userId is required" });
              }
  
              const daysMap = {
                1: "Sunday",
                2: "Monday",
                3: "Tuesday",
                4: "Wednesday",
                5: "Thursday",
                6: "Friday",
                7: "Saturday",
              };
              const totalCount = await webAppointments.countDocuments({
                $or: [{ veterinarian: userId }, { hospitalId: userId }]
              });
              const allAppointments = await webAppointments.aggregate([
                {
                  $match: {
                    $or: [{ veterinarian: userId }, { hospitalId: userId }],
                    appointmentStatus : { $ne: 'pending' }
                  },
                }, // Only confirmed appointments
                {
                  $addFields: {
                    departmentObjId: { $toObjectId: "$department" },
                    parsedAppointmentDate: {
                      $dateFromString: { dateString: "$appointmentDate" },
                    },
                  },
                },
                {
                  $lookup: {
                    from: "adddoctors",
                    localField: "veterinarian",
                    foreignField: "userId",
                    as: "doctorInfo",
                  },
                },
                {
                  $lookup: {
                    from: "departments",
                    localField: "departmentObjId",
                    foreignField: "_id",
                    as: "departmentInfo",
                  },
                },
                {
                  $unwind: {
                    path: "$doctorInfo",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $unwind: {
                    path: "$departmentInfo",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $addFields: {
                    dayOfWeek: { $dayOfWeek: "$parsedAppointmentDate" },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    userId: 1,
                    hospitalId: 1,
                    appointmentDate: "$parsedAppointmentDate",
                    appointmentTime: 1,
                    appointmentStatus:1,
                    ownerName: 1,
                    petName: 1,
                    department: "$departmentInfo.departmentName",
                    veterinarian: {
                      $concat: [
                        "$doctorInfo.personalInfo.firstName",
                        " ",
                        "$doctorInfo.personalInfo.lastName",
                      ],
                    },
                  },
                }
              ]);
              const data = new AppointmentsFHIRConverter({
                appointments: allAppointments,
              }).toCalenderFHIRBundle();
  
              res.status(200).json(data);
            } catch (error) {
              console.error("Error getting completed appointments:", error);
              res.status(500).json({
                resourceType: "OperationOutcome",
                issue: [
                  {
                    severity: "error",
                    code: "exception",
                    details: {
                      text: "Network error occurred while processing the request.",
                    },
                    diagnostics: error.message, // Or provide a custom message
                  },
                ],
              });
            }
          }
    }

    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< NEXT CASES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  },

  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Message>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  getMessages: async (req, res) => {
    try {
      const { senderId, receiverId, page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const messages = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender: senderId, receiver: receiverId },
              { sender: receiverId, receiver: senderId },
            ],
          },
        },
        { $sort: { timestamp: -1 } }, // Sort in ascending order
        { $skip: skip }, // Skip for pagination
        { $limit: limitNumber }, // Limit messages per page
        {
          $project: {
            _id: 1,
            sender: 1,
            receiver: 1,
            content: 1,
            type: 1,
            timestamp: 1,
            time: 1,
            fileUrl: {
              $cond: {
                if: { $ne: ["$fileUrl", ""] },
                then: { $concat: [S3_BASE_URL, "$fileUrl"] },
                else: "",
              },
            },
          },
        },
      ]);

      // Check if more messages exist
      const totalMessages = await Message.countDocuments({
        $or: [
          { sender: senderId, receiver: receiverId },
          { sender: receiverId, receiver: senderId },
        ],
      });
      const hasMore = totalMessages > skip + limitNumber;

      res.status(200).json({ messages, hasMore });
    } catch (error) {
      console.error("Error in getMessages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  handleGetRating: async (req, res) => {
    try {
      const { doctorId } = req.query.params;
      console.log("doctorId", req.query.params);

      if (!doctorId) {
        return res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              details: {
                text: "Missing required parameter: doctorId",
              },
            },
          ],
        });
      }

      // Current date and date 1 week ago
      const currentDate = new Date();
      const oneWeekAgo = new Date(
        currentDate.setDate(currentDate.getDate() - 7)
      );

      const response = await FeedBack.aggregate([
        {
          $match: {
            doctorId: doctorId,
          },
        },
        {
          $lookup: {
            from: "yoshusers",
            localField: "userId",
            foreignField: "cognitoId",
            as: "usersInfo",
          },
        },
        {
          $addFields: {
            petsId: { $toObjectId: "$petId" },
          },
        },
        {
          $lookup: {
            from: "yoshpets",
            localField: "petsId",
            foreignField: "_id",
            as: "petInfo",
          },
        },
        {
          $unwind: {
            path: "$usersInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$petInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            formattedDate: {
              $dateToString: {
                format: "%d %B %Y",
                date: "$usersInfo.createdAt",
                timezone: "UTC",
              },
            },
            isOld: {
              $lte: ["$createdAt", oneWeekAgo], // Compare if the feedback date is older than 1 week
            },
          },
        },
        {
          $project: {
            _id: 1,
            feedback: 1,
            rating: 1,
            name: {
              $concat: ["$usersInfo.firstName", " ", "$usersInfo.lastName"],
            },
            image: {
              $concat: [
                `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`,
                {
                  $ifNull: [
                    { $arrayElemAt: ["$usersInfo.profileImage.url", 0] },
                    "",
                  ],
                },
              ],
            },
            petName: "$petInfo.petName",
            date: "$formattedDate",
            isOld: 1,
          },
        },
      ]);

      if (response.length > 0) {
        const data = new FHIRConverter(response).ratingConvertToFHIR();

        console.log("validator", validateFHIR(data));

        // Check if data is old or new and add corresponding parameter
        // const result = response.map((item) => {
        //   if (item.isOld) {
        //     item.status = "Old";
        //   } else {
        //     item.status = "New";
        //   }
        //   return item;
        // });

        res.status(200).json({
          rating: data,
        });
      } else {
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "information",
              code: "informational",
              details: {
                text: "No ratings found.",
              },
            },
          ],
        });
      }
    } catch (error) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: "Network error occurred while processing the request.",
            },
            diagnostics: error.message,
          },
        ],
      });
    }
  },
};

module.exports = HospitalController;
