const appointment = require('../models/appointment');
const DoctorsTimeSlotes = require('../models/DoctorsSlotes');
const webAppointment = require("../models/WebAppointment");
const jwt = require('jsonwebtoken')


async function handleAddAppointment(req, res) {
    var fileName = "";
    const { day, month, userId, hospitalId, departmentId, doctorId, time, message,appointmentDate } = req.body;
    
  
    const document = req.file;
    if (document) fileName = document.filename;
  
    const addappointment = await appointment.create({
      userId,
      hospitalId,
      departmentId,
      doctorId,
      dayFor: day,
      timeFor: time,
      monthFor: month,
      appointmentDate: appointmentDate,
      message,
      document: fileName,
    });
  
    if (addappointment) {
      res.status(201).json({
        message: "Appointment Booked successfully",
        appointment: {
          id: addappointment.id,
        }
      });
    }
  }

async function handleGetAppointment(req, res) {
    try {
      const { userId } = req.body;
      const startOfToday = new Date().toISOString().split("T")[0]; 
      const [allAppointments, confirmedAppointments, upcomingAppointments, pastAppointments] = await Promise.all([
        appointment.find({ userId }),
        appointment.find({ userId, appointmentStatus: 1 }),
        appointment.find({ userId, appointmentDate: { $gt: startOfToday } }),
        appointment.find({ userId, appointmentDate: { $lt: startOfToday } })
      ]);
  
      if (allAppointments.length === 0) {
        return res.status(404).json({ message: "No appointments found for this user" });
      }
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
    const appointDate = req.body.appointmentdate;
    const doctorId = req.body.doctorId;

    const dateObj = new Date(appointDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[dateObj.getDay()];

    const slots = await DoctorsTimeSlotes.find({ doctorId, day });
   
    const timeSlots = slots[0].timeSlots;

    if (slots.length === 0) {
      return res.status(200).json({ status: 0, data: [], message: "No slots found for this doctor on this day" });
    }
    const bookedappointments = await webAppointment.find({veterinarian:doctorId, appointmentDate:appointDate });
    if (bookedappointments.length === 0) {
      return res.status(200).json({ status: 0, data: [], message: "no appointments for this date" });
    }

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
    const reschdule = await webAppointment.updateMany({id,$set: { appointmentDate,appointmentTime,appointmentTime24,slotsId,day } });
    if(!reschdule){
      return res.status(200).json({ status: 0, message:"error while Rescheduling Appointment" });
    }else{
      const appointmentupdatedRecord = await webAppointment.findById(id);
      return res.status(200).json({ status: 1, data:appointmentupdatedRecord}); 
    }
  } else {
    return res.status(200).json({ status: 0, message:"This time slot is not available" });
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
};


module.exports = {
    handleAddAppointment,
    handleGetAppointment,
    handleCancelAppointment,
    handleGetTimeSlots,
    handleRescheduleAppointment,
}
