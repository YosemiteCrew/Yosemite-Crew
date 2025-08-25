import moment from 'moment-timezone';
import { DoctorsTimeSlotes } from '../models/doctors.slotes.model';
import { webAppointments } from "../models/web-appointment";
import { createFHIRSlot } from '../utils/fhirUtils';
import {
  GetTimeSlotsInput,
  AppointmentDocument,
  DoctorSlotDocument,
  TimeSlot,
  FHIRSlotBundle
} from "@yosemite-crew/types";

const SlotService = {
  getAvailableTimeSlots: async ({ appointmentDate, doctorId }: GetTimeSlotsInput): Promise<FHIRSlotBundle> => {

    let dateObj: moment.Moment;
    if (moment && typeof moment.tz === 'function') {
      dateObj = (moment.tz as (input: moment.MomentInput, format: moment.MomentFormatSpecification, timezone: string) => moment.Moment)(
        appointmentDate,
        "YYYY-MM-DD",
        "Asia/Kolkata"
      );
    } else {
      return {
        // resourceType: 'Bundle',
        // type: 'collection',
        // entry: [
        //   {
        //     resource: {
        //       resourceType: "Slot",
        //       start: "2025-08-23T10:00:00Z",
        //       issue: [{
        //         severity: "error",
        //         code: "processing",
        //         details: { text: "Moment timezone function is not available" }
        //       }]
        //     }
        //   }
        // ]
        issue: [{
          severity: "error",
          code: "processing",
          details: { text: "Moment timezone function is not available" }
        }]
      };
    }

    if (!dateObj.isValid()) {
      // return {
      //   issue: [{
      //     severity: "error",
      //     code: "invalid",
      //     details: { text: "Invalid appointment date" }
      //   }]
      // };
      return {
        // resourceType: 'Bundle',
        // type: 'collection',
        // entry: [
        //   {
        //     resource: {
        //       resourceType: "Slot",
        //       start: "2025-08-23T10:00:00Z",
        //       issue: [{
        //         severity: "error",
        //         code: "invalid",
        //         details: { text: "Invalid appointment date" }
        //       }]
        //     }
        //   }
        // ]
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

    let todayStr = '';
    if (moment && typeof moment.tz === 'function') {
      const todayMoment = (moment.tz as (input: moment.MomentInput, timezone: string) => moment.Moment)(new Date(), "Asia/Kolkata");
      if (moment.isMoment(todayMoment) && todayMoment.isValid()) {
        todayStr = todayMoment.format('YYYY-MM-DD');
      }
    }
    const dateObjStr = (moment.isMoment(dateObj) && dateObj.isValid()) ? dateObj.format('YYYY-MM-DD') : '';
    const isToday = todayStr === dateObjStr;
    let currentTime: moment.Moment;
    if (typeof moment === 'function' && typeof moment.tz === 'function') {
      currentTime = (moment.tz as (input: moment.MomentInput, timezone: string) => moment.Moment)(new Date(), "Asia/Kolkata");
    } else {
      throw new Error("Moment or moment.tz is not available");
    }

    const slotsData: DoctorSlotDocument[] = await DoctorsTimeSlotes.find({ doctorId, day });
console.log(slotsData,'data');
    if (!slotsData.length) {
      return { resourceType: "Bundle", type: "collection", entry: [] };
    }

    const timeSlots: TimeSlot[] = slotsData[0].timeSlots;
    if (!Array.isArray(timeSlots)) {
      // return {
      //   issue: [{
      //     severity: "error",
      //     code: "processing",
      //     details: { text: "Time slots data is not in the expected format" }
      //   }]
      // };
      return {
        // resourceType: 'Bundle',
        // type: 'collection',
        // entry: [
        //   {
        //     resource: {
        //       resourceType: "Slot",
        //       start: "2025-08-23T10:00:00Z",
        //       issue: [{
        //         severity: "error",
        //         code: "processing",
        //         details: { text: "Time slots data is not in the expected format" }
        //       }]
        //     }
        //   }
        // ]
         issue: [{
          severity: "error",
          code: "processing",
          details: { text: "Time slots data is not in the expected format" }
        }]
      };
    }

    if (typeof doctorId !== 'string' || doctorId.trim() === '') {
      return { status: 0, message: 'Invalid doctor ID' };
      // return {
      //   resourceType: 'Bundle',
      //   type: 'collection',
      //   entry: [
      //     {
      //       resource: {
      //         resourceType: "Slot",
      //         start: "2025-08-23T10:00:00Z",
      //         issue: [{
      //           severity: "error",
      //           code: "processing",
      //           details: { text: "Invalid doctor ID" }
      //         }]
      //       }
      //     }
      //   ]
      // }
    }

    const normalizedDate = dateObj.format("YYYY-MM-DD");

    if (!moment(normalizedDate, "YYYY-MM-DD", true).isValid()) {
      return { status: 0, message: 'Invalid appointment date' };
      // return {
      //   resourceType: 'Bundle',
      //   type: 'collection',
      //   entry: [
      //     {
      //       resource: {
      //         resourceType: "Slot",
      //         start: "2025-08-23T10:00:00Z",
      //         issue: [{
      //           severity: "error",
      //           code: "processing",
      //           details: { text: "Invalid doctor ID" }
      //         }]
      //       }
      //     }
      //   ]
      // }
    }

    const bookedAppointments: AppointmentDocument[] = await webAppointments.find({
      veterinarian: doctorId,
      appointmentDate: normalizedDate
    });

    const availableSlots = timeSlots
      .filter(slot => {
        if (!slot.time) return false;
        if (isToday) {
          let slotDateTime: moment.Moment;
          if (typeof moment.tz === 'function') {
            slotDateTime = (moment.tz as (input: moment.MomentInput, format: moment.MomentFormatSpecification, timezone: string) => moment.Moment)(
              `${appointmentDate} ${slot.time}`,
              ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"],
              "Asia/Kolkata"
            );
          } else {
            throw new Error("moment.tz is not available");
          }
          return slotDateTime.isAfter(currentTime);
        }
        return true;
      })
      .map(slot => {
        const slotDateTime = (moment.tz as (input: moment.MomentInput, format: moment.MomentFormatSpecification, timezone: string) => moment.Moment)(
          `${appointmentDate} ${slot.time}`,
          ["YYYY-MM-DD h:mm A", "YYYY-MM-DD hh:mm A"],
          "Asia/Kolkata"
        );
        const slotObj = (typeof createFHIRSlot === 'function'
          ? createFHIRSlot(slot, doctorId, bookedAppointments)
          : {}) as Record<string, string | number>;
        if (slotObj && typeof slotObj === 'object') {
          slotObj.start = slotDateTime.toISOString();
        }
        return slotObj;
      });
console.log(availableSlots,'availableSlots');
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: availableSlots.map(resource => ({ resource })),
      // entry: [{
      //   resource: {
      //     resourceType: "Slot",
      //     entry: availableSlots.map(resource => ({ resource })),
      //     start: '',

      //   }
      // }]
    };
  }
};

export default SlotService;
