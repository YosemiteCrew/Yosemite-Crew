import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import BaseAvailabilityModel, {
  DayOfWeek,
  AvailabilitySlotMongo,
} from "src/models/base-availability";
import WeeklyAvailabilityOverrideModel from "src/models/weekly-availablity-override";
import { OccupancyModel } from "src/models/occupancy";

dayjs.extend(utc);

export class AvailabilityServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "AvailabilityServiceError";
  }
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  const trimmed = asNonEmptyString(value);
  if (!trimmed) {
    throw new AvailabilityServiceError(`Invalid ${field}`);
  }
  return trimmed;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const ensureValidDate = (value: unknown, field: string): Date => {
  if (!isValidDate(value)) {
    throw new AvailabilityServiceError(`Invalid ${field}`);
  }
  return value;
};

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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    await BaseAvailabilityModel.deleteMany({
      userId: safeUserId,
      organisationId: safeOrganisationId,
    });

    const rows = availabilities.map((a) => ({
      organisationId: safeOrganisationId,
      userId: safeUserId,
      dayOfWeek: a.dayOfWeek,
      slots: a.slots,
    }));

    return BaseAvailabilityModel.insertMany(rows);
  },

  async getBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    return BaseAvailabilityModel.find({
      organisationId: safeOrganisationId,
      userId: safeUserId,
    });
  },

  async deleteBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    await BaseAvailabilityModel.deleteMany({
      organisationId: safeOrganisationId,
      userId: safeUserId,
    });
  },

  // Weekly Overrides

  async addWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
    override: { dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] },
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");
    const weekStartDate = normalizeWeekStart(safeWeekDate);

    const existing = await WeeklyAvailabilityOverrideModel.findOne({
      userId: safeUserId,
      organisationId: safeOrganisationId,
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
        userId: safeUserId,
        organisationId: safeOrganisationId,
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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");

    return WeeklyAvailabilityOverrideModel.findOne({
      userId: safeUserId,
      organisationId: safeOrganisationId,
      weekStartDate: normalizeWeekStart(safeWeekDate),
    });
  },

  async deleteWeeklyAvailabilityOverride(
    organisationId: string,
    userId: string,
    weekDate: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeWeekDate = ensureValidDate(weekDate, "weekDate");

    await WeeklyAvailabilityOverrideModel.deleteOne({
      userId: safeUserId,
      organisationId: safeOrganisationId,
      weekStartDate: normalizeWeekStart(safeWeekDate),
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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeStartTime = ensureValidDate(startTime, "startTime");
    const safeEndTime = ensureValidDate(endTime, "endTime");

    await OccupancyModel.create({
      userId: safeUserId,
      organisationId: safeOrganisationId,
      startTime: safeStartTime,
      endTime: safeEndTime,
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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    const docs = items.map((i) => ({
      ...i,
      organisationId: safeOrganisationId,
      userId: safeUserId,
    }));

    await OccupancyModel.insertMany(docs);
  },

  async getOccupancy(
    organisationId: string,
    userId: string,
    from: Date,
    to: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeFrom = ensureValidDate(from, "from");
    const safeTo = ensureValidDate(to, "to");

    return OccupancyModel.find({
      userId: safeUserId,
      organisationId: safeOrganisationId,
      startTime: { $lt: safeTo },
      endTime: { $gt: safeFrom },
    }).lean();
  },

  // Merging logic to get final Availabilites

  async getWeeklyFinalAvailability(
    organisationId: string,
    userId: string,
    referenceDate: Date,
  ) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    // Always calculate week starting Monday (UTC)
    const weekStart = dayjs(safeReferenceDate)
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
    const base = await this.getBaseAvailability(
      safeOrganisationId,
      safeUserId,
    );

    // Convert base into map: { MONDAY → [...slots] }
    const map = new Map<DayOfWeek, AvailabilitySlotMongo[]>();

    for (const row of base) {
      map.set(row.dayOfWeek, row.slots);
    }

    // Load weekly override (if exists)
    const override = await this.getWeeklyAvailabilityOverride(
      safeOrganisationId,
      safeUserId,
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
      userId: safeUserId,
      organisationId: safeOrganisationId,
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
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const week = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      safeReferenceDate,
    );

    const dayOfWeek = getDayOfWeekFromDate(safeReferenceDate);
    const dateStr = getDateString(safeReferenceDate);

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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    const nowUtc = dayjs.utc();
    const today = nowUtc.toDate();

    const { slots, date } = await this.getFinalAvailabilityForDate(
      safeOrganisationId,
      safeUserId,
      today,
    );

    const occupied = await OccupancyModel.exists({
      organisationId: safeOrganisationId,
      userId: safeUserId,
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
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    // 1. Get final availability (with occupancy applied)
    const finalForDate = await this.getFinalAvailabilityForDate(
      organisationId,
      userId,
      safeReferenceDate,
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
    const safeReferenceDate = ensureValidDate(referenceDate, "referenceDate");

    const weekly = await this.getWeeklyFinalAvailability(
      organisationId,
      userId,
      safeReferenceDate,
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
