const moment = require('moment-timezone');
const { v4: uuidv4 } = require("uuid");
const DoctorsTimeSlotes  = require('../models/DoctorsSlotes');
const { webAppointments } = require("../models/WebAppointment");

interface SlotSummaryParams {
  doctorId: string;
  slotMonth: number; // 1-12
  startDate :Date;
  endDate : Date;
  slotYear: number;
  availableSlotsPerDay: {
    date: string; // e.g., "2025-05-26"
    day: string;  // e.g., "Monday"
    availableSlotsCount: number;
  }[];
}

class MonthlySlotService {

 static async generateMonthlySlotSummary({ doctorId , slotMonth, slotYear } : SlotSummaryParams ) {
  const timeZone = "Asia/Kolkata";

  const startDate = moment.tz({ year: slotYear, month: slotMonth - 1, day: 1 }, timeZone);
  const endDate = startDate.clone().endOf("month");

  const calendar = [];
  for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, "day")) {
    calendar.push(date.clone());
  }

  const weeklySchedule = await DoctorsTimeSlotes.find({ doctorId }).lean();

  const bookedAppointments = await webAppointments.find({
    veterinarian: doctorId,
    appointmentDate: {
      $gte: startDate.toDate(),
      $lte: endDate.toDate(),
    },
  }).lean();

  const bookedSlotIds = new Set(bookedAppointments.map((app :any) => app.slotsId?.toString()));

  const availableSlotsPerDay = calendar.map(date => {
    const dayOfWeek = date.format("dddd");
    const daySchedule = weeklySchedule.find((schedule : any)=> schedule.day === dayOfWeek);

    let availableSlotsCount = 0;

    if (daySchedule && Array.isArray(daySchedule.timeSlots)) {
      const now = moment.tz(timeZone);
      const isToday = date.isSame(now, 'day');

      availableSlotsCount = daySchedule.timeSlots.filter((slot :any) => {
        const slotIdStr = slot._id?.toString();
        if (bookedSlotIds.has(slotIdStr)) return false;

        if (isToday) {
          const [hours, minutes] = slot.time24.split(":").map(Number);
          const slotDateTime = date.clone().hour(hours).minute(minutes);

          return slotDateTime.isAfter(now);
        }

        return true;
      }).length;
    }

    return {
      date: date.format("YYYY-MM-DD"),
      day: dayOfWeek,
      availableSlotsCount,
    };
  });

  return MonthlySlotService._formatFHIRResponse({
    doctorId,
    startDate,
    endDate,
    availableSlotsPerDay
  } as SlotSummaryParams);
}
  

  static _formatFHIRResponse({ doctorId, startDate, endDate, availableSlotsPerDay } : SlotSummaryParams) {
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Schedule",
            id: uuidv4(),
            identifier: [{ system: "https://example.com/schedule", value: doctorId }],
            actor: [{ reference: `Practitioner/${doctorId}` }],
            planningHorizon: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: uuidv4(),
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "TODO:DEFINE_CODE",
                  display: "Available Slots Per Day",
                },
              ],
              text: "Available slots per day for the doctor",
            },
            subject: { reference: `Practitioner/${doctorId}` },
            effectivePeriod: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
            component: availableSlotsPerDay.map((slot  :any)=> ({
              code: {
                text: `Available slots on ${slot.date} (${slot.day})`,
                date: slot.date,
                day: slot.day,
              },
              valueInteger: slot.availableSlotsCount,
            })),
          },
        },
      ],
    };
  }
}

module.exports = MonthlySlotService;
