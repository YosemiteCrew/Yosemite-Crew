const webAppointments = require('../models/WebAppointment');
const Department = require('../models/AddDepartment');
const AddDoctors = require('../models/addDoctor');

const HospitalController = {
  getAllAppointments: async (req, res) => {
    try {
      const { offset = 0, limit = 5 } = req.query;
      console.log(req.query);

      const parsedOffset = parseInt(offset, 10);
      const parsedLimit = parseInt(limit, 10);

      const response = await webAppointments.aggregate([
        {
          $match: {
            isCanceled: { $ne: 2 },
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
      const { LastDays } = req.query;
      const days = parseInt(LastDays, 10) || 7; // Default to 7 days if not provided

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1)); // FIXED PARENTHESIS

      console.log('startDate', startDate, 'endDate', endDate);
      const today = new Date().toISOString().split('T')[0];

      const appointments = await webAppointments.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
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
                $cond: [{ $gt: ['$appointmentDate', today] }, 1, 0],
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
      const { LastDays } = req.query;
      const days = parseInt(LastDays, 10) || 7;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      console.log('Fetching data from:', startDate, 'to', endDate);

      const countAggregation = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
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
          // Pets.aggregate(countAggregation), // Uncommented to include pets count
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
      const { LastDays } = req.query;
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
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const weeklyAppointments = await webAppointments.aggregate([
        {
          $match: {
            appointmentDate: { $gte: sevenDaysAgo.toISOString().split('T')[0] },
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
      const { days } = req.query;
      const Month = parseInt(days, 10) || 6;
      // console.log("Months", days);
      const endMonth = new Date();
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setMonth(endMonth.getMonth() - (Month - 1));

      const gt = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const lt = new Date(endMonth.getFullYear(), endMonth.getMonth() + 2, 1)
        .toISOString()
        .split('T')[0];
      console.log('Fetching data from:', gt, 'to', lt);
      const aggregatedAppointments = await webAppointments.aggregate([
        {
          $match: {
            appointmentDate: {
              $gte: gt,
              $lt: lt,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { $toDate: '$appointmentDate' } },
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
            monthName: {
              $arrayElemAt: [monthNames, { $subtract: ['$_id.month', 1] }],
            },
            totalAppointments: 1,
            successful: 1,
            canceled: 1,
          },
        },
      ]);

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
      console.log('results', results);
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
};

module.exports = HospitalController;
