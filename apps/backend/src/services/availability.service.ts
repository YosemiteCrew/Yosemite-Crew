import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import BaseAvailabilityModel, {
  DayOfWeek,
  AvailabilitySlotMongo,
} from "src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "src/models/weekly-availablity-override";
import { OccupancyModel } from "src/models/occupancy";

dayjs.extend(utc);

/* Split one slot into possibly 3 parts around an occupancy */
function splitSlotAroundOccupancy(
  slot: AvailabilitySlotMongo,
  occStart: dayjs.Dayjs,
  occEnd: dayjs.Dayjs,
  dateStr: string,
): AvailabilitySlotMongo[] {
  const slotStart = dayjs.utc(`${dateStr}T${slot.startTime}:00`);
  const slotEnd = dayjs.utc(`${dateStr}T${slot.endTime}:00`);

  // If no overlap — return slot as-is
  const overlaps = occStart.isBefore(slotEnd) && occEnd.isAfter(slotStart);
  if (!overlaps) return [slot];

  const results: AvailabilitySlotMongo[] = [];

  // Left side fragment  (slotStart → occStart)
  if (occStart.isAfter(slotStart)) {
    results.push({
      startTime: slotStart.format("HH:mm"),
      endTime: occStart.format("HH:mm"),
      isAvailable: true,
    });
  }

  // Right side fragment (occEnd → slotEnd)
  if (occEnd.isBefore(slotEnd)) {
    results.push({
      startTime: occEnd.format("HH:mm"),
      endTime: slotEnd.format("HH:mm"),
      isAvailable: true,
    });
  }

  return results;
}

function getDateString(d: Date): string {
  return dayjs(d).utc().format("YYYY-MM-DD");
}

function getDayOfWeekFromDate(d: Date): DayOfWeek {
  return dayjs(d).utc().format("dddd").toUpperCase() as DayOfWeek;
}

function normalizeWeekStart(date: Date) {
  return dayjs(date)
    .utc()
    .startOf("week")
    .add(1, "day")
    .startOf("day")
    .toDate(); // Monday
}

// Generate Bookablble slots
export function generateBookableWindows(
  date: string,
  slots: AvailabilitySlotMongo[],
  windowMinutes: number,
): AvailabilitySlotMongo[] {
  const results: AvailabilitySlotMongo[] = [];

  for (const slot of slots) {
    const start = dayjs.utc(`${date}T${slot.startTime}:00`);
    const end = dayjs.utc(`${date}T${slot.endTime}:00`);

    let cursor = start;

    while (
      cursor.add(windowMinutes, "minute").isSame(end) ||
      cursor.add(windowMinutes, "minute").isBefore(end)
    ) {
      const windowStart = cursor;
      const windowEnd = cursor.add(windowMinutes, "minute");

      results.push({
        startTime: windowStart.format("HH:mm"),
        endTime: windowEnd.format("HH:mm"),
        isAvailable: true,
      });

      cursor = windowEnd;
    }
  }

  return results;
}

export const AvailabilityService = {
  // Base Availabilites

  async setAllBaseAvailability(
    organisationId: string,
    userId: string,
    availabilities: {
      dayOfWeek: DayOfWeek;
      slots: AvailabilitySlotMongo[];
    }[],
  ) {
    await BaseAvailabilityModel.deleteMany({ userId, organisationId });

    const rows = availabilities.map((a) => ({
      organisationId,
      userId,
      dayOfWeek: a.dayOfWeek,
      slots: a.slots,
    }));

    return BaseAvailabilityModel.insertMany(rows);
  },

  async getBaseAvailability(organisationId: string, userId: string) {
    return BaseAvailabilityModel.find({ organisationId, userId });
  },

  async deleteBaseAvailability(organisationId: string, userId: string) {
    await BaseAvailabilityModel.deleteMany({ organisationId, userId });
  },

  // Weekly Overrides

  async addWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
    override: { dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] },
  ) {
    const weekStartDate = normalizeWeekStart(weekDate);

    const existing = await WeeklyAvailabilityOverrideModel.findOne({
      userId,
      organisationId,
      weekStartDate,
    });

    if (existing) {
      const idx = existing.overrides.findIndex(
        (o) => o.dayOfWeek === override.dayOfWeek,
      );
      if (idx >= 0) existing.overrides[idx] = override;
      else existing.overrides.push(override);
      await existing.save();
    } else {
      await WeeklyAvailabilityOverrideModel.create({
        userId,
        organisationId,
        weekStartDate,
        overrides: [override],
      });
    }
  },

  async getWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
  ) {
    return WeeklyAvailabilityOverrideModel.findOne({
      userId,
      organisationId,
      weekStartDate: normalizeWeekStart(weekDate),
    });
  },

  async deleteWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
  ) {
    await WeeklyAvailabilityOverrideModel.deleteOne({
      userId,
      organisationId,
      weekStartDate: normalizeWeekStart(weekDate),
    });
  },

  // Occupancies

  async addOccupancy(
    organisationId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
    sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY",
    referenceId?: string,
  ) {
    await OccupancyModel.create({
      userId,
      organisationId,
      startTime,
      endTime,
      sourceType,
      referenceId,
    });
  },

  async addAllOccupancies(
    organisationId: string,
    userId: string,
    items: {
      startTime: Date;
      endTime: Date;
      sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY";
      referenceId?: string;
    }[],
  ): Promise<void> {
    const docs = items.map((i) => ({
      ...i,
      organisationId,
      userId,
    }));

    await OccupancyModel.insertMany(docs);
  },

  async getOccupancy(
    organisationId: string,
    userId: string,
    from: Date,
    to: Date,
  ) {
    return OccupancyModel.find({
      userId,
      organisationId,
      startTime: { $lt: to },
      endTime: { $gt: from },
    }).lean();
  },

  // Merging logic to get final Availabilites

  async getWeeklyFinalAvailability(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ) {
    // Always calculate week starting Monday (UTC)
    const weekStart = dayjs(referenceDate)
      .utc()
      .startOf("week") // Sunday
      .add(1, "day") // => Monday
      .startOf("day")
      .toDate();

    const weekDates = Array.from({ length: 7 }).map((_, i) => {
      const d = dayjs(weekStart).add(i, "day").toDate();
      return {
        date: d,
        dateStr: getDateString(d),
        dayOfWeek: getDayOfWeekFromDate(d),
      };
    });

    // Load base availability
    const base = await this.getBaseAvailability(organisationId, userId);

    // Convert base into map: { MONDAY → [...slots] }
    const map = new Map<DayOfWeek, AvailabilitySlotMongo[]>();

    for (const row of base) {
      map.set(row.dayOfWeek, row.slots);
    }

    // Load weekly override (if exists)
    const override = await this.getWeeklyAvailabilityOverride(
      organisationId,
      userId,
      weekStart,
    );

    if (override) {
      for (const ov of override.overrides) {
        map.set(ov.dayOfWeek, ov.slots);
      }
    }

    // Load occupancies for the week
    const weekEnd = dayjs(weekStart).add(7, "day").endOf("day").toDate();

    const occupancies = await OccupancyModel.find({
      userId,
      organisationId,
      $or: [{ startTime: { $lte: weekEnd }, endTime: { $gte: weekStart } }],
    }).lean();

    // Now remove overlapping slots
    for (const occ of occupancies) {
      const occStart = dayjs(occ.startTime).utc();
      const occEnd = dayjs(occ.endTime).utc();

      // Which day does occupancy belong to?
      const occDayStr = occStart.format("dddd").toUpperCase() as DayOfWeek;

      // Get that day's availability
      const slots = map.get(occDayStr) || [];
      const dateStr = occStart.format("YYYY-MM-DD");

      const newSlots: AvailabilitySlotMongo[] = [];

      for (const slot of slots) {
        const split = splitSlotAroundOccupancy(slot, occStart, occEnd, dateStr);
        newSlots.push(...split);
      }

      map.set(occDayStr, newSlots);
    }

    // Build final return structure
    return weekDates.map((w) => ({
      date: w.dateStr,
      dayOfWeek: w.dayOfWeek,
      slots: map.get(w.dayOfWeek) || [],
    }));
  },

  async getFinalAvailabilityForDate(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ) {
    const week = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      referenceDate,
    );

    const dayOfWeek = getDayOfWeekFromDate(referenceDate);
    const dateStr = getDateString(referenceDate);

    const dayEntry = week.find((d) => d.dayOfWeek === dayOfWeek);

    return {
      date: dateStr,
      dayOfWeek,
      slots: dayEntry?.slots ?? [],
    };
  },

  async getCurrentStatus(
    organisationId: string,
    userId: string,
  ): Promise<"Consulting" | "Available" | "Off-Duty" | "Unavailable"> {
    const nowUtc = dayjs.utc();
    const today = nowUtc.toDate();

    const { slots, date } = await this.getFinalAvailabilityForDate(
      organisationId,
      userId,
      today,
    );

    const occupied = await OccupancyModel.exists({
      organisationId,
      userId,
      startTime: { $lte: nowUtc.toDate() },
      endTime: { $gte: nowUtc.toDate() },
    });

    if (occupied) return "Consulting";

    const activeSlot = slots.find((s) => {
      const slotStart = dayjs.utc(`${date}T${s.startTime}:00`);
      const slotEnd = dayjs.utc(`${date}T${s.endTime}:00`);
      const startsNowOrEarlier =
        nowUtc.isSame(slotStart) || nowUtc.isAfter(slotStart);
      return startsNowOrEarlier && nowUtc.isBefore(slotEnd);
    });



    if (activeSlot) return "Available";
    if (slots.length === 0) return "Off-Duty";

    return "Unavailable";
  },

  // Get Bookable slots

  async getBookableSlotsForDate(
    organisationId: string,
    userId: string,
    windowMinutes: number,
    referenceDate: Date,
  ) {
    // 1. Get final availability (with occupancy applied)
    const finalForDate = await this.getFinalAvailabilityForDate(
      organisationId,
      userId,
      referenceDate,
    );

    const dateStr = finalForDate.date;
    const slots = finalForDate.slots;

    // 2. Generate bookable windows
    const windows = generateBookableWindows(dateStr, slots, windowMinutes);

    return {
      date: dateStr,
      dayOfWeek: finalForDate.dayOfWeek,
      windows,
    };
  },

  async getWeeklyWorkingHours(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ): Promise<number> {
    const weekly = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      referenceDate,
    );

    let totalMinutes = 0;

    for (const day of weekly) {
      for (const slot of day.slots) {
        const start = dayjs.utc(`${day.date}T${slot.startTime}:00`);
        const end = dayjs.utc(`${day.date}T${slot.endTime}:00`);
        const diff = end.diff(start, "minute");
        if (diff > 0) totalMinutes += diff;
      }
    }

    return totalMinutes / 60; // hours
  },
};
