const moment = require('moment-timezone');
const DoctorsTimeSlotes  = require('../models/DoctorsSlotes');
const { webAppointments } = require("../models/WebAppointment");
const { createFHIRSlot } = require('../utils/fhirUtils');


class SlotService {
 static async getAvailableTimeSlots({ appointmentDate, doctorId }) {
  const dateObj = moment.tz(appointmentDate, "YYYY-MM-DD", "Asia/Kolkata").toDate();
  if (isNaN(dateObj.getTime())) {
    return {
      issue: [{
        severity: "error",
        code: "invalid",
        details: { text: "Invalid appointment date" }
      }]
    };
  }

  const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = validDays[dateObj.getDay()];

  if (!validDays.includes(day)) {
    throw new Error("Invalid day");
  }

  const isToday = moment().tz("Asia/Kolkata").format('YYYY-MM-DD') === moment(dateObj).tz("Asia/Kolkata").format('YYYY-MM-DD');
  const currentTime = moment().tz("Asia/Kolkata");

  const slotsData = await DoctorsTimeSlotes.find({ doctorId, day });
  if (!slotsData.length) {
    return { resourceType: "Bundle", type: "collection", entry: [] };
  }

  const timeSlots = slotsData[0].timeSlots;
  if (!Array.isArray(timeSlots)) {
    return {
      issue: [{
        severity: "error",
        code: "processing",
        details: { text: "Time slots data is not in the expected format" }
      }]
    };
  }

  const bookedAppointments = await webAppointments.find({ veterinarian: doctorId, appointmentDate });

  const availableSlots = timeSlots
    .filter(slot => {
      if (!slot.time) return false;
      if (isToday) {
        const slotDateTime = moment.tz(`${appointmentDate} ${slot.time}`, "YYYY-MM-DD hh:mm A", "Asia/Kolkata");
        return slotDateTime.isAfter(currentTime);
      }
      return true;
    })
    .map(slot => {
      const slotDateTime = moment.tz(`${appointmentDate} ${slot.time}`, "YYYY-MM-DD hh:mm A", "Asia/Kolkata");
      const slotObj = createFHIRSlot(slot, doctorId, bookedAppointments);
      slotObj.start = slotDateTime.toISOString(); // ensure it's in ISO format
      return slotObj;
    });

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: availableSlots.map(resource => ({ resource }))
  };
}
}

module.exports = SlotService;
