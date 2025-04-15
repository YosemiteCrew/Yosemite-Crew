const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const DoctorsTimeSlotes  = require('../models/DoctorsSlotes');
const { webAppointments } = require("../models/WebAppointment");
const mongoose = require('mongoose');

class MonthlySlotService {
  static async generateMonthlySlotSummary({ doctorId, slotMonth, slotYear }) {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
          throw new Error("Invalid doctor ID");
    }
    const startDate = moment({ year: slotYear, month: slotMonth - 1, day: 1 });
    const endDate = startDate.clone().endOf("month");

    const calendar = [];
    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, "day")) {
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

    const bookedSlotIds = new Set(bookedAppointments.map(app => app.slotsId?.toString()));

    const availableSlotsPerDay = calendar.map(date => {
      const dayOfWeek = date.format("dddd");
      const daySchedule = weeklySchedule.find(schedule => schedule.day === dayOfWeek);

      let availableSlotsCount = 0;
      if (daySchedule && Array.isArray(daySchedule.timeSlots)) {
        availableSlotsCount = daySchedule.timeSlots.filter(
          slot => !bookedSlotIds.has(slot._id?.toString())
        ).length;
      }

      return {
        date: date.format("YYYY-MM-DD"),
        day: dayOfWeek,
        availableSlotsCount,
      };
    });

    return MonthlySlotService._formatFHIRResponse({ doctorId, startDate, endDate, availableSlotsPerDay });
  }

  static _formatFHIRResponse({ doctorId, startDate, endDate, availableSlotsPerDay }) {
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
            component: availableSlotsPerDay.map(slot => ({
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
