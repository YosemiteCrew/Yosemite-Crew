const DoctorsTimeSlotes = require('../models/DoctorsSlotes');
const {
  AppointmentsToken,
  webAppointments,
} = require('../models/WebAppointment');

const webAppointmentController = {
  createWebAppointment: async (req, res) => {
    try {
      const {
        hospitalId,
        HospitalName,
        ownerName,
        phone,
        addressline1,
        street,
        city,
        state,
        zipCode,
        petName,
        petAge,
        petType,
        gender,
        breed,
        purposeOfVisit,
        appointmentType,
        appointmentSource,
        department,
        veterinarian,
        appointmentDate,
        day,
        timeSlots,
      } = req.body;

      console.log('Received Request Body:', req.body);

      const initials = HospitalName.split(' ')
        .map((word) => word[0])
        .join('');

      let Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
        { hospitalId, appointmentDate },
        { $inc: { tokenCounts: 1 } },
        { new: true, upsert: true }
      );

      console.log('Token Record Found:', Appointmenttoken);

      const tokenNumber = `${initials}00${Appointmenttoken.tokenCounts}-${appointmentDate}`;
      console.log('Generated Token Number:', tokenNumber);

      const response = await webAppointments.create({
        hospitalId,
        tokenNumber,
        ownerName,
        phone,
        addressline1,
        street,
        city,
        state,
        zipCode,
        petName,
        petAge,
        petType,
        gender,
        breed,
        purposeOfVisit,
        appointmentType,
        appointmentSource,
        department,
        veterinarian,
        appointmentDate,
        appointmentTime: timeSlots[0].time,
        day,
        appointmentTime24: timeSlots[0].time24,
        slotsId: timeSlots[0]._id,
      });

      console.log('Web Appointment Created:', response);

      if (response) {
        return res.status(200).json({
          message: 'Appointment created successfully',
          data: response,
        });
      }

      console.log('Failed to create appointment');
      return res.status(400).json({ message: 'Failed to create Appointment' });
    } catch (error) {
      console.error('Error in createWebAppointment:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  getDoctorsSlotes: async (req, res) => {
    try {
      const { doctorId, day, date } = req.query;

      console.log('Fetching slots for:', { doctorId, day, date });

      const bookedSlots = await webAppointments.find({
        veterinarian: doctorId,
        appointmentDate: date,
      });
      console.log('bookedSlots', bookedSlots);

      const response = await DoctorsTimeSlotes.findOne({ doctorId, day });
      console.log('response', response);

      if (response) {
        const filterdData = response.timeSlots.filter(
          (v) => v.selected === true
        );

        console.log('filter', filterdData);
        const bookedSlotIds = bookedSlots.map((slot) => slot.slotsId);

        const updatedTimeSlots = filterdData.map((slot) => ({
          ...slot.toObject(),
          isBooked: bookedSlotIds.includes(slot._id.toString()),
        }));

        return res.status(200).json({
          message: 'Data fetched successfully',
          timeSlots: updatedTimeSlots,
        });
      } else {
        return res.status(200).json({
          message: 'Data fetch Failed',
          timeSlots: [],
        });
      }
    } catch (error) {
      console.error('Error in getDoctorsSlotes:', error);
      return res.status(500).json({
        message: 'An error occurred while fetching slots.',
        error: error.message,
      });
    }
  },
};

module.exports = webAppointmentController;
