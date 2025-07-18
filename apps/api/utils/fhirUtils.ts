import { AppointmentDocument } from '@yosemite-crew/types';
import  moment  from 'moment-timezone';

function createFHIRSlot(slot: unknown, doctorId:string, bookedAppointments:AppointmentDocument[]): Record<string, unknown> {
    const isBooked = bookedAppointments.some(app => app.slotsId?.toString() === slot._id?.toString());
    
    return {
      resourceType: "Slot",
      id: slot._id.toString(),
      schedule: {
        reference: `Schedule/${doctorId}`
      },
      isBooked: isBooked ? "true" : "false",
      slotTime: slot.time,
      start: moment.tz(`${slot.date} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"], "Asia/Kolkata").toISOString(),
    };
}

export  { createFHIRSlot };
