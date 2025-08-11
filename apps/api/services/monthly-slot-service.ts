import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import DoctorsTimeSlotes from '../models/doctors.slotes.model';
import { webAppointments } from '../models/web-appointment';

interface AvailableSlotPerDay {
  date: string;
  day: string;
  availableSlotsCount: number;
}

interface SlotSummaryParams {
  doctorId: string;
  slotMonth: number; // 1-12
  slotYear: number;
  startDate?: Date;
  endDate?: Date;
  availableSlotsPerDay?: AvailableSlotPerDay[];
}

const MonthlySlotService = {
  generateMonthlySlotSummary: async ({ doctorId, slotMonth, slotYear }: SlotSummaryParams) => {
    const timeZone = "Asia/Kolkata";

    const startDate = (moment.tz as (input: moment.MomentInput, timezone: string) => moment.Moment)({ year: slotYear, month: slotMonth - 1, day: 1 }, timeZone);
    const endDate = startDate.clone().endOf("month");

    const calendar: moment.Moment[] = [];
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

    const bookedSlotIds = new Set<string>(
      bookedAppointments
        .map((app: { slotsId?: string | { toString(): string } }) => app.slotsId?.toString())
        .filter((id): id is string => id !== undefined)
    );

    const availableSlotsPerDay: AvailableSlotPerDay[] = calendar.map(date => {
      const dayOfWeek = date.format("dddd");
      const daySchedule = weeklySchedule.find((schedule: unknown) => (schedule as { day: string }).day === dayOfWeek);

      let availableSlotsCount = 0;

      if (daySchedule && Array.isArray((daySchedule as { timeSlots: unknown[] }).timeSlots)) {
        const now = (moment.tz as (timezone: string) => moment.Moment)(timeZone);
        const isToday = date.isSame(now, 'day');

        availableSlotsCount = ((daySchedule as unknown) as { timeSlots: Array<{ _id?: unknown; time: string }> }).timeSlots.filter((slot) => {
          const slotTyped = slot as { _id?: unknown; time: string };
          const slotIdStr = slotTyped._id?.toString();
          if (slotIdStr && bookedSlotIds.has(slotIdStr)) return false;

          if (isToday) {
            const [hours, minutes] = slotTyped.time.split(":").map(Number);
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
      startDate: startDate.toDate(),
      endDate: endDate.toDate(),
      availableSlotsPerDay
    });
  },

  _formatFHIRResponse: ({ doctorId, startDate, endDate, availableSlotsPerDay = [] }: { doctorId: string; startDate: Date; endDate: Date; availableSlotsPerDay?: AvailableSlotPerDay[] }) => {
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
            component: availableSlotsPerDay.map((slot) => ({
              code: {
                text: `Available slots on ${slot.date} (${slot.day})`,
              },
              valueInteger: slot.availableSlotsCount,
            })),
          },
        },
      ],
    };
  }
};

export default MonthlySlotService;
