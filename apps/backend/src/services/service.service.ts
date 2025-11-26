import { Types } from "mongoose";
import ServiceModel, {
  type ServiceMongo,
  type ServiceDocument,
} from "../models/service";

import {
  toServiceResponseDTO,
  fromServiceRequestDTO,
  ServiceRequestDTO,
  Service,
} from "@yosemite-crew/types";
import OrganizationModel from "src/models/organization";
import escapeStringRegexp from "escape-string-regexp";

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

  async update(id: string, fhirDto: any) {
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
    const filter: any = {
      isActive: true,
    };

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
      isActive: true,
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
};
