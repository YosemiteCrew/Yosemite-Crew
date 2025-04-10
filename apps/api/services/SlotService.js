const moment = require('moment');
const DoctorsTimeSlotes  = require('../models/DoctorsSlotes');
const { webAppointments } = require("../models/WebAppointment");
const { createFHIRSlot } = require('../utils/fhirUtils');

class SlotService {
  static async getAvailableTimeSlots({ appointmentDate, doctorId }) {
    const dateObj = new Date(appointmentDate);
    if (isNaN(dateObj.getTime())) {
      return {
        issue: [{
          severity: "error",
          code: "invalid",
          details: { text: "Invalid appointment date" }
        }]
      };
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[dateObj.getDay()];
    const isToday = new Date().toDateString() === dateObj.toDateString();
    const currentTime = new Date();

    const slotsData = await DoctorsTimeSlotes.find({ doctorId, day });
    console.log(doctorId, day)
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
          const slotDateTime = moment(`${appointmentDate} ${slot.time}`, "YYYY-MM-DD hh:mm A").toDate();
          return slotDateTime > currentTime;
        }
        return true;
      })
      .map(slot => createFHIRSlot(slot, doctorId, bookedAppointments));

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: availableSlots.map(resource => ({ resource }))
    };
  }
}

module.exports = SlotService;
