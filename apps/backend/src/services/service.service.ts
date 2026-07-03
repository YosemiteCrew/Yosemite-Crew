import { Types, type FilterQuery } from "mongoose";
import ServiceModel, {
  type ServiceMongo,
  type ServiceDocument,
} from "../models/service";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import {
  toServiceResponseDTO,
  fromServiceRequestDTO,
  ServiceRequestDTO,
  Service,
} from "@yosemite-crew/types";
import OrganizationModel, {
  type OrganizationMongo,
} from "src/models/organization";
import escapeStringRegexp from "escape-string-regexp";
import SpecialityModel from "src/models/speciality";
import { AvailabilitySlotMongo } from "src/models/base-availability";
import { AvailabilityService } from "./availability.service";
import helpers from "src/utils/helper";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { ServiceType } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";
import UserProfileModel from "src/models/user-profile";
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

const ensureObjectId = (id: string | Types.ObjectId, field: string) => {
  if (id instanceof Types.ObjectId) return id;
  if (!Types.ObjectId.isValid(id)) {
    throw new ServiceServiceError(`Invalid ${field}`, 400);
  }
  return new Types.ObjectId(id);
};

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

const listOrganisationsProvidingServiceFromMongo = async (
  serviceName: string,
) => {
  const safe = escapeStringRegexp(serviceName.trim());
  const searchRegex = new RegExp(safe);

  const services = (await ServiceModel.find({
    name: searchRegex,
  }).lean()) as Array<{ organisationId: Types.ObjectId }>;

  if (!services.length) return [];

  const orgIds = [...new Set(services.map((s) => s.organisationId.toString()))];
  const organisations = (await OrganizationModel.find({
    _id: { $in: orgIds },
  })
    .lean()
    .exec()) as Array<OrganizationMongo & { _id: Types.ObjectId }>;

  return organisations.map((org) =>
    mapOrganisationWithAddress({
      id: org._id.toString(),
      name: org.name,
      imageURL: org.imageURL,
      phoneNo: org.phoneNo,
      type: org.type,
      appointmentCheckInBufferMinutes: org.appointmentCheckInBufferMinutes,
      appointmentCheckInRadiusMeters: org.appointmentCheckInRadiusMeters,
      address: org.address,
    }),
  );
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

const mapDocToDomain = (doc: ServiceDocument): Service => {
  const o = doc.toObject() as ServiceMongo & { _id: Types.ObjectId };

  return mapServiceRecordToDomain({
    id: o._id.toString(),
    organisationId: o.organisationId.toString(),
    name: o.name,
    description: o.description ?? null,
    durationMinutes: o.durationMinutes,
    cost: o.cost,
    maxDiscount: o.maxDiscount ?? null,
    specialityId: o.specialityId?.toString() ?? null,
    serviceType: o.serviceType ?? "CONSULTATION",
    observationToolId: o.observationToolId?.toString() ?? null,
    isActive: o.isActive,
    createdAt: o.createdAt ?? o.updatedAt ?? new Date(),
    updatedAt: o.updatedAt ?? o.createdAt ?? new Date(),
  });
};

const toPrismaServiceData = (doc: ServiceDocument) => {
  const obj = doc.toObject() as ServiceMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    organisationId: obj.organisationId.toString(),
    name: obj.name,
    description: obj.description ?? undefined,
    durationMinutes: obj.durationMinutes,
    cost: obj.cost,
    maxDiscount: obj.maxDiscount ?? undefined,
    specialityId: obj.specialityId?.toString() ?? undefined,
    serviceType: obj.serviceType as ServiceType,
    observationToolId: obj.observationToolId?.toString() ?? undefined,
    isActive: obj.isActive ?? true,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncServiceToPostgres = async (doc: ServiceDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaServiceData(doc);
    await prisma.service.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Service", err);
  }
};

const getServiceSchedulingContext = async (
  serviceId: string,
  organisationId: string,
): Promise<ServiceSchedulingContext> => {
  if (isReadFromPostgres()) {
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
  }

  const id = ensureObjectId(serviceId, "serviceId");
  ensureObjectId(organisationId, "organisationId");

  const service = await ServiceModel.findById(id);
  if (!service) throw new Error("Service not found");

  const speciality = await SpecialityModel.findById(service.specialityId);
  if (!speciality) throw new Error("Speciality not found");

  return {
    serviceId: service._id.toString(),
    organisationId: service.organisationId.toString(),
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
    const orgId = ensureObjectId(service.organisationId, "organisationId");

    const mongoPayload: ServiceMongo = {
      organisationId: orgId,
      name: service.name,
      description: service.description ?? null,
      durationMinutes: service.durationMinutes,
      cost: service.cost,
      maxDiscount: service.maxDiscount ?? null,
      specialityId: service.specialityId
        ? ensureObjectId(service.specialityId, "specialityId")
        : null,
      serviceType: service.serviceType,
      observationToolId: service.observationToolId
        ? ensureObjectId(service.observationToolId, "observationToolId")
        : null,
      isActive: service.isActive,
    };

    const doc = await ServiceModel.create(mongoPayload);

    await syncServiceToPostgres(doc);

    return toServiceResponseDTO(mapDocToDomain(doc));
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
    if (isReadFromPostgres()) {
      const safeId = requireSafeString(id, "serviceId");
      const service = await prisma.service.findFirst({
        where: { id: safeId },
      });
      if (!service) return null;
      return toServiceResponseDTO(mapServiceRecordToDomain(service));
    }

    const oid = ensureObjectId(id, "serviceId");
    const doc = await ServiceModel.findById(oid);
    if (!doc) return null;
    return toServiceResponseDTO(mapDocToDomain(doc));
  },

  async listByOrganisation(organisationId: string) {
    if (isReadFromPostgres()) {
      const safeOrgId = requireSafeString(organisationId, "organisationId");
      const services = await prisma.service.findMany({
        where: { organisationId: safeOrgId, isActive: true },
      });
      return services.map((service) =>
        toServiceResponseDTO(mapServiceRecordToDomain(service)),
      );
    }

    const oid = ensureObjectId(organisationId, "organisationId");
    const docs = await ServiceModel.find({
      organisationId: oid,
      isActive: true,
    });

    return docs.map((d) => toServiceResponseDTO(mapDocToDomain(d)));
  },

  async update(id: string, fhirDto: ServiceRequestDTO) {
    const serviceUpdates = fromServiceRequestDTO(fhirDto);

    const oid = ensureObjectId(id, "serviceId");

    const doc = await ServiceModel.findById(oid);
    if (!doc) {
      throw new ServiceServiceError("Service not found", 404);
    }

    // Safe partial merge:
    if (serviceUpdates.name) doc.name = serviceUpdates.name;
    if (serviceUpdates.description !== undefined)
      doc.description = serviceUpdates.description;

    if (serviceUpdates.durationMinutes != null)
      doc.durationMinutes = serviceUpdates.durationMinutes;

    if (serviceUpdates.cost != null) doc.cost = serviceUpdates.cost;
    if (serviceUpdates.maxDiscount != null)
      doc.maxDiscount = serviceUpdates.maxDiscount;

    if (serviceUpdates.serviceType) {
      doc.serviceType = serviceUpdates.serviceType;
    }

    if (serviceUpdates.observationToolId !== undefined) {
      doc.observationToolId = serviceUpdates.observationToolId
        ? ensureObjectId(serviceUpdates.observationToolId, "observationToolId")
        : null;
    }

    if (serviceUpdates.specialityId)
      doc.specialityId = ensureObjectId(
        serviceUpdates.specialityId,
        "specialityId",
      );

    if (serviceUpdates.isActive != null) doc.isActive = serviceUpdates.isActive;

    await doc.save();

    await syncServiceToPostgres(doc);

    return toServiceResponseDTO(mapDocToDomain(doc));
  },

  async delete(id: string) {
    const oid = ensureObjectId(id, "serviceId");

    const doc = await ServiceModel.findById(oid);
    if (!doc) return null;

    await doc.deleteOne();

    if (shouldDualWrite) {
      try {
        await prisma.service.deleteMany({ where: { id: id } });
      } catch (err) {
        handleDualWriteError("Service delete", err);
      }
    }

    return true;
  },

  async deleteAllBySpecialityId(specialityId: string) {
    await ServiceModel.deleteMany({
      specialityId: specialityId,
    }).exec();

    if (shouldDualWrite) {
      try {
        await prisma.service.deleteMany({
          where: { specialityId },
        });
      } catch (err) {
        handleDualWriteError("Service deleteAllBySpecialityId", err);
      }
    }
  },

  async search(query: string, organisationId?: string) {
    if (isReadFromPostgres()) {
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
    }

    const filter: FilterQuery<ServiceMongo> = { isActive: true };

    if (organisationId) {
      filter.organisationId = ensureObjectId(organisationId, "organisationId");
    }

    const docs = await ServiceModel.find(
      query ? { ...filter, $text: { $search: query } } : filter,
    ).limit(50);

    return docs.map((d) => toServiceResponseDTO(mapDocToDomain(d)));
  },

  async listBySpeciality(specialityId: string) {
    if (isReadFromPostgres()) {
      const safeSpecId = requireSafeString(specialityId, "specialityId");
      const services = await prisma.service.findMany({
        where: { specialityId: safeSpecId, isActive: true },
      });
      return services.map((service) =>
        toServiceResponseDTO(mapServiceRecordToDomain(service)),
      );
    }

    const specId = ensureObjectId(specialityId, "specialityId");

    const docs = await ServiceModel.find({
      specialityId: specId,
      isActive: true,
    });

    return docs.map((d) => toServiceResponseDTO(mapDocToDomain(d)));
  },

  async listOrganisationsProvidingService(serviceName: string) {
    return isReadFromPostgres()
      ? listOrganisationsProvidingServiceFromPostgres(serviceName)
      : listOrganisationsProvidingServiceFromMongo(serviceName);
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
            isReadFromPostgres()
              ? (
                  await prisma.userProfile.findFirst({
                    where: {
                      organizationId: organisationId,
                      userId: leadId,
                    },
                    select: {
                      personalDetails: true,
                    },
                  })
                )?.personalDetails
              : (
                  await UserProfileModel.findOne({
                    organizationId: safeOrganisationId,
                    userId: leadId,
                  }).lean()
                )?.personalDetails,
          getOrganisationPersonalDetails: async (organisationId) =>
            isReadFromPostgres()
              ? (
                  await prisma.userProfile.findFirst({
                    where: {
                      organizationId: organisationId,
                    },
                    select: {
                      personalDetails: true,
                    },
                  })
                )?.personalDetails
              : (
                  await UserProfileModel.findOne({
                    organizationId: safeOrganisationId,
                  }).lean()
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
    if (isReadFromPostgres()) {
      const safeName = serviceName.trim();
      if (!safeName) return [];

      const matchedServices = await prisma.service.findMany({
        where: { name: { contains: safeName, mode: "insensitive" } },
        select: { organisationId: true },
      });
      if (!matchedServices.length) return [];

      const orgIds = [...new Set(matchedServices.map((s) => s.organisationId))];

      if (!lat && !lng) {
        const result = (await helpers.getGeoLocation(query!)) as {
          lat: number;
          lng: number;
        };
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
    }

    const safe = escapeStringRegexp(serviceName.trim());
    const searchRegex = new RegExp(safe, "i");

    // 1. Find services matching the name
    const matchedServices = (await ServiceModel.find({
      name: searchRegex,
    }).lean()) as Array<{ organisationId: Types.ObjectId }>;
    if (!matchedServices.length) return [];

    // 2. Extract unique organization IDs
    const orgIds = [...new Set(matchedServices.map((s) => s.organisationId))];

    // 3. If lat/lng missing, geocode
    if (!lat && !lng) {
      const result = (await helpers.getGeoLocation(query!)) as {
        lat: number;
        lng: number;
      };
      lat = result.lat;
      lng = result.lng;
    }

    // 4. Fetch only nearby organisations
    const organisations = (await OrganizationModel.find({
      _id: { $in: orgIds },
      "address.location": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: radius,
        },
      },
    }).lean()) as Array<OrganizationMongo & { _id: Types.ObjectId }>;

    // 5. Fetch specialities + all services for these organisations
    const allSpecialities = (await SpecialityModel.find(
      { organisationId: { $in: orgIds } },
      { _id: 1, name: 1, organisationId: 1 },
    ).lean()) as unknown as Array<{
      _id: Types.ObjectId;
      name: string;
      organisationId: string;
    }>;

    const allServicesForOrgs = (await ServiceModel.find(
      { organisationId: { $in: orgIds } },
      { _id: 1, name: 1, cost: 1, specialityId: 1, organisationId: 1 },
    ).lean()) as unknown as Array<{
      _id: Types.ObjectId;
      name: string;
      cost?: number;
      specialityId?: Types.ObjectId | string | null;
      organisationId: string;
    }>;

    // 6. Group specialities + services for each org
    return organisations.map((org) => {
      const orgSpecialities = allSpecialities.filter(
        (s) => s.organisationId === org._id.toString(),
      );

      const orgServices = allServicesForOrgs.filter(
        (s) => s.organisationId === org._id.toString(),
      );

      const specialitiesWithServices = orgSpecialities.map((spec) => {
        const specServices = orgServices.filter(
          (srv) => srv.specialityId?.toString() === spec._id.toString(),
        );

        return {
          ...spec,
          services: specServices,
        };
      });

      return {
        ...mapOrganisationWithAddress({
          id: org._id.toString(),
          name: org.name,
          imageURL: org.imageURL,
          phoneNo: org.phoneNo,
          type: org.type,
          appointmentCheckInBufferMinutes: org.appointmentCheckInBufferMinutes,
          appointmentCheckInRadiusMeters: org.appointmentCheckInRadiusMeters,
          address: org.address,
        }),
        specialities: specialitiesWithServices,
      };
    });
  },
};
