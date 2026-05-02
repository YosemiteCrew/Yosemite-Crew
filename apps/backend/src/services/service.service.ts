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
import OrganizationModel from "src/models/organization";
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

dayjs.extend(utc);

type BookableSlotWithVets = AvailabilitySlotMongo & {
  vetIds: string[];
};

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

type ServiceSchedulingContext = {
  serviceId: string;
  organisationId: string;
  durationMinutes: number;
  vetIds: string[];
};

type PreferredTimeZoneClock = {
  minutes: number;
  dayOffset: number;
};

type CachedPromise<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const DAY_MINUTES = 24 * 60;
const SLOT_MATCH_TOLERANCE_MINUTES = 5;
const CALENDAR_PREFILL_CACHE_TTL_MS = 15_000;
const UTC_CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OFFSET_TIMEZONE_REGEX = /^(?:UTC)?([+-])(\d{1,2}):(\d{2})$/;
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

const buildServiceDomain = (service: {
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
}): Service => ({
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

const mapPrismaToDomain = (service: {
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
}): Service => buildServiceDomain(service);

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const mapOrganisationWithAddress = (org: {
  id: string;
  name: string;
  imageUrl: string | null;
  phoneNo: string;
  type: string;
  appointmentCheckInBufferMinutes?: number | null;
  appointmentCheckInRadiusMeters?: number | null;
  address: {
    addressLine: string | null;
    country: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}) => ({
  id: org.id,
  name: org.name,
  imageURL: org.imageUrl ?? undefined,
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

const addCachedPromise = <T>(
  cache: Map<string, CachedPromise<T>>,
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
) => {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = factory().catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
};

const extractTimezoneFromPersonalDetails = (value: unknown): string | null => {
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

const parseDatePartsForTimeZone = (
  date: Date,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} => {
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

const utcClockTimeToTimezoneClock = (
  value: string,
  timezone: string,
): PreferredTimeZoneClock => {
  const match = UTC_CLOCK_TIME_REGEX.exec(value);
  if (!match) return { minutes: 0, dayOffset: 0 };

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

const resolveOrganisationTimezone = async (params: {
  organisationId: string;
  leadId?: string;
}) => {
  const safeOrganisationId = requireSafeString(
    params.organisationId,
    "organisationId",
  );
  const safeLeadId = params.leadId
    ? requireSafeString(params.leadId, "leadId")
    : undefined;

  if (isReadFromPostgres()) {
    if (safeLeadId) {
      const leadProfile = await prisma.userProfile.findFirst({
        where: {
          organizationId: safeOrganisationId,
          userId: safeLeadId,
        },
        select: {
          personalDetails: true,
        },
      });

      const leadTimezone = extractTimezoneFromPersonalDetails(
        leadProfile?.personalDetails,
      );
      if (leadTimezone) return leadTimezone;
    }

    const orgProfile = await prisma.userProfile.findFirst({
      where: {
        organizationId: safeOrganisationId,
      },
      select: {
        personalDetails: true,
      },
    });

    return (
      extractTimezoneFromPersonalDetails(orgProfile?.personalDetails) ?? "UTC"
    );
  }

  if (safeLeadId) {
    const leadProfile = await UserProfileModel.findOne({
      organizationId: safeOrganisationId,
      userId: safeLeadId,
    }).lean();

    const leadTimezone = extractTimezoneFromPersonalDetails(
      leadProfile?.personalDetails,
    );
    if (leadTimezone) return leadTimezone;
  }

  const orgProfile = await UserProfileModel.findOne({
    organizationId: safeOrganisationId,
  }).lean();

  return (
    extractTimezoneFromPersonalDetails(orgProfile?.personalDetails) ?? "UTC"
  );
};

const normalizeSlotForSelectedDay = (params: {
  timezone: string;
  utcDateShift: number;
  slot: BookableSlotWithVets;
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

const buildBookableWindowsForVets = async (params: {
  organisationId: string;
  vetIds: string[];
  durationMinutes: number;
  referenceDate: Date;
  slotCache?: Map<
    string,
    Promise<{
      date: string;
      dayOfWeek: string;
      windows: AvailabilitySlotMongo[];
    }>
  >;
}) => {
  if (params.vetIds.length === 0) {
    return {
      date: params.referenceDate,
      windows: [],
    };
  }

  const allSlots: Array<BookableSlotWithVets> = [];

  for (const vetId of params.vetIds) {
    const cacheKey = [
      params.organisationId,
      vetId,
      params.durationMinutes,
      dayjs(params.referenceDate).utc().format("YYYY-MM-DD"),
    ].join("|");

    const cachedResult = params.slotCache?.get(cacheKey);
    const resultPromise =
      cachedResult ??
      AvailabilityService.getBookableSlotsForDate(
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

  const slotMap = new Map<string, BookableSlotWithVets>();

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

const mapDocToDomain = (doc: ServiceDocument): Service => {
  const o = doc.toObject() as ServiceMongo & { _id: Types.ObjectId };

  return buildServiceDomain({
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
      return toServiceResponseDTO(mapPrismaToDomain(service));
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
        toServiceResponseDTO(mapPrismaToDomain(service)),
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
        toServiceResponseDTO(mapPrismaToDomain(service)),
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
        toServiceResponseDTO(mapPrismaToDomain(service)),
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
    if (isReadFromPostgres()) {
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
    }

    const safe = escapeStringRegexp(serviceName.trim());
    const searchRegex = new RegExp(safe);

    // 1. Find matching services
    const services = await ServiceModel.find({
      name: searchRegex,
    }).lean();

    if (!services.length) return [];

    // 2. Extract unique organisation IDs
    const orgIds = [
      ...new Set(services.map((s) => s.organisationId.toString())),
    ];

    // 3. Fetch organisations
    const organisations = await OrganizationModel.find({
      _id: { $in: orgIds },
      //isActive: true,
    })
      .lean()
      .exec();

    return organisations.map((org) => ({
      id: org._id.toString(),
      name: org.name,
      imageURL: org.imageURL,
      phoneNo: org.phoneNo,
      type: org.type,
      appointmentCheckInBufferMinutes: org.appointmentCheckInBufferMinutes ?? 5,
      appointmentCheckInRadiusMeters: org.appointmentCheckInRadiusMeters ?? 200,
      address: org.address,
    }));
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
    });
  },

  async getCalendarPrefillMatches(input: CalendarPrefillRequest) {
    const serviceIds = Array.from(
      new Set(
        input.serviceIds
          .map((serviceId) => requireSafeString(serviceId, "serviceId"))
          .filter(Boolean),
      ),
    );

    if (serviceIds.length === 0) {
      return [];
    }

    const cacheKey = JSON.stringify({
      organisationId: requireSafeString(input.organisationId, "organisationId"),
      date: dayjs(input.date).utc().format("YYYY-MM-DD"),
      minuteOfDay: input.minuteOfDay,
      leadId: input.leadId ? requireSafeString(input.leadId, "leadId") : "",
      serviceIds,
    });

    return addCachedPromise(
      calendarPrefillCache,
      cacheKey,
      CALENDAR_PREFILL_CACHE_TTL_MS,
      async () => {
        const timezone = await resolveOrganisationTimezone({
          organisationId: input.organisationId,
          leadId: input.leadId,
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

        const utcDateShifts = [-1, 0, 1] as const;
        const matches: CalendarPrefillMatch[] = [];

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
            });

            for (const slot of result.windows) {
              if (
                input.leadId &&
                !(slot.vetIds ?? []).includes(
                  requireSafeString(input.leadId, "leadId"),
                )
              ) {
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

              matches.push({
                serviceId: context.serviceId,
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
          return a.serviceId.localeCompare(b.serviceId);
        });

        return matches;
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

      const metersPerDegreeLat = 111000;
      const latDelta = radius / metersPerDegreeLat;
      const lngDelta = radius / (metersPerDegreeLat * Math.cos(toRadians(lat)));

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

      const nearbyOrgs = organisations.filter((org) => {
        if (!org.address?.latitude || !org.address?.longitude) {
          return false;
        }
        const distance = calculateDistanceMeters(
          lat,
          lng,
          org.address.latitude,
          org.address.longitude,
        );
        return distance <= radius;
      });

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
    const matchedServices = await ServiceModel.find({
      name: searchRegex,
    }).lean();
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
    const organisations = await OrganizationModel.find({
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
    }).lean();

    // 5. Fetch specialities + all services for these organisations
    const allSpecialities = await SpecialityModel.find(
      { organisationId: { $in: orgIds } },
      { _id: 1, name: 1, organisationId: 1 },
    ).lean();

    const allServicesForOrgs = await ServiceModel.find(
      { organisationId: { $in: orgIds } },
      { _id: 1, name: 1, cost: 1, specialityId: 1, organisationId: 1 },
    ).lean();

    // 6. Group specialities + services for each org
    return organisations.map((org) => {
      const orgSpecialities = allSpecialities.filter(
        (s) => s.organisationId.toString() === org._id.toString(),
      );

      const orgServices = allServicesForOrgs.filter(
        (s) => s.organisationId.toString() === org._id.toString(),
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
        id: org._id.toString(),
        name: org.name,
        imageURL: org.imageURL,
        phoneNo: org.phoneNo,
        type: org.type,
        appointmentCheckInBufferMinutes:
          org.appointmentCheckInBufferMinutes ?? 5,
        appointmentCheckInRadiusMeters:
          org.appointmentCheckInRadiusMeters ?? 200,
        address: org.address,
        specialities: specialitiesWithServices,
      };
    });
  },
};
