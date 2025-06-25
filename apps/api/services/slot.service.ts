import moment from 'moment-timezone';
import DoctorsTimeSlots from '../models/doctors.slotes.model';
import { webAppointments } from "../models/WebAppointment";
import { createFHIRSlot } from '../utils/fhirUtils';
import {
  GetTimeSlotsInput,
  FHIRSlotBundle,
  AppointmentDocument,
  DoctorSlotDocument,
  TimeSlot
} from "@yosemite-crew/types";

const SlotService = {
  getAvailableTimeSlots: async ({ appointmentDate, doctorId }: GetTimeSlotsInput): Promise<FHIRSlotBundle | { issue: any[] } | { status: number; message: string }> => {
    const dateObj = moment.tz(appointmentDate, "YYYY-MM-DD", "Asia/Kolkata");

    if (!dateObj.isValid()) {
      return {
        issue: [{
          severity: "error",
          code: "invalid",
          details: { text: "Invalid appointment date" }
        }]
      };
    }

    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = dateObj.day();
    const day = validDays[dayIndex];

    if (dayIndex < 0 || dayIndex > 6) {
      throw new Error("Invalid day extracted from appointment date");
    }

    const isToday = moment().tz("Asia/Kolkata").format('YYYY-MM-DD') === dateObj.format('YYYY-MM-DD');
    const currentTime = moment().tz("Asia/Kolkata");

    const slotsData: DoctorSlotDocument[] = await DoctorsTimeSlots.find({ doctorId, day });

    if (!slotsData.length) {
      return { resourceType: "Bundle", type: "collection", entry: [] };
    }

    const timeSlots: TimeSlot[] = slotsData[0].timeSlots;
    if (!Array.isArray(timeSlots)) {
      return {
        issue: [{
          severity: "error",
          code: "processing",
          details: { text: "Time slots data is not in the expected format" }
        }]
      };
    }

    if (typeof doctorId !== 'string' || doctorId.trim() === '') {
      return { status: 0, message: 'Invalid doctor ID' };
    }

    const normalizedDate = dateObj.format("YYYY-MM-DD");

    if (!moment(normalizedDate, "YYYY-MM-DD", true).isValid()) {
      return { status: 0, message: 'Invalid appointment date' };
    }

    const bookedAppointments: AppointmentDocument[] = await webAppointments.find({
      veterinarian: doctorId,
      appointmentDate: normalizedDate
    });

    const availableSlots = timeSlots
      .filter(slot => {
        if (!slot.time) return false;
        if (isToday) {
          const slotDateTime = moment.tz(`${appointmentDate} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"], "Asia/Kolkata");
          return slotDateTime.isAfter(currentTime);
        }
        return true;
      })
      .map(slot => {
        const slotDateTime = moment.tz(`${appointmentDate} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"], "Asia/Kolkata");
        const slotObj = createFHIRSlot(slot, doctorId, bookedAppointments);
        slotObj.start = slotDateTime.toISOString();
        return slotObj;
      });

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: availableSlots.map(resource => ({ resource }))
    };
  }
};

export default SlotService;
