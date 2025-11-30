import { Types, type FilterQuery } from "mongoose";
import ServiceModel, {
  type ServiceMongo,
  type ServiceDocument,
} from "../models/service";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
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

dayjs.extend(utc);

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

const mapDocToDomain = (doc: ServiceDocument): Service => {
  const o = doc.toObject() as ServiceMongo & { _id: Types.ObjectId };

  return {
    id: o._id.toString(),
    organisationId: o.organisationId.toString(),
    name: o.name,
    description: o.description ?? null,
    durationMinutes: o.durationMinutes,
    cost: o.cost,
    maxDiscount: o.maxDiscount ?? null,
    specialityId: o.specialityId?.toString() ?? null,
    headOfServiceId: o.headOfServiceId ?? null,
    teamMemberIds: o.teamMemberIds ?? [],
    isActive: o.isActive,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

export const ServiceService = {
  async create(dto: ServiceRequestDTO) {
    const service = fromServiceRequestDTO(dto);
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
      headOfServiceId: service.headOfServiceId ?? null,
      teamMemberIds: service.teamMemberIds ?? [],
      isActive: service.isActive,
    };

    const doc = await ServiceModel.create(mongoPayload);

    return toServiceResponseDTO(mapDocToDomain(doc));
  },

  async getById(id: string) {
    const oid = ensureObjectId(id, "serviceId");
    const doc = await ServiceModel.findById(oid);
    if (!doc) return null;
    return toServiceResponseDTO(mapDocToDomain(doc));
  },

  async listByOrganisation(organisationId: string) {
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

    if (serviceUpdates.specialityId)
      doc.specialityId = ensureObjectId(
        serviceUpdates.specialityId,
        "specialityId",
      );

    if (serviceUpdates.headOfServiceId != null)
      doc.headOfServiceId = serviceUpdates.headOfServiceId;

    if (Array.isArray(serviceUpdates.teamMemberIds))
      doc.teamMemberIds = serviceUpdates.teamMemberIds;

    if (serviceUpdates.isActive != null) doc.isActive = serviceUpdates.isActive;

    await doc.save();

    return toServiceResponseDTO(mapDocToDomain(doc));
  },

  async delete(id: string) {
    const oid = ensureObjectId(id, "serviceId");

    const doc = await ServiceModel.findById(oid);
    if (!doc) return null;

    await doc.deleteOne();

    return true;
  },

  async search(query: string, organisationId?: string) {
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
    const specId = ensureObjectId(specialityId, "specialityId");

    const docs = await ServiceModel.find({
      specialityId: specId,
      isActive: true,
    });

    return docs.map((d) => toServiceResponseDTO(mapDocToDomain(d)));
  },

  async listOrganisationsProvidingService(serviceName: string) {
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
      address: org.address,
    }));
  },

  async getBookableSlotsService(
    serviceId: string,
    organisationId: string,
    referenceDate: Date,
  ) {
    const id = ensureObjectId(serviceId, "serviceId");

    const service = await ServiceModel.findOne({ _id: id });
    if (!service) throw new Error("Service not found");

    const { specialityId, durationMinutes } = service;

    const speciality = await SpecialityModel.findById(specialityId);
    if (!speciality) throw new Error("Speciality not found");

    const vetIds = speciality.memberUserIds || [];

    if (vetIds.length === 0) {
      return {
        date: referenceDate,
        windows: [],
      };
    }

    const allWindows: AvailabilitySlotMongo[] = [];

    for (const vetId of vetIds) {
      const result = await AvailabilityService.getBookableSlotsForDate(
        organisationId,
        vetId,
        durationMinutes,
        referenceDate,
      );

      if (result?.windows?.length) {
        allWindows.push(...result.windows);
      }
    }

    const uniqueSlotsMap = new Map<string, AvailabilitySlotMongo>();

    for (const w of allWindows) {
      const key = `${w.startTime}-${w.endTime}`;
      uniqueSlotsMap.set(key, w);
    }

    let finalWindows: AvailabilitySlotMongo[] = Array.from(
      uniqueSlotsMap.values(),
    );

    // Remove past slots if referenceDate == today
    const todayStr = dayjs().utc().format("YYYY-MM-DD");
    const refStr = dayjs(referenceDate).utc().format("YYYY-MM-DD");

    if (refStr === todayStr) {
      const now = dayjs().utc();

      finalWindows = finalWindows.filter((slot) => {
        const slotTime = dayjs(`${refStr} ${slot.startTime}`).utc();
        return slotTime.isAfter(now);
      });
    }

    // Sort ascending by time
    finalWindows.sort((a, b) => {
      const t1 = dayjs(`2000-01-01 ${a.startTime}`);
      const t2 = dayjs(`2000-01-01 ${b.startTime}`);
      return t1.valueOf() - t2.valueOf();
    });

    return {
      date: refStr,
      dayOfWeek: dayjs(referenceDate).utc().format("dddd").toUpperCase(),
      windows: finalWindows,
    };
  },

  async listOrganisationsProvidingServiceNearby(
    serviceName: string,
    lat: number,
    lng: number,
    query?: string,
    radius = 5000,
  ) {
    const safe = escapeStringRegexp(serviceName.trim());
    const searchRegex = new RegExp(safe, "i");

    // 1. Find services matching the name
    const matchedServices = await ServiceModel.find({ name: searchRegex }).lean();
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
      { _id: 1, name: 1, organisationId: 1 }
    ).lean();

    const allServicesForOrgs = await ServiceModel.find(
      { organisationId: { $in: orgIds } },
      { _id: 1, name: 1, cost: 1, specialityId: 1, organisationId: 1 }
    ).lean();

    // 6. Group specialities + services for each org
    return organisations.map((org) => {
      const orgSpecialities = allSpecialities.filter(
        (s) => s.organisationId.toString() === org._id.toString()
      );

      const orgServices = allServicesForOrgs.filter(
        (s) => s.organisationId.toString() === org._id.toString()
      );

      const specialitiesWithServices = orgSpecialities.map((spec) => {
        const specServices = orgServices.filter(
          (srv) =>
            srv.specialityId?.toString() === spec._id.toString()
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
        address: org.address,
        specialities: specialitiesWithServices,
      };
    });
  },
};
