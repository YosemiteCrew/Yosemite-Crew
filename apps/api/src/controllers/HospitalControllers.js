const { webAppointments } = require('../models/WebAppointment');
const Department = require('../models/AddDepartment');
const AddDoctors = require('../models/addDoctor');
const { ProfileData } = require('../models/WebUser');
// const YoshPet = require('../models/YoshPet');
// const YoshUser = require('../models/YoshUser');

const S3_BASE_URL = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`;
const AWS = require('aws-sdk');
const ProfileVisibility = require('../models/profileVisibility');
const Message = require('../models/ChatModel');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}); // Replace with your CloudFront domain if applicable

const HospitalController = {
  getAllAppointments: async (req, res) => {
    try {
      const { offset = 0, limit = 5, userId } = req.query;
      console.log(req.query);
      const today = new Date().toISOString().split('T')[0]; // Today's date in "YYYY-MM-DD" format

      const parsedOffset = parseInt(offset, 10);
      const parsedLimit = parseInt(limit, 10);

      const response = await webAppointments.aggregate([
        {
          $match: {
            isCanceled: { $ne: 2 },
            $or: [{ hospitalId: userId }, { veterinarian: userId }],
            appointmentDate: today,
          },
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        {
          $unwind: {
            path: '$doctorInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: parsedOffset }, { $limit: parsedLimit }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$metadata.total', 0] },
            Appointments: {
              $map: {
                input: '$data',
                as: 'appointment',
                in: {
                  _id: '$$appointment._id',
                  tokenNumber: '$$appointment.tokenNumber',
                  petName: '$$appointment.petName',
                  ownerName: '$$appointment.ownerName',
                  slotsId: '$$appointment.slotsId',
                  petType: '$$appointment.petType',
                  breed: '$$appointment.breed',
                  purposeOfVisit: '$$appointment.purposeOfVisit',
                  appointmentDate: {
                    $dateToString: {
                      format: '%d %b %Y',
                      date: { $toDate: '$$appointment.appointmentDate' },
                    },
                  },
                  appointmentTime: '$$appointment.appointmentTime',
                  appointmentStatus: '$$appointment.appointmentStatus',
                  department: '$$appointment.departmentInfo.departmentName',
                  veterinarian: {
                    $concat: [
                      '$$appointment.doctorInfo.personalInfo.firstName',
                      ' ',
                      '$$appointment.doctorInfo.personalInfo.lastName',
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      if (!response.length || !response[0].Appointments.length) {
        return res
          .status(404)
          .json({ message: 'No slots found for the doctor.' });
      }

      return res.status(200).json({
        message: 'Data fetched successfully',
        totalAppointments: response[0].total || 0,
        Appointments: response[0].Appointments,
      });
    } catch (error) {
      console.error('Error in getAppointmentsForDoctorDashboard:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching slots.',
        error: error.message,
      });
    }
  },
  getAppUpcCompCanTotalCountOnDayBasis: async (req, res) => {
    try {
      const { LastDays, userId } = req.query;
      const days = parseInt(LastDays, 10) || 7; // Default to 7 days if not provided
      console.log('req.query', req.query);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      console.log('startDate', startDate, 'endDate', endDate);

      // const today = new Date().toISOString().split('T')[0]; // Today's date in "YYYY-MM-DD" format

      const appointments = await webAppointments.aggregate([
        {
          $addFields: {
            appointmentDateObj: { $toDate: '$appointmentDate' }, // Convert string to Date
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
              $sum: { $cond: [{ $eq: ['$isCanceled', 0] }, 1, 0] },
            },
            upcomingAppointments: {
              $sum: {
                $cond: [{ $gt: ['$appointmentDateObj', new Date()] }, 1, 0],
              },
            },
            canceledAppointments: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 2] }, 1, 0] },
            },
            completedAppointments: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 3] }, 1, 0] },
            },
          },
        },
      ]);

      const result = appointments[0] || {
        newAppointments: 0,
        upcomingAppointments: 0,
        canceledAppointments: 0,
        completedAppointments: 0,
      };

      return res.status(200).json({
        message: 'Appointment counts fetched successfully',
        ...result,
      });
    } catch (error) {
      console.error('Error in getAppUpcCompCanTotalCountOnDayBasis:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching data.',
        error: error.message,
      });
    }
  },
  departmentsOverView: async (req, res) => {
    try {
      const { LastDays, userId } = req.query;
      const days = parseInt(LastDays, 10) || 7;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      console.log(
        'Fetching data from:',
        startDate,
        'to',
        endDate,
        'userId',
        userId
      );

      const matchConditions = {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
        $or: [{ hospitalId: userId }, { bussinessId: userId }],
      };

      // Add `hospitalId` if it exists

      const countAggregation = [
        {
          $match: matchConditions, // Dynamically generated match conditions
        },
        {
          $count: 'totalCount',
        },
      ];

      const [departmentsCount, doctorsCount, appointmentsCount] =
        await Promise.all([
          Department.aggregate(countAggregation),
          AddDoctors.aggregate(countAggregation),
          webAppointments.aggregate(countAggregation),
        ]);

      console.log(
        'departmentsCount, doctorsCount, appointmentsCount',
        departmentsCount,
        doctorsCount,
        // petsCount,
        appointmentsCount
      );
      const result = {
        departments:
          departmentsCount.length > 0 ? departmentsCount[0].totalCount : 0,
        doctors: doctorsCount.length > 0 ? doctorsCount[0].totalCount : 0,
        // pets: petsCount.length > 0 ? petsCount[0].totalCount : 0,
        appointments:
          appointmentsCount.length > 0 ? appointmentsCount[0].totalCount : 0,
      };

      return res.status(200).json({
        message: 'Data counts fetched successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in departmentsOverView:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching data.',
        error: error.message,
      });
    }
  },
  DepartmentBasisAppointmentGraph: async (req, res) => {
    try {
      const { LastDays, userId } = req.query;
      const days = parseInt(LastDays, 10) || 7;

      console.log('LastDays', LastDays);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      console.log('Fetching data from:', startDate, 'to', endDate);

      const departmentWiseAppointments = await webAppointments.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            hospitalId: userId,
          },
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
          },
        },
        {
          $group: {
            _id: '$departmentObjId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            departmentId: '$_id',
            departmentName: {
              $ifNull: ['$departmentInfo.departmentName', 'Unknown'],
            },
            count: 1,
          },
        },
      ]);

      return res.status(200).json({
        message: 'Department-wise appointment data fetched successfully',
        data: departmentWiseAppointments,
      });
    } catch (error) {
      console.error('Error in DepartmentBasisAppointmentGraph:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching data.',
        error: error.message,
      });
    }
  },
  getDataForWeeklyAppointmentChart: async (req, res) => {
    try {
      const { userId } = req.query;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const weeklyAppointments = await webAppointments.aggregate([
        {
          $match: {
            appointmentDate: { $gte: sevenDaysAgo.toISOString().split('T')[0] },
            hospitalId: userId,
          },
        },
        {
          $group: {
            _id: '$day',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            day: '$_id',
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

      const responseData = Object.entries(weekData).map(([day, count]) => ({
        day,
        count,
      }));

      console.table(responseData);
      return res.status(200).json({
        message: 'Weekly appointment data fetched successfully',
        data: responseData,
      });
    } catch (error) {
      console.error('Error in getDataForWeeklyAppointmentChart:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching data.',
        error: error.message,
      });
    }
  },

  AppointmentGraphOnMonthBase: async (req, res) => {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    try {
      const { days, userId } = req.query;
      const Month = parseInt(days, 10) || 6;
      console.log('UserId:', userId);

      const endMonth = new Date();
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setMonth(endMonth.getMonth() - (Month - 1));

      // Ensure correct date range
      const gt = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
      const lt = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1);

      console.log('Fetching data from:', gt, 'to', lt);

      const aggregatedAppointments = await webAppointments.aggregate([
        {
          $match: {
            hospitalId: userId, // Ensure userId is string
            appointmentDate: {
              $gte: gt.toISOString().split('T')[0], // Convert dates to string format
              $lt: lt.toISOString().split('T')[0],
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { $toDate: '$appointmentDate' } }, // Convert string date to actual Date
              month: { $month: { $toDate: '$appointmentDate' } },
            },
            totalAppointments: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 1] }, 1, 0] },
            },
            canceled: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 2] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            totalAppointments: 1,
            successful: 1,
            canceled: 1,
          },
        },
      ]);

      console.log('Aggregated Data:', aggregatedAppointments);

      const results = [];
      let currentDate = new Date(startMonth);

      while (currentDate <= endMonth) {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const monthName = monthNames[month - 1];

        const existingData = aggregatedAppointments.find(
          (item) => item.month === month && item.year === year
        );

        results.push(
          existingData || {
            year,
            month,
            monthName,
            totalAppointments: 0,
            successful: 0,
            canceled: 0,
          }
        );

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      results.sort((a, b) => a.year - b.year || a.month - b.month);
      console.log('Final Results:', results);

      return res.status(200).json({
        message: 'Appointment data for the last X months fetched successfully',
        data: results,
      });
    } catch (error) {
      console.error('Error in AppointmentGraphOnMonthBase:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching data.',
        error: error.message,
      });
    }
  },
  WaitingRoomOverView: async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      const currentDate = new Date().toISOString().split('T')[0];
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
              $sum: { $cond: [{ $not: { $eq: ['$isCanceled', 2] } }, 1, 0] },
            },
            successful: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 5] }, 1, 0] },
            },
            canceled: {
              $sum: { $cond: [{ $in: ['$isCanceled', [2, 3]] }, 1, 0] },
            },
            checkedIn: {
              $sum: { $cond: [{ $eq: ['$isCanceled', 4] }, 1, 0] },
            },
          },
        },
      ]);

      const availableDoctorsCount = await AddDoctors.countDocuments({
        bussinessId: userId,
        isAvailable: '1',
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

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in WaitingRoomOverView:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  WaittingRoomOverViewPatientInQueue: async (req, res) => {
    try {
      const { userId, offset = 0, limit = 10 } = req.query;
      console.log(req.query);

      const parsedOffset = parseInt(offset);
      const parsedLimit = parseInt(limit);
      const currentDate = new Date().toISOString().split('T')[0];

      const response = await webAppointments.aggregate([
        {
          $match: {
            hospitalId: userId,
            appointmentDate: currentDate,
          },
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        {
          $unwind: {
            path: '$doctorInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: { appointmentDate: 1 }, // Sort by appointment date (optional)
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
                format: '%d %b %Y',
                date: { $toDate: '$appointmentDate' },
              },
            },
            appointmentTime: 1,
            appointmentStatus: 1,
            department: '$departmentInfo.departmentName',
            veterinarian: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
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
        return res
          .status(404)
          .json({ message: 'No slots found for the doctor.' });
      }

      console.log(response, totalAppointments);
      return res.status(200).json({
        message: 'Data fetched successfully',
        totalAppointments,
        Appointments: response,
      });
    } catch (error) {
      console.error('Error in getAppointmentsForDoctorDashboard:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching slots.',
        error: error.message,
      });
    }
  },
  getDepartmentDataForHospitalProfile: async (req, res) => {
    try {
      const { userId } = req.query;

      // Fetch profile data
      const profileData = await ProfileData.findOne(
        { userId },
        {
          _id: 0,
          'address.addressLine1': 1,
          'address.city': 1,
          'address.street': 1,
          'address.state': 1,
          'address.zipCode': 1,
          'address.email': 1,
          phoneNumber: 1,
          businessName: 1,
          logo: 1,
          website: 1,
          selectedServices: 1,
        }
      );

      if (profileData?.logo) {
        profileData.logo = s3.getSignedUrl('getObject', {
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
            from: 'adddoctors',
            let: { deptId: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$professionalBackground.specialization', '$$deptId'],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  fullName: {
                    $concat: [
                      { $ifNull: ['$personalInfo.firstName', ''] },
                      ' ',
                      { $ifNull: ['$personalInfo.lastName', ''] },
                    ],
                  },
                },
              },
            ],
            as: 'doctors',
          },
        },
        {
          $addFields: {
            doctorCount: { $size: '$doctors' },
            doctorNames: '$doctors.fullName',
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

      console.log('Response:', departmentData, 'Profile Data:', profileData);

      res.status(200).json({
        profile: profileData,
        departments: departmentData,
      });
    } catch (error) {
      console.error('Error getting department data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  saveVisibility: async (req, res) => {
    try {
      const { facilitys, selectedServices, selectedDepartments, images } =
        req.body;
      const { userId } = req.query;
      console.log('req.body;', req.body);
      // Delete the old data for the given hospitalId (or another identifier)
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
      console.error('Error saving visibility:', error);
      res.status(400).json({ message: error.message });
    }
  },

  getVisibility: async (req, res) => {
    try {
      const { userId } = req.query;
      const visibilityData = await ProfileVisibility.findOne({
        hospitalId: userId,
      });

      if (visibilityData) {
        res.status(200).json(visibilityData);
      }
    } catch (error) {
      console.error('Error getting visibility:', error);
    }
  },

  getConfirmedAppointments: async (req, res) => {
    try {
      const { userId, page = 1, limit = 8 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      console.log(pageNumber, limitNumber, skip, userId);

      const daysMap = {
        1: 'Sunday',
        2: 'Monday',
        3: 'Tuesday',
        4: 'Wednesday',
        5: 'Thursday',
        6: 'Friday',
        7: 'Saturday',
      };

      // Get total count of confirmed appointments
      const totalCount = await webAppointments.countDocuments({
        $or: [{ veterinarian: userId }, { hospitalId: userId }],
        isCanceled: 1,
      });

      const confirmedAppointments = await webAppointments.aggregate([
        {
          $match: {
            $or: [{ veterinarian: userId }, { hospitalId: userId }],
            isCanceled: 1,
          },
        }, // Only confirmed appointments
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
            parsedAppointmentDate: {
              $dateFromString: { dateString: '$appointmentDate' },
            },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            dayOfWeek: { $dayOfWeek: '$parsedAppointmentDate' },
            formattedDate: {
              $dateToString: {
                format: '%d %b',
                date: '$parsedAppointmentDate',
                timezone: 'UTC',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            hospitalId: 1,
            appointmentDate: '$formattedDate',
            appointmentDay: '$dayOfWeek',
            appointmentTime: 1,
            ownerName: 1,
            petName: 1,
            department: '$departmentInfo.departmentName',
            veterinarian: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
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

      res.status(200).json({
        status: 'Confirmed',
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        totalCount,
        hasMore: pageNumber < totalPages,
        appointments: formattedAppointments,
      });
    } catch (error) {
      console.error('Error getting confirmed appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  getCompletedAppointments: async (req, res) => {
    try {
      const { userId, page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const daysMap = {
        1: 'Sunday',
        2: 'Monday',
        3: 'Tuesday',
        4: 'Wednesday',
        5: 'Thursday',
        6: 'Friday',
        7: 'Saturday',
      };
      const totalCount = await webAppointments.countDocuments({
        $or: [{ veterinarian: userId }, { hospitalId: userId }],
        isCanceled: 5,
      });
      const confirmedAppointments = await webAppointments.aggregate([
        {
          $match: {
            $or: [{ veterinarian: userId }, { hospitalId: userId }],
            isCanceled: 5,
          },
        }, // Only confirmed appointments
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
            parsedAppointmentDate: {
              $dateFromString: { dateString: '$appointmentDate' },
            },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            dayOfWeek: { $dayOfWeek: '$parsedAppointmentDate' },
            formattedDate: {
              $dateToString: {
                format: '%d %b',
                date: '$parsedAppointmentDate',
                timezone: 'UTC',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            hospitalId: 1,
            appointmentDate: '$formattedDate',
            appointmentDay: '$dayOfWeek',
            appointmentTime: 1,
            ownerName: 1,
            petName: 1,
            department: '$departmentInfo.departmentName',
            veterinarian: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
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

      res.status(200).json({
        status: 'Confirmed',
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        totalCount,
        hasMore: pageNumber < totalPages,
        appointments: formattedAppointments,
      });
    } catch (error) {
      console.error('Error getting completed appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  getCanceledAppointments: async (req, res) => {
    try {
      const { userId, page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const daysMap = {
        1: 'Sunday',
        2: 'Monday',
        3: 'Tuesday',
        4: 'Wednesday',
        5: 'Thursday',
        6: 'Friday',
        7: 'Saturday',
      };
      const totalCount = await webAppointments.countDocuments({
        $or: [{ veterinarian: userId }, { hospitalId: userId }],
        isCanceled: 2,
      });
      const confirmedAppointments = await webAppointments.aggregate([
        {
          $match: {
            $or: [{ veterinarian: userId }, { hospitalId: userId }],
            isCanceled: 2,
          },
        }, // Only confirmed appointments
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
            parsedAppointmentDate: {
              $dateFromString: { dateString: '$appointmentDate' },
            },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            dayOfWeek: { $dayOfWeek: '$parsedAppointmentDate' },
            formattedDate: {
              $dateToString: {
                format: '%d %b',
                date: '$parsedAppointmentDate',
                timezone: 'UTC',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            hospitalId: 1,
            appointmentDate: '$formattedDate',
            appointmentDay: '$dayOfWeek',
            appointmentTime: 1,
            ownerName: 1,
            petName: 1,
            department: '$departmentInfo.departmentName',
            veterinarian: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
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

      res.status(200).json({
        status: 'Confirmed',
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        totalCount,
        hasMore: pageNumber < totalPages,
        appointments: formattedAppointments,
      });
    } catch (error) {
      console.error('Error getting completed appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  getUpcomingAppointments: async (req, res) => {
    try {
      const { userId, page = 1, limit = 10 } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const daysMap = {
        1: 'Sunday',
        2: 'Monday',
        3: 'Tuesday',
        4: 'Wednesday',
        5: 'Thursday',
        6: 'Friday',
        7: 'Saturday',
      };
      const totalCount = await webAppointments.countDocuments({
        $or: [{ veterinarian: userId }, { hospitalId: userId }],
        isCanceled: 0,
      });
      const confirmedAppointments = await webAppointments.aggregate([
        {
          $match: {
            $or: [{ veterinarian: userId }, { hospitalId: userId }],
            isCanceled: 0,
          },
        }, // Only confirmed appointments
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
            parsedAppointmentDate: {
              $dateFromString: { dateString: '$appointmentDate' },
            },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        { $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true } },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            dayOfWeek: { $dayOfWeek: '$parsedAppointmentDate' },
            formattedDate: {
              $dateToString: {
                format: '%d %b',
                date: '$parsedAppointmentDate',
                timezone: 'UTC',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            hospitalId: 1,
            appointmentDate: '$formattedDate',
            appointmentDay: '$dayOfWeek',
            appointmentTime: 1,
            ownerName: 1,
            petName: 1,
            department: '$departmentInfo.departmentName',
            veterinarian: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
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

      res.status(200).json({
        status: 'Confirmed',
        page: pageNumber,
        limit: limitNumber,
        totalPages,
        totalCount,
        hasMore: pageNumber < totalPages,
        appointments: formattedAppointments,
      });
    } catch (error) {
      console.error('Error getting completed appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getDoctorsTotalAppointments: async (req, res) => {
    try {
      const { userId, LastDays, search, page = 1, limit = 10 } = req.query;
      const days = parseInt(LastDays, 10) || 7;
      const pageNumber = parseInt(page, 10);
      const pageSize = parseInt(limit, 10);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      console.log('Hospital ID:', userId, search);

      // Base pipeline (without pagination)
      const basePipeline = [
        {
          $match: {
            hospitalId: userId,
            createdAt: { $gte: startDate, $lte: endDate },
            isCanceled: 5,
          },
        },
        {
          $group: {
            _id: '$veterinarian',
            department: { $first: '$department' },
            totalAppointments: { $sum: 1 },
          },
        },
        { $addFields: { departmentId: { $toObjectId: '$department' } } },
        {
          $lookup: {
            from: 'adddoctors',
            localField: '_id',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        { $unwind: '$doctorInfo' },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        { $unwind: '$departmentInfo' },
      ];

      // Search filter
      if (search) {
        basePipeline.push({
          $match: {
            $or: [
              {
                'doctorInfo.personalInfo.firstName': {
                  $regex: search,
                  $options: 'i',
                },
              },
              {
                'doctorInfo.personalInfo.lastName': {
                  $regex: search,
                  $options: 'i',
                },
              },
            ],
          },
        });
      }

      // Count total documents
      const countPipeline = [...basePipeline, { $count: 'totalCount' }];
      const totalDocs = await webAppointments.aggregate(countPipeline);
      const totalCount = totalDocs.length > 0 ? totalDocs[0].totalCount : 0;

      // Apply sorting and pagination
      const paginationPipeline = [
        { $sort: { 'doctorInfo.personalInfo.firstName': 1 } },
        { $skip: (pageNumber - 1) * pageSize },
        { $limit: pageSize },
        {
          $project: {
            _id: 0,
            doctorId: '$_id',
            doctorName: {
              $concat: [
                '$doctorInfo.personalInfo.firstName',
                ' ',
                '$doctorInfo.personalInfo.lastName',
              ],
            },
            image: { $concat: [S3_BASE_URL, '$doctorInfo.personalInfo.image'] },
            department: '$departmentInfo.departmentName',
            totalAppointments: 1,
          },
        },
      ];

      // Execute paginated query
      const totalAppointments = await webAppointments.aggregate([
        ...basePipeline,
        ...paginationPipeline,
      ]);

      // Return paginated response
      res.status(200).json({
        totalAppointments,
        page: pageNumber,
        totalPages: Math.ceil(totalCount / pageSize),
        totalCount,
      });
    } catch (error) {
      console.error('Error getting total appointments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  hospitalDashboard: async (req, res) => {
    try {
      const { userId, LastDays = 7 } = req.query;
      const days = parseInt(LastDays, 10) || 7;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      // Convert to "YYYY-MM-DD" format
      const formatDate = (date) => date.toISOString().split('T')[0];

      const formattedStartDate = formatDate(startDate);
      const formattedEndDate = formatDate(endDate);
      console.log('Hospital ID:', userId, formattedStartDate, formattedEndDate);

      const appointmentCounts = await webAppointments.countDocuments({
        hospitalId: userId,
        isCanceled: 5,
        appointmentDate: { $gte: formattedStartDate, $lte: formattedEndDate }, // Compare strings
      });

      const totalDoctors = await AddDoctors.countDocuments({
        bussinessId: userId,
      });
      const totalDepartments = await Department.countDocuments({
        bussinessId: userId,
      });
      res.status(200).json({
        totalDoctors,
        totalDepartments,
        appointmentCounts,
      });
    } catch (error) {
      console.error('Error getting hospital dashboard data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
  getAppointmentsForHospitalDashboard: async (req, res) => {
    try {
      const { hospitalId, offset = 0, limit = 5 } = req.query;
      console.log(req.query);

      const parsedOffset = parseInt(offset, 10);
      const parsedLimit = parseInt(limit, 10);

      const response = await webAppointments.aggregate([
        {
          $match: {
            hospitalId: hospitalId, // Filter by hospital ID
            isCanceled: { $eq: 0 }, // Exclude canceled appointments
          },
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: '$department' },
          },
        },
        {
          $lookup: {
            from: 'adddoctors',
            localField: 'veterinarian',
            foreignField: 'userId',
            as: 'doctorInfo',
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentObjId',
            foreignField: '_id',
            as: 'departmentInfo',
          },
        },
        {
          $unwind: {
            path: '$doctorInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: '$departmentInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: parsedOffset }, { $limit: parsedLimit }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ['$metadata.total', 0] },
            Appointments: {
              $map: {
                input: '$data',
                as: 'appointment',
                in: {
                  _id: '$$appointment._id',
                  tokenNumber: '$$appointment.tokenNumber',
                  petName: '$$appointment.petName',
                  ownerName: '$$appointment.ownerName',
                  slotsId: '$$appointment.slotsId',
                  petType: '$$appointment.petType',
                  breed: '$$appointment.breed',
                  purposeOfVisit: '$$appointment.purposeOfVisit',
                  appointmentDate: {
                    $dateToString: {
                      format: '%d %b %Y',
                      date: { $toDate: '$$appointment.appointmentDate' },
                    },
                  },
                  appointmentTime: '$$appointment.appointmentTime',
                  appointmentStatus: '$$appointment.appointmentStatus',
                  department: '$$appointment.departmentInfo.departmentName',
                  veterinarian: {
                    $concat: [
                      '$$appointment.doctorInfo.personalInfo.firstName',
                      ' ',
                      '$$appointment.doctorInfo.personalInfo.lastName',
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      if (!response.length || !response[0].Appointments.length) {
        return res
          .status(404)
          .json({ message: 'No slots found for the hospital.' });
      }

      return res.status(200).json({
        message: 'Data fetched successfully',
        totalAppointments: response[0].total || 0,
        Appointments: response[0].Appointments,
      });
    } catch (error) {
      console.error('Error in getAppointmentsForHospitalDashboard:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching slots.',
        error: error.message,
      });
    }
  },

  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Message>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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
                if: { $ne: ['$fileUrl', ''] },
                then: { $concat: [S3_BASE_URL, '$fileUrl'] },
                else: '',
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
      console.error('Error in getMessages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = HospitalController;
