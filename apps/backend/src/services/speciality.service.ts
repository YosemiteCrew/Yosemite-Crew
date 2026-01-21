import { isValidObjectId, Types } from "mongoose";
import SpecialityModel, {
  type SpecialityDocument,
  type SpecialityMongo,
} from "../models/speciality";
import {
  fromSpecialityRequestDTO,
  toSpecialityResponseDTO,
  type SpecialityDTOAttributes,
  type SpecialityRequestDTO,
  type SpecialityResponseDTO,
} from "@yosemite-crew/types";
import { ServiceService } from "./service.service";
import OrganisationRoomModel from "src/models/organisation-room";

export type SpecialityFHIRPayload = SpecialityRequestDTO;

export class SpecialityServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SpecialityServiceError";
  }
}

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const cleaned = (value as unknown[])
      .map((item) => pruneUndefined(item))
      .filter((item) => item !== undefined);
    return cleaned as unknown as T;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    const record = value as Record<string, unknown>;
    const cleanedRecord: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(record)) {
      const next = pruneUndefined(entryValue);

      if (next !== undefined) {
        cleanedRecord[key] = next;
      }
    }

    return cleanedRecord as unknown as T;
  }

  return value;
};

const requireSafeString = (value: unknown, fieldName: string): string => {
  if (value == null) {
    throw new SpecialityServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new SpecialityServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new SpecialityServiceError(`${fieldName} cannot be empty.`, 400);
  }

  if (trimmed.includes("$")) {
    throw new SpecialityServiceError(`Invalid character in ${fieldName}.`, 400);
  }

  return trimmed;
};

const optionalSafeString = (
  value: unknown,
  fieldName: string,
): string | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new SpecialityServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("$")) {
    throw new SpecialityServiceError(`Invalid character in ${fieldName}.`, 400);
  }

  return trimmed;
};

const ensureSafeIdentifier = (value: unknown): string | undefined => {
  const identifier = optionalSafeString(value, "Identifier");

  if (!identifier) {
    return undefined;
  }

  if (
    !isValidObjectId(identifier) &&
    !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)
  ) {
    throw new SpecialityServiceError("Invalid identifier format.", 400);
  }

  return identifier;
};

const requireOrganizationId = (value: unknown): string => {
  const identifier = requireSafeString(value, "Organisation identifier");

  if (
    !isValidObjectId(identifier) &&
    !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)
  ) {
    throw new SpecialityServiceError(
      "Invalid organisation identifier format.",
      400,
    );
  }

  return identifier;
};

const sanitizeServices = (services: unknown): string[] | undefined => {
  if (!Array.isArray(services)) {
    return undefined;
  }

  const cleaned = services
    .map((service, index) => {
      const value = optionalSafeString(service, `Service at index ${index}`);
      return value ?? undefined;
    })
    .filter((service): service is string => service !== undefined);

  return cleaned.length ? cleaned : undefined;
};

const sanitizeSpecialityAttributes = (
  dto: SpecialityDTOAttributes,
): SpecialityMongo => {
  const organisationId = requireOrganizationId(dto.organisationId);
  const name = requireSafeString(dto.name, "Speciality name");

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    organisationId,
    departmentMasterId: optionalSafeString(
      dto.departmentMasterId,
      "Department master identifier",
    ),
    name,

    headUserId: optionalSafeString(dto.headUserId, "Head user identifier"),
    headName: optionalSafeString(dto.headName, "Head name"),
    headProfilePicUrl: optionalSafeString(
      dto.headProfilePicUrl,
      "Head profile picture URL",
    ),
    services: sanitizeServices(dto.services),
    createdAt: dto.createdAt instanceof Date ? dto.createdAt : undefined,
    updatedAt: dto.updatedAt instanceof Date ? dto.updatedAt : undefined,
  };
};

const buildDomainSpeciality = (document: SpecialityDocument) => {
  const { _id, ...rest } = document.toObject({
    virtuals: false,
  }) as SpecialityMongo & {
    _id: Types.ObjectId;
  };

  return {
    _id: rest.fhirId ?? _id.toString(),
    organisationId: rest.organisationId,
    departmentMasterId: rest.departmentMasterId,
    name: rest.name,
    description: rest.description,
    headUserId: rest.headUserId,
    headName: rest.headName,
    headProfilePicUrl: rest.headProfilePicUrl,
    services: rest.services,
    teamMemberIds: rest.memberUserIds,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
};

const buildFHIRResponse = (
  document: SpecialityDocument,
): SpecialityResponseDTO => {
  const speciality = buildDomainSpeciality(document);
  return toSpecialityResponseDTO(speciality);
};

const createPersistableFromFHIR = (payload: SpecialityFHIRPayload) => {
  if (payload?.resourceType !== "Organization") {
    throw new SpecialityServiceError(
      "Invalid payload. Expected FHIR Organization resource.",
      400,
    );
  }

  const attributes = fromSpecialityRequestDTO(payload);
  const persistable = pruneUndefined(sanitizeSpecialityAttributes(attributes));

  return { attributes, persistable };
};

const resolveIdQuery = (id: unknown): { _id?: string; fhirId?: string } => {
  const identifier = optionalSafeString(id, "Speciality identifier");

  if (!identifier) {
    throw new SpecialityServiceError("Speciality identifier is required.", 400);
  }

  if (isValidObjectId(identifier)) {
    return { _id: identifier };
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    return { fhirId: identifier };
  }

  throw new SpecialityServiceError(
    "Invalid speciality identifier format.",
    400,
  );
};

export const SpecialityService = {
  async createOne(payload: SpecialityFHIRPayload) {
    const { persistable, attributes } = createPersistableFromFHIR(payload);

    const identifier =
      ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id);

    let document: SpecialityDocument | null = null;
    let created = false;

    if (identifier) {
      document = await SpecialityModel.findOneAndUpdate(
        { fhirId: identifier },
        { $set: persistable },
        { new: true, sanitizeFilter: true },
      );
    }

    if (!document) {
      document = await SpecialityModel.create(persistable);
      created = true;
    }

    const response = buildFHIRResponse(document);
    return { response, created };
  },

  async createMany(payloads: SpecialityFHIRPayload[]) {
    if (!Array.isArray(payloads) || !payloads.length) {
      throw new SpecialityServiceError("Payload list cannot be empty.", 400);
    }

    const results: SpecialityResponseDTO[] = [];

    for (const payload of payloads) {
      const { response } = await SpecialityService.createOne(payload);
      results.push(response);
    }

    return results;
  },

  async update(id: string, payload: SpecialityFHIRPayload) {
    const query = resolveIdQuery(id);
    const { persistable } = createPersistableFromFHIR(payload);

    const document = await SpecialityModel.findOneAndUpdate(
      query,
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document);
  },

  async getById(id: string) {
    const query = resolveIdQuery(id);

    const document = await SpecialityModel.findOne(query).exec();

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document);
  },

  async getAllByOrganizationId(organisationId: string) {
    const orgId = requireOrganizationId(organisationId);

    const documents = await SpecialityModel.find({
      organisationId: orgId,
    }).exec();

    const result = [];

    for (const speciality of documents) {
      const specialityFHIR = buildFHIRResponse(speciality);
      const services = await ServiceService.listBySpeciality(
        speciality._id.toString(),
      );
      result.push({
        speciality: specialityFHIR,
        services: services,
      });
    }

    return result;
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireOrganizationId(organisationId);

    await SpecialityModel.deleteMany({ organisationId: orgId }).exec();
  },

  async deleteSpeciality(specialityId: string, organisationId: string) {
    const query = resolveIdQuery(specialityId);
    const orgId = requireOrganizationId(organisationId);

    const document = await SpecialityModel.findOneAndDelete(
      {
        ...query,
        organisationId: orgId,
      },
      { sanitizeFilter: true },
    );

    if (!document) {
      throw new SpecialityServiceError(
        "Speciality not found for the organisation.",
        404,
      );
    }

    await ServiceService.deleteAllBySpecialityId(document._id.toString());

    await OrganisationRoomModel.updateMany(
      { assignedSpecialiteis: query._id ?? query.fhirId },
      { $pull: { assignedSpecialiteis: specialityId } },
      { sanitizeFilter: true },
    );
  },
};
