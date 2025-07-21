import { AppointmentDocument, TimeSlot } from '@yosemite-crew/types';
import  moment  from 'moment-timezone';

interface FHIRSlot{
    resourceType: string,
      id: string,
      schedule: {
        reference: string,
      },
      isBooked: boolean | string,
      slotTime: string,
      start:string,
}
function createFHIRSlot(slot: TimeSlot, doctorId:string, bookedAppointments:AppointmentDocument[]): Partial<FHIRSlot> {
    const isBooked = bookedAppointments.some(app => app.slotsId?.toString() === slot._id?.toString());
    
    return {
      resourceType: "Slot",
      id: slot._id.toString(),
      schedule: {
        reference: `Schedule/${doctorId}`
      },
      isBooked: isBooked ? "true" : "false",
      slotTime: slot.time,
      start: moment.parseZone(`${slot.time} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"], "Asia/Kolkata").toISOString(),
    };
}

export  { createFHIRSlot };
