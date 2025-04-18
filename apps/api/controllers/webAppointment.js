// const { json } = require('body-parser');
const DoctorsTimeSlotes = require('../models/DoctorsSlotes');
const {
  AppointmentsToken,
  webAppointments,
} = require('../models/WebAppointment');
const {FHIRToNormalConverter} = require('../utils/WebAppointmentHandler');
const FHIRSlotConverter = require('../utils/FhirSlotConverter');

const webAppointmentController = {
  createWebAppointment: async (req, res) => {
    try {
      // Log FHIR request to debug incoming data
      console.log('Raw FHIR Data:', JSON.stringify(req.body, null, 2));

      // Instantiate the FHIRToNormalConverter
      const fhirConverter = new FHIRToNormalConverter(req.body);

      // Convert FHIR to normal data
      const normalData = fhirConverter.convertToNormal();
      console.log('Converted Data:', normalData);

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
      } = normalData;

      if (!hospitalId || !HospitalName || !ownerName || !appointmentDate) {
        console.error('Missing required fields.');
        return res
          .status(400)
          .json({ message: 'Required fields are missing.' });
      }

      const initials = HospitalName
        ? HospitalName.split(' ')
            .map((word) => word[0])
            .join('')
        : 'XX';

      let Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
        { hospitalId, appointmentDate },
        { $inc: { tokenCounts: 1 } },
        { new: true, upsert: true }
      );

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
        appointmentTime: timeSlots?.[0]?.time || '',
        day,
        appointmentTime24: timeSlots?.[0]?.time24 || '',
        slotsId: timeSlots?.[0]?._id || '',
      });

      if (response) {
        return res.status(200).json({
          resourceType: 'OperationOutcome',
          status: 'success',
          issue: [
            {
              severity: 'information',
              code: 'informational',
              details: {
                text: 'Appointment created successfully',
              },
            },
          ],
          data: response,
        });
      }

      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'bad',
            details: { text: 'Appointment creation failed' },
          },
        ],
      });
    } catch (error) {
      console.error('Error in createWebAppointment:', error);
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'exception',
            details: {
              text: 'Internal server error while creating appointment.',
            },
            diagnostics: error.message, // Include actual error message
          },
        ],
      });
    }
  },

  getDoctorsSlotes: async (req, res) => {
    try {
      const { doctorId, day, date } = req.query;
     
    console.log("hihhijiihihihii", doctorId, day, date);
    if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctorId format' });
    }
    
    // Validate day (valid weekday name)
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (typeof day !== 'string' || !validDays.includes(day)) {
      return res.status(400).json({ message: 'Invalid day value' });
    }
    
    // Validate date (YYYY-MM-DD)
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD' });
    }

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
        console.log("bookedSlotIds", updatedTimeSlots) 
        const fhirConverter = await new FHIRSlotConverter(
          updatedTimeSlots,
          doctorId,
          null,
          date
        );
        const fhirBundle = fhirConverter.convertToFHIRBundle();

        // 🎉 Output the converted FHIR bundle
        console.log('hellooooo', JSON.stringify(fhirBundle, null, 2));
        return res.status(200).json({
          message: 'Data fetched successfully',
          timeSlots: fhirBundle,
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
