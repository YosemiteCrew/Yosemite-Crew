const appointment = require('../models/appointment');
const DoctorsTimeSlotes = require('../models/DoctorsSlotes');
const webAppointment = require("../models/WebAppointment");
const pet = require("../models/YoshPet");
const YoshUser = require("../models/YoshUser");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const {  handleMultipleFileUpload } = require('../middlewares/upload');



async function handleBookAppointment(req, res) {
    
    const token = req.headers.authorization.split(' ')[1]; // Extract token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    const userId = decoded.username; // Get user ID from token
    const appointDate = req.body.appointmentDate;
    const purposeOfVisit = req.body.purposeOfVisit;
    const dateObj = new Date(appointDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayofweek = days[dateObj.getDay()];
    const appointmentTime = req.body.timeslot;
    const appointmentTime24 = convertTo24Hour(appointmentTime);
    let imageUrls = '';
    const { hospitalId,department,doctorId,petId, slotsId,concernOfVisit } = req.body;
      if (req.files) {
        const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
         imageUrls = await handleMultipleFileUpload(files);
      }
      const id = petId;
     const petDetails =  await pet.findById(id);
     const petOwner =  await YoshUser.find({cognitoId: userId});
     
    const addappointment = await webAppointment.create({
      userId,
      hospitalId,
      department,
      veterinarian: doctorId,
      petId,
      ownerName: petOwner[0].firstName + ' ' + petOwner[0].lastName,
      petName: petDetails.petName,
      petAge: petDetails.petAge,
      petType: petDetails.petType,
      gender: petDetails.petGender,
      breed: petDetails.petBreed,
      day: dayofweek,
      appointmentDate: appointDate,
      slotsId,
      appointmentTime,
      appointmentTime24,
      purposeOfVisit,
      concernOfVisit,
      appointmentSource: "App",
      document: imageUrls,
    });
  
    if (addappointment) {
      res.status(200).json({
        status: 1,
        message: "Appointment Booked successfully",
      });
    }
  }

async function handleGetAppointment(req, res) {
    try {
      const token = req.headers.authorization.split(' ')[1]; // Extract token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
      const cognitoUserId = decoded.username; // Get user ID from token
      const startOfToday = new Date().toISOString().split("T")[0]; 
      const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).toISOString().split("T")[0]; 
      
      const [allAppointments, confirmedAppointments, upcomingAppointments, pastAppointments, todayAppointments] = await Promise.all([
        webAppointment.find({ userId: cognitoUserId }),
        webAppointment.find({ userId: cognitoUserId, appointmentStatus: 1 }),
        webAppointment.find({ userId: cognitoUserId, appointmentDate: { $gte: startOfToday, $lte: endOfToday }, appointmentStatus: 0 }), // Include today
        webAppointment.find({ userId: cognitoUserId, appointmentDate: { $lt: startOfToday }, appointmentStatus: 0 }),
        webAppointment.find({ userId: cognitoUserId, appointmentDate: startOfToday, appointmentStatus: 0 }) // Explicit today filter
      ]);
      res.json({
        allAppointments,
        confirmedAppointments,
        upcomingAppointments,
        pastAppointments
      });
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "An error occurred while retrieving appointments" });
    }
  }


async function handleCancelAppointment(req,res) {
    try {
        const updatedAppointmentData = req.body;
        const id = updatedAppointmentData.appointmentId;
        updatedAppointmentData.appointmentStatus = 2;
        const cancelappointmentData = await appointment.findByIdAndUpdate(id,updatedAppointmentData, { new: true });
        if (!cancelappointmentData) {
            return res.status(404).json({ message: "This appointment not found" });
          }
          res.json(cancelappointmentData);
        } catch (error) {
          res.status(500).json({ message: "Error while cancelling appointment", error });
        }   
}

async function handleGetTimeSlots(req, res) {
  try {
    const appointDate = req.body.appointmentDate;
    const doctorId = req.body.doctorId;

    const dateObj = new Date(appointDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[dateObj.getDay()];

    const slots = await DoctorsTimeSlotes.find({ doctorId, day });
   
    const timeSlots = slots[0].timeSlots;
    console.log(timeSlots)

    if (slots.length === 0) {
      return res.status(200).json({ status: 0, data: [], message: "No slots found for this doctor on this day" });
    }
    const bookedappointments = await webAppointment.find({veterinarian:doctorId, appointmentDate:appointDate });
    const updatedSlots = timeSlots.map(slot => ({
      slot,
      booked: bookedappointments.some(app => app.slotsId === slot._id.toString()) // Convert ObjectId to string for comparison
    }));
    return res.status(200).json({ status: 1, data:updatedSlots });
  } catch (error) {
    res.status(500).json({ message: "Error while fetching time slots", error });
  }
}

async function handleRescheduleAppointment(req, res){
  const AppointmentData = req.body;
  const id = AppointmentData.appointmentId;
  const appointmentDated = AppointmentData.appointmentDate;
  const appointmentRecord = await webAppointment.findById(id);
  if(!appointmentRecord){
    return res.status(200).json({ status: 0, message: "appointment not found" });
  }
  const veterinarian = appointmentRecord.veterinarian;
  const dateObj = new Date(appointmentDated);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const appointmentday = days[dateObj.getDay()];
  const doctorslot = await DoctorsTimeSlotes.find({doctorId:veterinarian, day:appointmentday });
  const timeslotArray = doctorslot[0].timeSlots;
  const targetTime =  AppointmentData.timeslot

  const matchingSlot = timeslotArray.find(slot => slot.time === targetTime);
  
  if (matchingSlot) {
    const appointmentDate = appointmentDated;
    const appointmentTime = targetTime;
    const appointmentTime24 =  convertTo24Hour(targetTime); 
    const slotsId = matchingSlot.id;
    const day = appointmentday;
    const reschedule = await webAppointment.findByIdAndUpdate(
      id,
      {
        $set: { appointmentDate, appointmentTime, appointmentTime24, slotsId, day }
      },
      { new: true, runValidators: true }
    );
    
    if(!reschedule){
      return res.status(200).json({ status: 0, message:"error while Rescheduling Appointment" });
    }else{
      const appointmentupdatedRecord = await webAppointment.findById(id);
      return res.status(200).json({ status: 1, data:appointmentupdatedRecord}); 
    }
  } else {
    return res.status(200).json({ status: 0, message:"This time slot is not available" });
  }
}

async function handleTimeSlotsByMonth(req, res) {
  const doctorId = req.body.doctorId;
  const slotMonth = req.body.slotMonth;
  const slotYear = req.body.slotYear;

  try {
    // 1. Generate the calendar for the specified month and year
    const startDate = moment({ year: slotYear, month: slotMonth - 1, day: 1 });
    const endDate = startDate.clone().endOf('month');
    const calendar = [];
    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'day')) {
      calendar.push(date.clone());
    }

    // 2. Retrieve the weekly schedule for the doctor
    const weeklySchedule = await DoctorsTimeSlotes.find({ doctorId }).lean();

    // 3. Retrieve the booked appointments for the specified month and year
    const bookedAppointments = await webAppointment.find({
      veterinarian: doctorId,
      appointmentDate: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    }).lean();

    // 4. Extract the slotsId from the booked appointments
    const bookedSlotIds = bookedAppointments.map((appointment) => appointment.slotsId);

    // 5. Calculate available slots per date
    const calendarWithSlots = calendar.map((date) => {
      const dayOfWeek = date.format('dddd'); // e.g., 'Monday'
      const daySchedule = weeklySchedule.find((schedule) => schedule.day === dayOfWeek);

      if (!daySchedule) {
        // No schedule available for this day
        return {
          date: date.format('YYYY-MM-DD'),
          day: dayOfWeek,
          availableSlotsCount: 0,
        };
      }

      // Filter out the booked time slots
      const availableTimeSlots = daySchedule.timeSlots.filter(
        (slot) => !bookedSlotIds.includes(slot._id.toString())
      );

      return {
        date: date.format('YYYY-MM-DD'),
        day: dayOfWeek,
        availableSlotsCount: availableTimeSlots.length,
      };
    });

    return res.json(calendarWithSlots);
  } catch (error) {
    console.error('Error generating calendar with available slots:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}



const convertTo24Hour = (time12h) => {
  const [time, modifier] = time12h.split(' '); // Split into time and AM/PM
  let [hours, minutes] = time.split(':');

  if (modifier === 'PM' && hours !== '12') {
    hours = String(parseInt(hours, 10) + 12);
  } else if (modifier === 'AM' && hours === '12') {
    hours = '00';
  }

  return `${hours}:${minutes}`;
}


module.exports = {
    handleBookAppointment,
    handleGetAppointment,
    handleCancelAppointment,
    handleGetTimeSlots,
    handleRescheduleAppointment,
    handleTimeSlotsByMonth,
}
