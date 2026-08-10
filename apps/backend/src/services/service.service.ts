import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import {
  toServiceResponseDTO,
  fromServiceRequestDTO,
  ServiceRequestDTO,
  Service,
} from "@yosemite-crew/types";
import { AvailabilitySlotMongo } from "src/models/base-availability";
import { AvailabilityService } from "./availability.service";
import helpers from "src/utils/helper";
import { prisma } from "src/config/prisma";
import { ServiceType } from "@prisma/client";
import {
  addCachedPromise,
  type CachedPromise,
} from "src/utils/cached-promise-cache";
import {
  buildBookableWindowsForVets,
  mapOrganisationWithAddress,
  normalizeSlotForSelectedDay,
  resolveOrganisationTimezone,
} from "src/utils/scheduling";
import { filterWithinRadius, getBoundingDeltas } from "src/utils/geo";

dayjs.extend(utc);

type CalendarPrefillRequest = {
  organisationId: string;
  date: Date;
  minuteOfDay: number;
  leadId?: string;
  serviceIds: string[];
};

type CalendarPrefillMatch = {
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

type AvailabilityWindow = AvailabilitySlotMongo & {
  vetIds?: string[];
};

type ServiceSchedulingContext = {
  serviceId: string;
  organisationId: string;
  durationMinutes: number;
  vetIds: string[];
};

type ServiceRecord = {
  id: string;
  organisationId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  cost: number;
  maxDiscount: number | null;
  specialityId: string | null;
  serviceType: ServiceType;
  observationToolId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const SLOT_MATCH_TOLERANCE_MINUTES = 5;
const CALENDAR_PREFILL_CACHE_TTL_MS = 15_000;
const CALENDAR_PREFILL_CACHE_MAX_ENTRIES = 2_000;
const CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS = 15_000;
const calendarPrefillCache = new Map<
  string,
  CachedPromise<CalendarPrefillMatch[]>
>();

export class ServiceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ServiceServiceError";
  }
}

const requireSafeString = (value: string, field: string) => {
  if (!value || typeof value !== "string") {
    throw new ServiceServiceError(`Invalid ${field}`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ServiceServiceError(`Invalid ${field}`, 400);
  }
  if (trimmed.includes("$")) {
    throw new ServiceServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

const listOrganisationsProvidingServiceFromPostgres = async (
  serviceName: string,
) => {
  const safeName = serviceName.trim();
  if (!safeName) return [];

  const services = await prisma.service.findMany({
    where: { name: { contains: safeName, mode: "insensitive" } },
    select: { organisationId: true },
  });

  if (!services.length) return [];

  const orgIds = [...new Set(services.map((s) => s.organisationId))];
  const organisations = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    include: { address: true },
  });

  return organisations.map((org) => mapOrganisationWithAddress(org));
};

const mapServiceRecordToDomain = (service: ServiceRecord): Service => ({
  id: service.id,
  organisationId: service.organisationId,
  name: service.name,
  description: service.description ?? null,
  durationMinutes: service.durationMinutes,
  cost: service.cost,
  maxDiscount: service.maxDiscount ?? null,
  specialityId: service.specialityId ?? null,
  serviceType: service.serviceType,
  observationToolId: service.observationToolId ?? null,
  isActive: service.isActive,
  createdAt: service.createdAt,
  updatedAt: service.updatedAt,
});

const getServiceSchedulingContext = async (
  serviceId: string,
  organisationId: string,
): Promise<ServiceSchedulingContext> => {
  const safeServiceId = requireSafeString(serviceId, "serviceId");
  const safeOrganisationId = requireSafeString(
    organisationId,
    "organisationId",
  );

  const service = await prisma.service.findFirst({
    where: { id: safeServiceId, organisationId: safeOrganisationId },
  });
  if (!service) throw new Error("Service not found");

  const speciality = await prisma.speciality.findFirst({
    where: { id: service.specialityId ?? undefined },
  });
  if (!speciality) throw new Error("Speciality not found");

  return {
    serviceId: service.id,
    organisationId: service.organisationId,
    durationMinutes: service.durationMinutes,
    vetIds: speciality.memberUserIds || [],
  };
};

const collectCalendarPrefillMatches = async (params: {
  input: CalendarPrefillRequest;
  timezone: string;
  serviceContexts: ServiceSchedulingContext[];
  slotCache: Map<
    string,
    Promise<{
      date: string;
      dayOfWeek: string;
      windows: AvailabilitySlotMongo[];
    }>
  >;
}) => {
  const { input, timezone, serviceContexts, slotCache } = params;
  const utcDateShifts = [-1, 0, 1] as const;
  const matches: CalendarPrefillMatch[] = [];
  const safeLeadId =
    input.leadId == null
      ? undefined
      : requireSafeString(input.leadId, "leadId");

  const addMatch = (
    context: ServiceSchedulingContext,
    slot: AvailabilityWindow,
    meta: { localStartMinute: number; localEndMinute: number },
  ) => {
    matches.push({
      serviceId: context.serviceId,
      slot: {
        startTime: slot.startTime,
        endTime: slot.endTime,
        vetIds: slot.vetIds ?? [],
      },
      meta,
    });
  };

  for (const context of serviceContexts) {
    for (const utcDateShift of utcDateShifts) {
      const referenceDate = dayjs(input.date)
        .utc()
        .add(utcDateShift, "day")
        .toDate();

      const result = await buildBookableWindowsForVets({
        organisationId: context.organisationId,
        vetIds: context.vetIds,
        durationMinutes: context.durationMinutes,
        referenceDate,
        slotCache,
        getBookableSlotsForDate: (...args) =>
          AvailabilityService.getBookableSlotsForDate(...args),
      });

      for (const slot of result.windows as AvailabilityWindow[]) {
        if (safeLeadId && !(slot.vetIds ?? []).includes(safeLeadId)) {
          continue;
        }

        const meta = normalizeSlotForSelectedDay({
          timezone,
          utcDateShift,
          slot,
        });
        if (!meta) {
          continue;
        }

        if (
          Math.abs(meta.localStartMinute - input.minuteOfDay) >
          SLOT_MATCH_TOLERANCE_MINUTES
        ) {
          continue;
        }

        addMatch(context, slot, meta);
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
    return a.serviceId.localeCompare(b.serviceId);
  });

  return matches;
};

export const ServiceService = {
  async create(dto: ServiceRequestDTO) {
    let service: Service;
    try {
      service = fromServiceRequestDTO(dto);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("Expected FHIR HealthcareService")
      ) {
        throw new ServiceServiceError(error.message, 400);
      }
      throw error;
    }
    const organisationId = requireSafeString(
      service.organisationId,
      "organisationId",
    );
    const specialityId = service.specialityId
      ? requireSafeString(service.specialityId, "specialityId")
      : undefined;
    const observationToolId = service.observationToolId
      ? requireSafeString(service.observationToolId, "observationToolId")
      : undefined;

    const created = await prisma.service.create({
      data: {
        organisationId,
        name: service.name,
        description: service.description ?? undefined,
        durationMinutes: service.durationMinutes,
        cost: service.cost,
        maxDiscount: service.maxDiscount ?? undefined,
        specialityId,
        serviceType: service.serviceType,
        observationToolId,
        isActive: service.isActive,
      },
    });

    return toServiceResponseDTO(mapServiceRecordToDomain(created));
  },

  async createMany(dtos: ServiceRequestDTO[]) {
    if (!Array.isArray(dtos) || !dtos.length) {
      throw new ServiceServiceError("Payload list cannot be empty.", 400);
    }

    const results = [];
    for (const [index, dto] of dtos.entries()) {
      try {
        const created = await ServiceService.create(dto);
        results.push(created);
      } catch (error: unknown) {
        if (error instanceof ServiceServiceError) {
          throw new ServiceServiceError(
            `Item ${index}: ${error.message}`,
            error.statusCode,
          );
        }
        throw error;
      }
    }

    return results;
  },

  async getById(id: string) {
    const safeId = requireSafeString(id, "serviceId");
    const service = await prisma.service.findFirst({
      where: { id: safeId },
    });
    if (!service) return null;
    return toServiceResponseDTO(mapServiceRecordToDomain(service));
  },

  async listByOrganisation(organisationId: string) {
    const safeOrgId = requireSafeString(organisationId, "organisationId");
    const services = await prisma.service.findMany({
      where: { organisationId: safeOrgId, isActive: true },
    });
    return services.map((service) =>
      toServiceResponseDTO(mapServiceRecordToDomain(service)),
    );
  },

  async update(
    id: string,
    fhirDto: ServiceRequestDTO,
    organisationId?: string,
  ) {
    const serviceUpdates = fromServiceRequestDTO(fhirDto);

    const safeId = requireSafeString(id, "serviceId");
    const safeOrganisationId =
      organisationId !== undefined
        ? requireSafeString(organisationId, "organisationId")
        : undefined;

    const existing = await prisma.service.findFirst({ where: { id: safeId } });
    if (!existing) {
      throw new ServiceServiceError("Service not found", 404);
    }
    // Org binding: a service belonging to another organisation is treated as
    // not-found. Compared post-fetch (not via a query object built from the
    // user-supplied organisationId) to keep the lookup injection-safe.
    if (
      safeOrganisationId !== undefined &&
      existing.organisationId !== safeOrganisationId
    ) {
      throw new ServiceServiceError("Service not found", 404);
    }

    // Safe partial merge:
    const data: {
      name?: string;
      description?: string | null;
      durationMinutes?: number;
      cost?: number;
      maxDiscount?: number;
      serviceType?: ServiceType;
      observationToolId?: string | null;
      specialityId?: string;
      isActive?: boolean;
    } = {};

    if (serviceUpdates.name) data.name = serviceUpdates.name;
    if (serviceUpdates.description !== undefined)
      data.description = serviceUpdates.description;

    if (serviceUpdates.durationMinutes != null)
      data.durationMinutes = serviceUpdates.durationMinutes;

    if (serviceUpdates.cost != null) data.cost = serviceUpdates.cost;
    if (serviceUpdates.maxDiscount != null)
      data.maxDiscount = serviceUpdates.maxDiscount;

    if (serviceUpdates.serviceType) {
      data.serviceType = serviceUpdates.serviceType;
    }

    if (serviceUpdates.observationToolId !== undefined) {
      data.observationToolId = serviceUpdates.observationToolId
        ? requireSafeString(
            serviceUpdates.observationToolId,
            "observationToolId",
          )
        : null;
    }

    if (serviceUpdates.specialityId)
      data.specialityId = requireSafeString(
        serviceUpdates.specialityId,
        "specialityId",
      );

    if (serviceUpdates.isActive != null)
      data.isActive = serviceUpdates.isActive;

    const updated = await prisma.service.update({
      where: { id: safeId },
      data,
    });

    return toServiceResponseDTO(mapServiceRecordToDomain(updated));
  },

  async delete(id: string, organisationId?: string) {
    const safeId = requireSafeString(id, "serviceId");

    // Org binding: a service from another organisation is treated as not-found.
    const result = await prisma.service.deleteMany({
      where:
        organisationId === undefined
          ? { id: safeId }
          : {
              id: safeId,
              organisationId: requireSafeString(
                organisationId,
                "organisationId",
              ),
            },
    });

    if (result.count === 0) return null;

    return true;
  },

  async deleteAllBySpecialityId(specialityId: string) {
    await prisma.service.deleteMany({
      where: { specialityId },
    });
  },

  async search(query: string, organisationId?: string) {
    const where: {
      isActive: boolean;
      organisationId?: string;
      name?: { contains: string; mode: "insensitive" };
    } = { isActive: true };

    if (organisationId) {
      where.organisationId = requireSafeString(
        organisationId,
        "organisationId",
      );
    }

    if (query?.trim()) {
      where.name = { contains: query.trim(), mode: "insensitive" };
    }

    const services = await prisma.service.findMany({
      where,
      take: 50,
    });
    return services.map((service) =>
      toServiceResponseDTO(mapServiceRecordToDomain(service)),
    );
  },

  async listBySpeciality(specialityId: string) {
    const safeSpecId = requireSafeString(specialityId, "specialityId");
    const services = await prisma.service.findMany({
      where: { specialityId: safeSpecId, isActive: true },
    });
    return services.map((service) =>
      toServiceResponseDTO(mapServiceRecordToDomain(service)),
    );
  },

  async listOrganisationsProvidingService(serviceName: string) {
    return listOrganisationsProvidingServiceFromPostgres(serviceName);
  },

  async getBookableSlotsService(
    serviceId: string,
    organisationId: string,
    referenceDate: Date,
  ) {
    const context = await getServiceSchedulingContext(
      serviceId,
      organisationId,
    );

    return buildBookableWindowsForVets({
      organisationId: context.organisationId,
      vetIds: context.vetIds,
      durationMinutes: context.durationMinutes,
      referenceDate,
      getBookableSlotsForDate: (...args) =>
        AvailabilityService.getBookableSlotsForDate(...args),
    });
  },

  async getCalendarPrefillMatches(input: CalendarPrefillRequest) {
    const serviceIds = Array.from(
      new Set(
        input.serviceIds
          .map((serviceId) => requireSafeString(serviceId, "serviceId"))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    if (serviceIds.length === 0) {
      return [];
    }

    const safeOrganisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const safeLeadId = input.leadId
      ? requireSafeString(input.leadId, "leadId")
      : undefined;

    const cacheKey = JSON.stringify({
      organisationId: safeOrganisationId,
      date: dayjs(input.date).utc().format("YYYY-MM-DD"),
      minuteOfDay: input.minuteOfDay,
      leadId: safeLeadId ?? "",
      serviceIds,
    });

    return addCachedPromise(
      calendarPrefillCache,
      cacheKey,
      CALENDAR_PREFILL_CACHE_TTL_MS,
      async () => {
        const timezone = await resolveOrganisationTimezone({
          organisationId: safeOrganisationId,
          leadId: safeLeadId,
          getLeadPersonalDetails: async (organisationId, leadId) =>
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
            )?.personalDetails,
          getOrganisationPersonalDetails: async (organisationId) =>
            (
              await prisma.userProfile.findFirst({
                where: {
                  organizationId: organisationId,
                },
                select: {
                  personalDetails: true,
                },
              })
            )?.personalDetails,
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
          serviceIds.map((serviceId) =>
            getServiceSchedulingContext(serviceId, input.organisationId),
          ),
        );
        return collectCalendarPrefillMatches({
          input,
          timezone,
          serviceContexts: serviceContexts.filter(
            (context): context is ServiceSchedulingContext => Boolean(context),
          ),
          slotCache,
        });
      },
      {
        maxEntries: CALENDAR_PREFILL_CACHE_MAX_ENTRIES,
        pruneIntervalMs: CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS,
      },
    );
  },

  async listOrganisationsProvidingServiceNearby(
    serviceName: string,
    lat: number,
    lng: number,
    query?: string,
    radius = 5000,
  ) {
    const safeName = serviceName.trim();
    if (!safeName) return [];

    const matchedServices = await prisma.service.findMany({
      where: { name: { contains: safeName, mode: "insensitive" } },
      select: { organisationId: true },
    });
    if (!matchedServices.length) return [];

    const orgIds = [...new Set(matchedServices.map((s) => s.organisationId))];

    if (!lat && !lng) {
      const result = await helpers.getGeoLocation(query!);
      lat = result.lat;
      lng = result.lng;
    }

    const { latDelta, lngDelta } = getBoundingDeltas(lat, radius);

    const organisations = await prisma.organization.findMany({
      where: {
        id: { in: orgIds },
        address: {
          is: {
            latitude: { gte: lat - latDelta, lte: lat + latDelta },
            longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
          },
        },
      },
      include: { address: true },
    });

    const nearbyOrgs = filterWithinRadius(organisations, lat, lng, radius);

    const allSpecialities = await prisma.speciality.findMany({
      where: { organisationId: { in: orgIds } },
      select: { id: true, name: true, organisationId: true },
    });

    const allServicesForOrgs = await prisma.service.findMany({
      where: { organisationId: { in: orgIds } },
      select: {
        id: true,
        name: true,
        cost: true,
        specialityId: true,
        organisationId: true,
      },
    });

    return nearbyOrgs.map((org) => {
      const orgSpecialities = allSpecialities.filter(
        (s) => s.organisationId === org.id,
      );

      const orgServices = allServicesForOrgs.filter(
        (s) => s.organisationId === org.id,
      );

      const specialitiesWithServices = orgSpecialities.map((spec) => {
        const specServices = orgServices.filter(
          (srv) => srv.specialityId === spec.id,
        );

        return {
          ...spec,
          services: specServices,
        };
      });

      return {
        ...mapOrganisationWithAddress(org),
        specialities: specialitiesWithServices,
      };
    });
  },
};
