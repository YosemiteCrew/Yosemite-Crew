import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

const DAY_MINUTES = 24 * 60;
const UTC_CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OFFSET_TIMEZONE_REGEX = /^(?:UTC)?([+-])(\d{1,2}):(\d{2})$/;

type PreferredTimeZoneClock = {
  minutes: number;
  dayOffset: number;
};

type TimeZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

type TimeSlotLike = {
  startTime: string;
  endTime: string;
};

export type OrganisationAddressLike = {
  id: string;
  name: string;
  imageURL?: string | null;
  imageUrl?: string | null;
  phoneNo?: string | null;
  type: string;
  appointmentCheckInBufferMinutes?: number | null;
  appointmentCheckInRadiusMeters?: number | null;
  address?: {
    addressLine?: string | null;
    country?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

export type CalendarPrefillContext = {
  matchId: string;
  organisationId: string;
  durationMinutes: number;
  vetIds: string[];
};

type BookableWindowResult<TSlot extends TimeSlotLike> = {
  date: string;
  dayOfWeek: string;
  windows: TSlot[];
};

type BookableWindowSet<TSlot extends TimeSlotLike> = {
  date: string;
  dayOfWeek: string;
  windows: Array<TSlot & { vetIds: string[] }>;
};

const parseDatePartsForTimeZone = (
  date: Date,
  timezone: string,
): TimeZoneParts => {
  if (timezone === "UTC") {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }

  const offsetMatch = OFFSET_TIMEZONE_REGEX.exec(timezone);
  if (offsetMatch) {
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    const hours = Number(offsetMatch[2]);
    const minutes = Number(offsetMatch[3]);
    const offsetMinutes = sign * (hours * 60 + minutes);
    const shiftedDate = new Date(date.getTime() + offsetMinutes * 60_000);

    return {
      year: shiftedDate.getUTCFullYear(),
      month: shiftedDate.getUTCMonth() + 1,
      day: shiftedDate.getUTCDate(),
      hour: shiftedDate.getUTCHours(),
      minute: shiftedDate.getUTCMinutes(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
};

export const extractTimezoneFromPersonalDetails = (
  value: unknown,
): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const timezone = (value as { timezone?: unknown }).timezone;
  if (typeof timezone !== "string") {
    return null;
  }

  const trimmed = timezone.trim();
  return trimmed || null;
};

export const mapOrganisationWithAddress = (org: OrganisationAddressLike) => ({
  id: org.id,
  name: org.name,
  imageURL: org.imageURL ?? org.imageUrl ?? undefined,
  phoneNo: org.phoneNo ?? undefined,
  type: org.type,
  appointmentCheckInBufferMinutes: org.appointmentCheckInBufferMinutes ?? 5,
  appointmentCheckInRadiusMeters: org.appointmentCheckInRadiusMeters ?? 200,
  address: org.address
    ? {
        addressLine: org.address.addressLine ?? undefined,
        country: org.address.country ?? undefined,
        city: org.address.city ?? undefined,
        state: org.address.state ?? undefined,
        postalCode: org.address.postalCode ?? undefined,
        latitude: org.address.latitude ?? undefined,
        longitude: org.address.longitude ?? undefined,
      }
    : undefined,
});

export const resolveOrganisationTimezone = async (params: {
  organisationId: string;
  leadId?: string;
  getLeadPersonalDetails: (
    organisationId: string,
    leadId: string,
  ) => Promise<unknown>;
  getOrganisationPersonalDetails: (organisationId: string) => Promise<unknown>;
  defaultTimezone?: string;
}) => {
  if (params.leadId) {
    const leadTimezone = extractTimezoneFromPersonalDetails(
      await params.getLeadPersonalDetails(params.organisationId, params.leadId),
    );
    if (leadTimezone) return leadTimezone;
  }

  return (
    extractTimezoneFromPersonalDetails(
      await params.getOrganisationPersonalDetails(params.organisationId),
    ) ??
    params.defaultTimezone ??
    "UTC"
  );
};

export const utcClockTimeToTimezoneClock = (
  utcTime: string,
  timezone: string,
): PreferredTimeZoneClock => {
  const match = UTC_CLOCK_TIME_REGEX.exec(utcTime);
  if (!match) {
    return { minutes: 0, dayOffset: 0 };
  }

  const targetDate = new Date(
    Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0, 0),
  );
  const baseDate = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));

  const baseParts = parseDatePartsForTimeZone(baseDate, timezone);
  const targetParts = parseDatePartsForTimeZone(targetDate, timezone);

  const baseDayIndex = Math.floor(
    Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day) / 86_400_000,
  );
  const targetDayIndex = Math.floor(
    Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day) /
      86_400_000,
  );

  return {
    minutes: targetParts.hour * 60 + targetParts.minute,
    dayOffset: targetDayIndex - baseDayIndex,
  };
};

export const normalizeSlotForSelectedDay = (params: {
  timezone: string;
  utcDateShift: number;
  slot: TimeSlotLike;
}) => {
  const startClock = utcClockTimeToTimezoneClock(
    params.slot.startTime,
    params.timezone,
  );
  const endClock = utcClockTimeToTimezoneClock(
    params.slot.endTime,
    params.timezone,
  );

  const startAbsoluteMinute =
    startClock.dayOffset * DAY_MINUTES + startClock.minutes;
  let endAbsoluteMinute = endClock.dayOffset * DAY_MINUTES + endClock.minutes;

  if (endAbsoluteMinute <= startAbsoluteMinute) {
    endAbsoluteMinute += DAY_MINUTES;
  }

  const localStartMinute =
    startAbsoluteMinute + params.utcDateShift * DAY_MINUTES;
  const localEndMinute = endAbsoluteMinute + params.utcDateShift * DAY_MINUTES;

  if (localStartMinute < 0 || localStartMinute >= DAY_MINUTES) {
    return null;
  }

  return {
    localStartMinute,
    localEndMinute,
  };
};

export const buildBookableWindowsForVets = async <
  TSlot extends TimeSlotLike,
>(params: {
  organisationId: string;
  vetIds: string[];
  durationMinutes: number;
  referenceDate: Date;
  slotCache?: Map<string, Promise<BookableWindowResult<TSlot>>>;
  getBookableSlotsForDate: (
    organisationId: string,
    vetId: string,
    durationMinutes: number,
    referenceDate: Date,
  ) => Promise<BookableWindowResult<TSlot>>;
}): Promise<BookableWindowSet<TSlot>> => {
  if (params.vetIds.length === 0) {
    return {
      date: dayjs(params.referenceDate).utc().format("YYYY-MM-DD"),
      dayOfWeek: dayjs(params.referenceDate).utc().format("dddd").toUpperCase(),
      windows: [] as Array<TSlot & { vetIds: string[] }>,
    };
  }

  const allSlots: Array<TSlot & { vetIds: string[] }> = [];

  for (const vetId of params.vetIds) {
    const cacheKey = [
      params.organisationId,
      vetId,
      params.durationMinutes,
      dayjs(params.referenceDate).utc().format("YYYY-MM-DD"),
    ].join("|");

    const cachedResult = params.slotCache?.get(cacheKey);
    const resultPromise: Promise<BookableWindowResult<TSlot>> =
      cachedResult ??
      params.getBookableSlotsForDate(
        params.organisationId,
        vetId,
        params.durationMinutes,
        params.referenceDate,
      );

    if (!cachedResult && params.slotCache) {
      params.slotCache.set(cacheKey, resultPromise);
    }

    const result = await resultPromise;

    if (result?.windows?.length) {
      for (const slot of result.windows) {
        allSlots.push({
          ...slot,
          vetIds: [vetId],
        });
      }
    }
  }

  const slotMap = new Map<string, TSlot & { vetIds: string[] }>();

  for (const slot of allSlots) {
    const key = `${slot.startTime}-${slot.endTime}`;

    if (slotMap.has(key)) {
      const existing = slotMap.get(key)!;
      existing.vetIds.push(...slot.vetIds);
    } else {
      slotMap.set(key, slot);
    }
  }

  let finalWindows = Array.from(slotMap.values()).map((slot) => ({
    ...slot,
    vetIds: Array.from(new Set(slot.vetIds)),
  }));

  const todayStr = dayjs().utc().format("YYYY-MM-DD");
  const refStr = dayjs(params.referenceDate).utc().format("YYYY-MM-DD");

  if (refStr === todayStr) {
    const now = dayjs().utc();

    finalWindows = finalWindows.filter((slot) => {
      const slotTime = dayjs.utc(
        `${refStr} ${slot.startTime}`,
        "YYYY-MM-DD HH:mm",
        true,
      );
      return slotTime.isAfter(now);
    });
  }

  finalWindows.sort((a, b) => {
    const t1 = dayjs(`2000-01-01 ${a.startTime}`);
    const t2 = dayjs(`2000-01-01 ${b.startTime}`);
    return t1.valueOf() - t2.valueOf();
  });

  return {
    date: refStr,
    dayOfWeek: dayjs(params.referenceDate).utc().format("dddd").toUpperCase(),
    windows: finalWindows,
  };
};

export const buildCalendarPrefillMatches = async <
  TSlot extends TimeSlotLike,
>(params: {
  inputDate: Date;
  timezone: string;
  minuteOfDay: number;
  leadId?: string;
  contexts: CalendarPrefillContext[];
  utcDateShifts: readonly number[];
  slotCache?: Map<string, Promise<BookableWindowResult<TSlot>>>;
  getBookableWindows: (
    context: CalendarPrefillContext,
    referenceDate: Date,
    slotCache?: Map<string, Promise<BookableWindowResult<TSlot>>>,
  ) => Promise<BookableWindowSet<TSlot>>;
}): Promise<
  Array<{
    matchId: string;
    slot: {
      startTime: string;
      endTime: string;
      vetIds: string[];
    };
    meta: {
      localStartMinute: number;
      localEndMinute: number;
    };
  }>
> => {
  const matches: Array<{
    matchId: string;
    slot: {
      startTime: string;
      endTime: string;
      vetIds: string[];
    };
    meta: {
      localStartMinute: number;
      localEndMinute: number;
    };
  }> = [];

  const leadId = params.leadId?.trim();

  for (const context of params.contexts) {
    for (const utcDateShift of params.utcDateShifts) {
      const referenceDate = dayjs(params.inputDate)
        .utc()
        .add(utcDateShift, "day")
        .toDate();

      const result = await params.getBookableWindows(
        context,
        referenceDate,
        params.slotCache,
      );

      for (const slot of result.windows) {
        if (leadId && !(slot.vetIds ?? []).includes(leadId)) {
          continue;
        }

        const meta = normalizeSlotForSelectedDay({
          timezone: params.timezone,
          utcDateShift,
          slot,
        });
        if (!meta) {
          continue;
        }

        if (Math.abs(meta.localStartMinute - params.minuteOfDay) > 5) {
          continue;
        }

        matches.push({
          matchId: context.matchId,
          slot: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            vetIds: slot.vetIds ?? [],
          },
          meta,
        });
      }
    }
  }

  matches.sort((a, b) => {
    if (a.meta.localStartMinute !== b.meta.localStartMinute) {
      return a.meta.localStartMinute - b.meta.localStartMinute;
    }
    if (a.meta.localEndMinute !== b.meta.localEndMinute) {
      return a.meta.localEndMinute - b.meta.localEndMinute;
    }
    return a.matchId.localeCompare(b.matchId);
  });

  return matches;
};
