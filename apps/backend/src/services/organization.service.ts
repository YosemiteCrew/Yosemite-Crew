import { isValidObjectId, Types } from "mongoose";
import OrganizationModel, {
  type OrganizationDocument,
  type OrganizationMongo,
} from "../models/organization";
import {
  fromOrganizationRequestDTO,
  toOrganizationResponseDTO,
  type OrganizationRequestDTO,
  type OrganizationResponseDTO,
  type OrganizationDTOAttributes,
  type Organisation,
  type ToFHIROrganizationOptions,
  UserOrganization,
} from "@yosemite-crew/types";
import { UserOrganizationService } from "./user-organization.service";
import { SpecialityService } from "./speciality.service";
import { OrganisationRoomService } from "./organisation-room.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import escapeStringRegexp from "escape-string-regexp";
import SpecialityModel from "src/models/speciality";
import ServiceModel from "src/models/service";
import logger from "src/utils/logger";
import UserProfileModel from "src/models/user-profile";
import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";

const TAX_ID_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/taxId";
const TAX_IDENTIFIER_SYSTEM =
  "http://example.org/fhir/NamingSystem/organisation-tax-id";
const IMAGE_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/organisation-image";
const HEALTH_SAFETY_CERT_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/healthAndSafetyCertificationNumber";
const ANIMAL_WELFARE_CERT_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/animalWelfareComplianceCertificationNumber";
const FIRE_EMERGENCY_CERT_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/fireAndEmergencyCertificationNumber";
const GOOGLE_PLACE_ID_EXTENSION_URL =
  "http://example.com/fhir/StructureDefinition/google-place-id";
const ORGANIZATION_TYPES = new Set<Organisation["type"]>([
  "HOSPITAL",
  "BREEDER",
  "BOARDER",
  "GROOMER",
]);

type ExtensionLike = {
  url?: string;
  valueString?: string;
  valueUrl?: string;
};

type ExtensionContainer = {
  extension?: ExtensionLike[];
};

export type OrganizationFHIRPayload = OrganizationRequestDTO &
  ExtensionContainer & {
    identifier?: Array<{ value?: string; system?: string }>;
  };

export interface OrganisationSearchInput {
  placeId?: string;
  lat?: number;
  lng?: number;
  name?: string;
  addressLine?: string;
}

export interface OrganisationSearchResult {
  isPmsOrganisation: boolean;
  organisation?: OrganizationResponseDTO;
}

export class OrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OrganizationServiceError";
  }
}

const findExtensionValue = (
  extensions: ExtensionLike[] | undefined,
  url: string,
): string | undefined => {
  const extension = extensions?.find((item) => item.url === url);
  return extension?.valueString ?? extension?.valueUrl;
};

const extractTaxId = (
  organization: OrganizationFHIRPayload,
): string | undefined => {
  const fromExtension = findExtensionValue(
    organization.extension,
    TAX_ID_EXTENSION_URL,
  );

  if (fromExtension) {
    return fromExtension;
  }

  const identifierMatch = organization.identifier?.find(
    (item) =>
      item?.system === TAX_IDENTIFIER_SYSTEM && typeof item?.value === "string",
  );

  if (identifierMatch?.value) {
    return identifierMatch.value;
  }

  return organization.identifier?.find(
    (item) => typeof item?.value === "string",
  )?.value;
};

const extractImageUrl = (
  organization: OrganizationFHIRPayload,
): string | undefined =>
  findExtensionValue(organization.extension, IMAGE_EXTENSION_URL);

const extractCertificateValue = (
  organization: OrganizationFHIRPayload,
  url: string,
): string | undefined => findExtensionValue(organization.extension, url);

const sanitizeTypeCoding = (
  typeCoding: ToFHIROrganizationOptions["typeCoding"] | undefined,
): ToFHIROrganizationOptions["typeCoding"] | undefined => {
  if (!typeCoding) {
    return undefined;
  }

  const system = optionalSafeString(
    typeCoding.system,
    "Organization type system",
  );
  const code = optionalSafeString(typeCoding.code, "Organization type code");

  if (!system || !code) {
    return undefined;
  }

  return {
    system,
    code,
    display: optionalSafeString(
      typeCoding.display,
      "Organization type display",
    ),
  };
};

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];
    const cleaned: unknown[] = arrayValue
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
    throw new OrganizationServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new OrganizationServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new OrganizationServiceError(`${fieldName} cannot be empty.`, 400);
  }

  if (trimmed.includes("$")) {
    throw new OrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
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
    throw new OrganizationServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("$")) {
    throw new OrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const optionalNumber = (
  value: unknown,
  fieldName: string,
): number | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new OrganizationServiceError(
    `${fieldName} must be a valid number.`,
    400,
  );
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
    throw new OrganizationServiceError("Invalid identifier format.", 400);
  }

  return identifier;
};

const requireOrganizationType = (value: unknown): Organisation["type"] => {
  if (typeof value !== "string") {
    throw new OrganizationServiceError(
      "Organization type must be a string.",
      400,
    );
  }

  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    throw new OrganizationServiceError(
      "Organization type cannot be empty.",
      400,
    );
  }

  if (!ORGANIZATION_TYPES.has(normalized as Organisation["type"])) {
    throw new OrganizationServiceError("Invalid organization type.", 400);
  }

  return normalized as Organisation["type"];
};

const coerceOrganizationType = (value: unknown): Organisation["type"] => {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();

    if (ORGANIZATION_TYPES.has(normalized as Organisation["type"])) {
      return normalized as Organisation["type"];
    }
  }

  return "HOSPITAL";
};

const sanitizeAddress = (
  address: OrganizationDTOAttributes["address"],
): OrganizationMongo["address"] | undefined => {
  if (!address) {
    return undefined;
  }

  const sanitized: OrganizationMongo["address"] = {
    addressLine: optionalSafeString(address.addressLine, "Address line"),
    country: optionalSafeString(address.country, "Address country"),
    city: optionalSafeString(address.city, "Address city"),
    state: optionalSafeString(address.state, "Address state"),
    postalCode: optionalSafeString(address.postalCode, "Postal code"),
    latitude: optionalNumber(address.latitude, "Address latitude"),
    longitude: optionalNumber(address.longitude, "Address longitude"),
  };

  if (address?.latitude && address?.longitude) {
    sanitized.location = {
      type: "Point",
      coordinates: [address.longitude, address.latitude],
    };
  }

  return sanitized;
};

const sanitizeBusinessAttributes = (
  dto: OrganizationDTOAttributes,
  extras: {
    taxId?: string;
    imageURL?: string;
    healthAndSafetyCertNo?: string;
    animalWelfareComplianceCertNo?: string;
    fireAndEmergencyCertNo?: string;
    googlePlacesId?: string;
  },
): OrganizationMongo => {
  const name = requireSafeString(dto.name, "Organization name");
  const taxId = requireSafeString(extras.taxId ?? dto.taxId, "Tax ID");
  const imageURL = optionalSafeString(
    dto.imageURL ?? extras.imageURL,
    "Image URL",
  );
  const typeCoding = sanitizeTypeCoding(dto.typeCoding);
  const website = optionalSafeString(dto.website, "Website");
  const DUNSNumber = optionalSafeString(dto.DUNSNumber, "DUNS number");
  const phoneNo = requireSafeString(dto.phoneNo, "Phone number");
  const type = requireOrganizationType(dto.type);
  const address = sanitizeAddress(dto.address);
  const healthAndSafetyCertNo = optionalSafeString(
    dto.healthAndSafetyCertNo ?? extras.healthAndSafetyCertNo,
    "Health & Safety certification number",
  );
  const animalWelfareComplianceCertNo = optionalSafeString(
    dto.animalWelfareComplianceCertNo ?? extras.animalWelfareComplianceCertNo,
    "Animal welfare compliance certification number",
  );
  const fireAndEmergencyCertNo = optionalSafeString(
    dto.fireAndEmergencyCertNo ?? extras.fireAndEmergencyCertNo,
    "Fire & emergency certification number",
  );
  const googlePlacesId = optionalSafeString(
    dto.googlePlacesId ?? extras.googlePlacesId,
    "Google Places ID",
  );

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    name,
    taxId,
    DUNSNumber,
    imageURL,
    type,
    phoneNo,
    website,
    address,
    isVerified:
      dto.isVerified === undefined ? undefined : Boolean(dto.isVerified),
    isActive: dto.isActive === undefined ? undefined : Boolean(dto.isActive),
    typeCoding,
    healthAndSafetyCertNo,
    animalWelfareComplianceCertNo,
    fireAndEmergencyCertNo,
    googlePlacesId,
  };
};

const buildFHIRResponse = (
  document: OrganizationDocument,
  options?: ToFHIROrganizationOptions,
): ReturnType<typeof toOrganizationResponseDTO> => {
  const { typeCoding, ...rest } = document.toObject({
    virtuals: false,
  }) as OrganizationMongo & {
    _id: Types.ObjectId;
  };

  const organisation: Organisation = {
    _id: rest.fhirId ?? document._id,
    name: rest.name,
    taxId: rest.taxId ?? "",
    DUNSNumber: rest.DUNSNumber,
    imageURL: rest.imageURL,
    type: coerceOrganizationType(rest.type),
    phoneNo: rest.phoneNo ?? "",
    website: rest.website,
    address: rest.address
      ? {
          addressLine: rest.address.addressLine,
          country: rest.address.country,
          city: rest.address.city,
          state: rest.address.state,
          postalCode: rest.address.postalCode,
          latitude: rest.address.latitude,
          longitude: rest.address.longitude,
        }
      : undefined,
    isVerified: rest.isVerified,
    isActive: rest.isActive,
    healthAndSafetyCertNo: rest.healthAndSafetyCertNo,
    animalWelfareComplianceCertNo: rest.animalWelfareComplianceCertNo,
    fireAndEmergencyCertNo: rest.fireAndEmergencyCertNo,
    googlePlacesId: rest.googlePlacesId,
    stripeAccountId: rest.stripeAccountId,
  };

  const responseOptions = options ?? (typeCoding ? { typeCoding } : undefined);

  return toOrganizationResponseDTO(organisation, responseOptions);
};

const resolveIdQuery = (id: unknown) => {
  const identifier = ensureSafeIdentifier(id);

  if (!identifier) {
    throw new OrganizationServiceError(
      "Organization identifier is required.",
      400,
    );
  }

  return Types.ObjectId.isValid(identifier)
    ? { _id: identifier }
    : { fhirId: identifier };
};

const createPersistableFromFHIR = (payload: OrganizationFHIRPayload) => {
  const attributes = fromOrganizationRequestDTO(payload);

  const taxId = extractTaxId(payload);
  const imageURL = extractImageUrl(payload);
  const healthAndSafetyCertNo = extractCertificateValue(
    payload,
    HEALTH_SAFETY_CERT_EXTENSION_URL,
  );
  const animalWelfareComplianceCertNo = extractCertificateValue(
    payload,
    ANIMAL_WELFARE_CERT_EXTENSION_URL,
  );
  const fireAndEmergencyCertNo = extractCertificateValue(
    payload,
    FIRE_EMERGENCY_CERT_EXTENSION_URL,
  );
  const googlePlacesId = findExtensionValue(
    payload.extension,
    GOOGLE_PLACE_ID_EXTENSION_URL,
  );
  const sanitized = sanitizeBusinessAttributes(attributes, {
    taxId,
    imageURL,
    healthAndSafetyCertNo,
    animalWelfareComplianceCertNo,
    fireAndEmergencyCertNo,
    googlePlacesId,
  });
  const persistable = pruneUndefined(sanitized);

  return { persistable, typeCoding: sanitized.typeCoding, attributes };
};

export const OrganizationService = {
  async upsert(payload: OrganizationFHIRPayload, userId?: string) {
    const { persistable, typeCoding, attributes } =
      createPersistableFromFHIR(payload);

    const identifier =
      ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id);
    let query: { _id?: string; fhirId?: string } | undefined = undefined;

    if (identifier) {
      query = isValidObjectId(identifier)
        ? { _id: identifier }
        : { fhirId: identifier };
    }

    let document: OrganizationDocument | null = null;
    let created = false;

    if (query) {
      document = await OrganizationModel.findOneAndUpdate(
        query,
        { $set: persistable },
        { new: true, sanitizeFilter: true },
      );
    }

    if (!document) {
      document = await OrganizationModel.create(persistable);
      created = true;

      await Promise.all([
        OrgBilling.create({ orgId: document._id }),
        OrgUsageCounters.create({ orgId: document._id }),
      ]);

      // Link organization to user if userId is provided
      if (userId) {
        const userOrg: UserOrganization = {
          practitionerReference: userId,
          organizationReference: document._id.toString(),
          roleCode: "OWNER",
          active: true,
        };
        await UserOrganizationService.createUserOrganizationMapping(userOrg);

        // Ensure the owner has a minimal draft profile
        const existingProfile = await UserProfileModel.findOne({
          userId,
          organizationId: document._id.toString(),
        });

        if (!existingProfile) {
          await UserProfileModel.create({
            userId,
            organizationId: document._id.toString(),
            personalDetails: {}, // empty
            professionalDetails: {}, // empty
            status: "DRAFT", // auto-set
          });
        }
      }

      // Update Profile photo url
      if (
        persistable.imageURL &&
        document._id.toString() &&
        !persistable.imageURL?.includes("https://")
      ) {
        const finalKey = buildS3Key(
          "org",
          document._id.toString(),
          "image/jpg",
        );
        const profileUrl = await moveFile(persistable.imageURL, finalKey);

        await this.updateProfilePhotoUrl(document._id.toString(), profileUrl);
      }
    }

    const response = buildFHIRResponse(
      document,
      typeCoding ? { typeCoding } : undefined,
    );

    return { response, created };
  },

  async getById(id: string) {
    const document = await OrganizationModel.findOne(resolveIdQuery(id), null, {
      sanitizeFilter: true,
    });

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document);
  },

  async listAll() {
    const documents = await OrganizationModel.find();
    return documents.map((doc) => buildFHIRResponse(doc));
  },

  async deleteById(id: string) {
    const result = await OrganizationModel.findOneAndDelete(
      resolveIdQuery(id),
      { sanitizeFilter: true },
    );
    if (result) {
      await UserOrganizationService.deleteAllByOrganizationId(id);
      await SpecialityService.deleteAllByOrganizationId(id);
      await OrganisationRoomService.deleteAllByOrganizationId(id);
    }
    return Boolean(result);
  },

  async update(id: string, payload: OrganizationFHIRPayload) {
    const { persistable, typeCoding } = createPersistableFromFHIR(payload);

    const document = await OrganizationModel.findOneAndUpdate(
      resolveIdQuery(id),
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document, typeCoding ? { typeCoding } : undefined);
  },

  async upadtePofileVerificationStatus(id: string, isVerified: boolean) {
    const document = await OrganizationModel.findOneAndUpdate(
      resolveIdQuery(id),
      { $set: { isVerified } },
      { new: true, sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document);
  },

  async updateProfilePhotoUrl(id: string, imageURL: string) {
    const document = await OrganizationModel.findOneAndUpdate(
      resolveIdQuery(id),
      { $set: { imageURL } },
      { new: true, sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    return buildFHIRResponse(document);
  },

  async resolveOrganisation(
    input: OrganisationSearchInput,
  ): Promise<OrganisationSearchResult> {
    if (!input.placeId && (!input.lat || !input.lng) && !input.name) {
      throw new OrganizationServiceError("Invalid search input.", 400);
    }

    // Search using places Id
    if (input.placeId) {
      const org = await OrganizationModel.findOne({
        googlePlaceId: input.placeId,
      });
      if (org) {
        return {
          isPmsOrganisation: true,
          organisation: buildFHIRResponse(org),
        };
      }
    }

    // Search using latitude and longitude
    if (input.lat && input.lng) {
      const org = await OrganizationModel.findOne({
        "address.location": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [input.lng, input.lat],
            },
            $maxDistance: 120,
          },
        },
      });

      if (org) {
        return {
          isPmsOrganisation: true,
          organisation: buildFHIRResponse(org),
        };
      }
    }

    // Search for Name
    if (input.name) {
      const safe = escapeStringRegexp(input.name.trim());
      const nameRegex = new RegExp(safe, "i");

      const org = await OrganizationModel.findOne({
        name: nameRegex,
      });

      if (org) {
        return {
          isPmsOrganisation: true,
          organisation: buildFHIRResponse(org),
        };
      }
    }

    return {
      isPmsOrganisation: false,
    };
  },

  // List nearby organisation
  async listNearbyForAppointmentsPaginated(
    lat: number,
    lng: number,
    radius = 50000,
    page = 1,
    limit = 10,
  ) {
    if (!lat || !lng) throw new Error("lat/lng are required");

    const skip = (page - 1) * limit;

    let docs = await OrganizationModel.find(
      {
        "address.location": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: radius,
          },
        },
        isVerified: true,
        isActive: true,
      },
      {
        _id: 1,
        name: 1,
        imageURL: 1,
        phoneNo: 1,
        type: 1,
        address: 1,
        googlePlacesId: 1,
      },
    )
      .skip(skip)
      .limit(limit);

    if (docs.length == 0) {
      logger.warn("No nearby organisations found, returning all organisations");
      docs = await OrganizationModel.find(
        {},
        {
          _id: 1,
          name: 1,
          imageURL: 1,
          phoneNo: 1,
          type: 1,
          address: 1,
          googlePlacesId: 1,
        },
      )
        .skip(skip)
        .limit(limit);
    }

    const total = docs.length;
    const results = [];

    for (const org of docs) {
      const specialities = await SpecialityModel.find(
        { organisationId: org._id },
        { name: 1 },
      );

      // fetch services of org
      const services = await ServiceModel.find(
        { organisationId: org._id },
        { name: 1, cost: 1, specialityId: 1 },
      );

      // group services inside each speciality
      const specialitiesWithServices = specialities.map((spec) => {
        const specServices = services.filter(
          (srv) => srv.specialityId?.toString() === spec._id.toString(),
        );

        return {
          ...spec.toObject(),
          services: specServices,
        };
      });

      results.push({
        org,
        distanceInMeters: org.address?.location
          ? Math.round(
              Math.sqrt(
                Math.pow(lat - org.address.location.coordinates[1], 2) +
                  Math.pow(lng - org.address.location.coordinates[0], 2),
              ) * 111000,
            )
          : null,
        rating: org.averageRating,
        specialitiesWithServices,
      });
    }

    return {
      data: results,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
