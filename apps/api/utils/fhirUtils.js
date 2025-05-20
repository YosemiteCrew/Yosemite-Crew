const moment = require('moment-timezone');

function createFHIRSlot(slot, doctorId, bookedAppointments) {
    const isBooked = bookedAppointments.some(app => app.slotsId?.toString() === slot._id?.toString());
    
    return {
      resourceType: "Slot",
      id: slot._id.toString(),
      schedule: {
        reference: `Schedule/${doctorId}`
      },
      isBooked: isBooked ? "true" : "false",
      slotTime: slot.time,
      start: moment.tz(`${slot.date} ${slot.time}`, "YYYY-MM-DD hh:mm A", "Asia/Kolkata").toISOString(),
    };
}

module.exports = { createFHIRSlot };
