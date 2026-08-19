import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { AvailabilitySlotMongo } from "src/models/base-availability";
import { prisma } from "src/config/prisma";
import { AvailabilityService } from "src/services/availability.service";
import {
  addCachedPromise,
  type CachedPromise,
} from "src/utils/cached-promise-cache";
import {
  buildBookableWindowsForVets,
  buildCalendarPrefillMatches,
  resolveOrganisationTimezone,
} from "src/utils/scheduling";

dayjs.extend(utc);

const CALENDAR_PREFILL_CACHE_TTL_MS = 15_000;
const CALENDAR_PREFILL_CACHE_MAX_ENTRIES = 2_000;
const CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS = 15_000;

export type CalendarPrefillInput = {
  organisationId: string;
  date: Date;
  minuteOfDay: number;
  leadId?: string;
  serviceIds: string[];
};

export type CalendarPrefillMatch = {
  serviceId: string;
  slot: {
    startTime: string;
    endTime: string;
    vetIds: string[];
  };
  meta: {
    localStartMinute: number;
    localEndMinute: number;
  };
};

export type CalendarPrefillSchedulingContext = {
  serviceId: string;
  organisationId: string;
  durationMinutes: number;
  vetIds: string[];
};

export type CalendarPrefillCache = Map<
  string,
  CachedPromise<CalendarPrefillMatch[]>
>;

export const createCalendarPrefillCache = (): CalendarPrefillCache => new Map();

const getLeadPersonalDetails = async (organisationId: string, leadId: string) =>
  (
    await prisma.userProfile.findFirst({
      where: {
        organizationId: organisationId,
        userId: leadId,
      },
      select: {
        personalDetails: true,
      },
    })
  )?.personalDetails;

const getOrganisationPersonalDetails = async (organisationId: string) =>
  (
    await prisma.userProfile.findFirst({
      where: {
        organizationId: organisationId,
      },
      select: {
        personalDetails: true,
      },
    })
  )?.personalDetails;

const computeCalendarPrefillMatches = async (params: {
  input: CalendarPrefillInput;
  serviceIds: string[];
  safeOrganisationId: string;
  safeLeadId: string | undefined;
  resolveSchedulingContext: (
    serviceId: string,
    organisationId: string,
  ) => Promise<CalendarPrefillSchedulingContext>;
}): Promise<CalendarPrefillMatch[]> => {
  const timezone = await resolveOrganisationTimezone({
    organisationId: params.safeOrganisationId,
    leadId: params.safeLeadId,
    getLeadPersonalDetails,
    getOrganisationPersonalDetails,
  });

  const slotCache = new Map<
    string,
    Promise<{
      date: string;
      dayOfWeek: string;
      windows: AvailabilitySlotMongo[];
    }>
  >();

  const serviceContexts = await Promise.all(
    params.serviceIds.map((serviceId) =>
      params.resolveSchedulingContext(serviceId, params.input.organisationId),
    ),
  );

  const matches = await buildCalendarPrefillMatches({
    inputDate: params.input.date,
    timezone,
    minuteOfDay: params.input.minuteOfDay,
    leadId: params.safeLeadId,
    contexts: serviceContexts.map((context) => ({
      matchId: context.serviceId,
      organisationId: context.organisationId,
      durationMinutes: context.durationMinutes,
      vetIds: context.vetIds,
    })),
    utcDateShifts: [-1, 0, 1],
    slotCache,
    getBookableWindows: (context, referenceDate, cache) =>
      buildBookableWindowsForVets({
        organisationId: context.organisationId,
        vetIds: context.vetIds,
        durationMinutes: context.durationMinutes,
        referenceDate,
        slotCache: cache,
        getBookableSlotsForDate: (...args) =>
          AvailabilityService.getBookableSlotsForDate(...args),
      }),
  });

  return matches.map((match) => ({
    serviceId: match.matchId,
    slot: match.slot,
    meta: match.meta,
  }));
};

/**
 * Shared calendar-prefill flow used by both `ServiceService` and
 * `CatalogService`: sanitise + dedupe the requested service ids, short-circuit
 * on an empty list, then resolve matches behind a keyed promise cache.
 *
 * `requireSafeString` is caller-supplied so each service keeps throwing its
 * own error type; `resolveSchedulingContext` abstracts how a service id is
 * resolved to an organisation/vets/duration scheduling context.
 */
export const getCalendarPrefillMatchesCached = async (params: {
  input: CalendarPrefillInput;
  cache: CalendarPrefillCache;
  requireSafeString: (value: string, field: string) => string;
  resolveSchedulingContext: (
    serviceId: string,
    organisationId: string,
  ) => Promise<CalendarPrefillSchedulingContext>;
}): Promise<CalendarPrefillMatch[]> => {
  const serviceIds = Array.from(
    new Set(
      params.input.serviceIds
        .map((serviceId) => params.requireSafeString(serviceId, "serviceId"))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  if (serviceIds.length === 0) {
    return [];
  }

  const safeOrganisationId = params.requireSafeString(
    params.input.organisationId,
    "organisationId",
  );
  const safeLeadId = params.input.leadId
    ? params.requireSafeString(params.input.leadId, "leadId")
    : undefined;

  const cacheKey = JSON.stringify({
    organisationId: safeOrganisationId,
    date: dayjs(params.input.date).utc().format("YYYY-MM-DD"),
    minuteOfDay: params.input.minuteOfDay,
    leadId: safeLeadId ?? "",
    serviceIds,
  });

  return addCachedPromise(
    params.cache,
    cacheKey,
    CALENDAR_PREFILL_CACHE_TTL_MS,
    () =>
      computeCalendarPrefillMatches({
        input: params.input,
        serviceIds,
        safeOrganisationId,
        safeLeadId,
        resolveSchedulingContext: params.resolveSchedulingContext,
      }),
    {
      maxEntries: CALENDAR_PREFILL_CACHE_MAX_ENTRIES,
      pruneIntervalMs: CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS,
    },
  );
};
