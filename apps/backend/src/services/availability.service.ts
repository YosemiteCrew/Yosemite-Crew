import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { randomUUID } from "node:crypto";
import { DayOfWeek, AvailabilitySlotMongo } from "src/models/base-availability";
import { prisma } from "src/config/prisma";
import { Prisma, OccupancySourceType } from "@prisma/client";

dayjs.extend(utc);

export class AvailabilityServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AvailabilityServiceError";
  }
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
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

const syncBaseAvailabilityToPostgres = async (
  organisationId: string,
  userId: string,
  rows: Array<{
    dayOfWeek: DayOfWeek;
    slots: AvailabilitySlotMongo[];
  }>,
) => {
  await prisma.baseAvailability.deleteMany({
    where: { userId, organisationId },
  });
  if (rows.length) {
    await prisma.baseAvailability.createMany({
      data: rows.map((row) => ({
        userId,
        organisationId,
        dayOfWeek: row.dayOfWeek as never,
        slots: row.slots as unknown as Prisma.InputJsonValue,
      })),
    });
  }
};

const syncWeeklyOverrideToPostgres = async (doc: {
  id: string;
  userId: string;
  organisationId: string;
  weekStartDate: Date;
  overrides: Array<{ dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] }>;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  await prisma.weeklyAvailabilityOverride.upsert({
    where: {
      userId_organisationId_weekStartDate: {
        userId: doc.userId,
        organisationId: doc.organisationId,
        weekStartDate: doc.weekStartDate,
      },
    },
    create: {
      id: doc.id,
      userId: doc.userId,
      organisationId: doc.organisationId,
      weekStartDate: doc.weekStartDate,
      overrides: doc.overrides as unknown as Prisma.InputJsonValue,
      createdAt: doc.createdAt ?? undefined,
      updatedAt: doc.updatedAt ?? undefined,
    },
    update: {
      overrides: doc.overrides as unknown as Prisma.InputJsonValue,
      updatedAt: doc.updatedAt ?? undefined,
    },
  });
};

const syncOccupancyToPostgres = async (doc: {
  _id: { toString(): string };
  userId: string;
  organisationId: string;
  startTime: Date;
  endTime: Date;
  sourceType: OccupancySourceType;
  referenceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  await prisma.occupancy.upsert({
    where: { id: doc._id.toString() },
    create: {
      id: doc._id.toString(),
      userId: doc.userId,
      organisationId: doc.organisationId,
      startTime: doc.startTime,
      endTime: doc.endTime,
      sourceType: doc.sourceType,
      referenceId: doc.referenceId ?? undefined,
      createdAt: doc.createdAt ?? undefined,
      updatedAt: doc.updatedAt ?? undefined,
    },
    update: {
      startTime: doc.startTime,
      endTime: doc.endTime,
      sourceType: doc.sourceType,
      referenceId: doc.referenceId ?? undefined,
      updatedAt: doc.updatedAt ?? undefined,
    },
  });
};

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

    const rows = availabilities.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      slots: a.slots,
    }));

    await syncBaseAvailabilityToPostgres(safeOrganisationId, safeUserId, rows);

    const created = await prisma.baseAvailability.findMany({
      where: { userId: safeUserId, organisationId: safeOrganisationId },
      orderBy: { dayOfWeek: "asc" },
    });

    return created.map((row) => ({
      dayOfWeek: row.dayOfWeek as DayOfWeek,
      slots: row.slots as unknown as AvailabilitySlotMongo[],
    }));
  },

  async getBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    const rows = await prisma.baseAvailability.findMany({
      where: { organisationId: safeOrganisationId, userId: safeUserId },
      orderBy: { dayOfWeek: "asc" },
    });
    return rows.map((row) => ({
      _id: row.id,
      userId: row.userId,
      organisationId: row.organisationId,
      dayOfWeek: row.dayOfWeek as DayOfWeek,
      slots: row.slots as unknown as AvailabilitySlotMongo[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },

  async getOrganisationBaseAvailability(organisationId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );

    const rows = await prisma.baseAvailability.findMany({
      where: { organisationId: safeOrganisationId },
      orderBy: [{ userId: "asc" }, { dayOfWeek: "asc" }],
    });

    return rows.map((row) => ({
      _id: row.id,
      userId: row.userId,
      organisationId: row.organisationId,
      dayOfWeek: row.dayOfWeek as DayOfWeek,
      slots: row.slots as unknown as AvailabilitySlotMongo[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },

  async deleteBaseAvailability(organisationId: string, userId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeUserId = ensureNonEmptyString(userId, "userId");

    await prisma.baseAvailability.deleteMany({
      where: { organisationId: safeOrganisationId, userId: safeUserId },
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

    const existing = await prisma.weeklyAvailabilityOverride.findUnique({
      where: {
        userId_organisationId_weekStartDate: {
          userId: safeUserId,
          organisationId: safeOrganisationId,
          weekStartDate,
        },
      },
    });

    const overrides = existing
      ? (existing.overrides as unknown as Array<{
          dayOfWeek: DayOfWeek;
          slots: AvailabilitySlotMongo[];
        }>)
      : [];

    const idx = overrides.findIndex((o) => o.dayOfWeek === override.dayOfWeek);
    if (idx >= 0) overrides[idx] = override;
    else overrides.push(override);

    await syncWeeklyOverrideToPostgres({
      id: existing?.id ?? randomUUID(),
      userId: safeUserId,
      organisationId: safeOrganisationId,
      weekStartDate,
      overrides,
      createdAt: existing?.createdAt ?? undefined,
    });
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

    const override = await prisma.weeklyAvailabilityOverride.findFirst({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate: normalizeWeekStart(safeWeekDate),
      },
    });
    if (!override) return null;
    return {
      _id: override.id,
      userId: override.userId,
      organisationId: override.organisationId,
      weekStartDate: override.weekStartDate,
      overrides: override.overrides as unknown as Array<{
        dayOfWeek: DayOfWeek;
        slots: AvailabilitySlotMongo[];
      }>,
      createdAt: override.createdAt,
    };
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

    await prisma.weeklyAvailabilityOverride.deleteMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        weekStartDate: normalizeWeekStart(safeWeekDate),
      },
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

    await syncOccupancyToPostgres({
      _id: randomUUID(),
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

    await prisma.occupancy.createMany({
      data: items.map((item) => ({
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: item.startTime,
        endTime: item.endTime,
        sourceType: item.sourceType,
        referenceId: item.referenceId ?? undefined,
      })),
    });
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

    return prisma.occupancy.findMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: { lt: safeTo },
        endTime: { gt: safeFrom },
      },
    });
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
    const base = await this.getBaseAvailability(safeOrganisationId, safeUserId);

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

    const occupancies = await prisma.occupancy.findMany({
      where: {
        userId: safeUserId,
        organisationId: safeOrganisationId,
        startTime: { lte: weekEnd },
        endTime: { gte: weekStart },
      },
    });

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

    const occupied = await prisma.occupancy.findFirst({
      where: {
        organisationId: safeOrganisationId,
        userId: safeUserId,
        startTime: { lte: nowUtc.toDate() },
        endTime: { gte: nowUtc.toDate() },
      },
      select: { id: true },
    });

    if (occupied) return "Consulting";

    const activeSlot = slots.some((s) => {
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
