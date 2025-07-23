import moment from 'moment-timezone';

interface Slot {
  _id: string | { toString(): string };
  date: string; // Expected to be in YYYY-MM-DD
  time: string; // Expected to be in h:mm A or hh:mm A
}

interface Appointment {
  slotsId?: string | { toString(): string };
}

interface FHIRSlot {
  resourceType: "Slot";
  id: string;
  schedule: {
    reference: string;
  };
  isBooked: "true" | "false";
  slotTime: string;
  start: string;
}

export function createFHIRSlot(
  slot: Slot,
  doctorId: string,
  bookedAppointments: Appointment[]
): FHIRSlot {
  const isBooked = bookedAppointments.some(
    (app) => app.slotsId?.toString() === slot._id?.toString()
  );

  const dateTime = `${slot.date} ${slot.time}`;
const format: moment.MomentFormatSpecification = ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"];
const start = (moment.tz as (input: moment.MomentInput, format: moment.MomentFormatSpecification, timezone: string) => moment.Moment)(dateTime, format, "Asia/Kolkata").toISOString();

  return {
    resourceType: "Slot",
    id: slot._id.toString(),
    schedule: {
      reference: `Schedule/${doctorId}`,
    },
    isBooked: isBooked ? "true" : "false",
    slotTime: slot.time,
    start,
  };
}

