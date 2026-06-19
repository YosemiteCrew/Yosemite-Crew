import { isValidObjectId } from "mongoose";
import type { OrganizationMongo } from "../models/organization";
import {
  fromOrganizationRequestDTO,
  toOrganizationResponseDTO,
  type OrganizationRequestDTO,
  type OrganizationResponseDTO,
  type OrganizationDTOAttributes,
  type Organisation,
} from "@yosemite-crew/types";
import { UserOrganizationService } from "./user-organization.service";
import { SpecialityService } from "./speciality.service";
import { OrganisationRoomService } from "./organisation-room.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import logger from "src/utils/logger";
import { Prisma, OrganizationType } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { buildGeoPoint } from "src/utils/geojson";
import { calculateDistanceMeters, toRadians } from "src/utils/geo";

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
const DEFAULT_APPOINTMENT_CHECK_IN_BUFFER_MINUTES = 5;
const DEFAULT_APPOINTMENT_CHECK_IN_RADIUS_METERS = 200;
const ORGANIZATION_TYPES = new Set<Organisation["type"]>([
  "HOSPITAL",
  "BREEDER",
  "BOARDER",
  "GROOMER",
]);
const PET_NAME_PREFERENCES = new Set<Organisation["petNamePreference"]>([
  "COMPANION",
  "ANIMAL",
  "PATIENT",
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
  typeCoding: OrganizationDTOAttributes["typeCoding"] | undefined,
): OrganizationDTOAttributes["typeCoding"] | undefined => {
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

const optionalPetNamePreference = (
  value: unknown,
): Organisation["petNamePreference"] | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new OrganizationServiceError(
      "Pet name preference must be a string.",
      400,
    );
  }

  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return undefined;
  }

  if (!PET_NAME_PREFERENCES.has(trimmed as Organisation["petNamePreference"])) {
    throw new OrganizationServiceError("Invalid pet name preference.", 400);
  }

  return trimmed as Organisation["petNamePreference"];
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

const optionalNonNegativeInteger = (
  value: unknown,
  fieldName: string,
): number | undefined => {
  const parsed = optionalNumber(value, fieldName);

  if (parsed == null) {
    return undefined;
  }

  if (!Number.isInteger(parsed)) {
    throw new OrganizationServiceError(`${fieldName} must be an integer.`, 400);
  }

  if (parsed < 0) {
    throw new OrganizationServiceError(
      `${fieldName} must be non-negative.`,
      400,
    );
  }

  return parsed;
};

const resolveCheckInConfig = (input: {
  appointmentCheckInBufferMinutes?: number | null;
  appointmentCheckInRadiusMeters?: number | null;
}) => ({
  appointmentCheckInBufferMinutes:
    input.appointmentCheckInBufferMinutes ??
    DEFAULT_APPOINTMENT_CHECK_IN_BUFFER_MINUTES,
  appointmentCheckInRadiusMeters:
    input.appointmentCheckInRadiusMeters ??
    DEFAULT_APPOINTMENT_CHECK_IN_RADIUS_METERS,
});

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

  const location = buildGeoPoint({
    latitude: sanitized.latitude,
    longitude: sanitized.longitude,
  });
  if (location) sanitized.location = location;

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
  const petNamePreference = optionalPetNamePreference(dto.petNamePreference);
  const appointmentCheckInBufferMinutes = optionalNonNegativeInteger(
    dto.appointmentCheckInBufferMinutes,
    "Appointment check-in buffer minutes",
  );
  const appointmentCheckInRadiusMeters = optionalNonNegativeInteger(
    dto.appointmentCheckInRadiusMeters,
    "Appointment check-in radius meters",
  );
  const checkInConfig = resolveCheckInConfig({
    appointmentCheckInBufferMinutes,
    appointmentCheckInRadiusMeters,
  });

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    name,
    taxId,
    DUNSNumber,
    imageURL,
    type,
    petNamePreference,
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
    appointmentCheckInBufferMinutes:
      checkInConfig.appointmentCheckInBufferMinutes,
    appointmentCheckInRadiusMeters:
      checkInConfig.appointmentCheckInRadiusMeters,
  };
};

type PrismaOrganizationWithAddress = Prisma.OrganizationGetPayload<{
  include: { address: true };
}>;

const buildFHIRResponseFromPrisma = (
  organisation: PrismaOrganizationWithAddress,
): ReturnType<typeof toOrganizationResponseDTO> => {
  const response: Organisation = {
    ...resolveCheckInConfig({
      appointmentCheckInBufferMinutes:
        organisation.appointmentCheckInBufferMinutes,
      appointmentCheckInRadiusMeters:
        organisation.appointmentCheckInRadiusMeters,
    }),
    _id: organisation.fhirId ?? organisation.id,
    name: organisation.name,
    taxId: organisation.taxId ?? "",
    DUNSNumber: organisation.dunsNumber ?? undefined,
    imageURL: organisation.imageUrl ?? undefined,
    type: coerceOrganizationType(organisation.type),
    petNamePreference: organisation.petNamePreference ?? undefined,
    phoneNo: organisation.phoneNo ?? "",
    website: organisation.website ?? undefined,
    address: organisation.address
      ? {
          addressLine: organisation.address.addressLine ?? undefined,
          country: organisation.address.country ?? undefined,
          city: organisation.address.city ?? undefined,
          state: organisation.address.state ?? undefined,
          postalCode: organisation.address.postalCode ?? undefined,
          latitude: organisation.address.latitude ?? undefined,
          longitude: organisation.address.longitude ?? undefined,
        }
      : undefined,
    isVerified: organisation.isVerified ?? false,
    isActive: organisation.isActive ?? true,
    healthAndSafetyCertNo: organisation.healthAndSafetyCertNo ?? undefined,
    animalWelfareComplianceCertNo:
      organisation.animalWelfareComplianceCertNo ?? undefined,
    fireAndEmergencyCertNo: organisation.fireAndEmergencyCertNo ?? undefined,
    googlePlacesId: organisation.googlePlacesId ?? undefined,
    stripeAccountId: organisation.stripeAccountId ?? undefined,
  };

  const responseOptions = organisation.typeCoding
    ? {
        typeCoding:
          organisation.typeCoding as OrganizationDTOAttributes["typeCoding"],
      }
    : undefined;

  return toOrganizationResponseDTO(response, responseOptions);
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

  return { persistable, attributes };
};

export const OrganizationService = {
  async upsert(payload: OrganizationFHIRPayload, userId?: string) {
    const { persistable, attributes } = createPersistableFromFHIR(payload);

    const identifier =
      ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id);
    const existing = identifier
      ? await prisma.organization.findFirst({
          where: { OR: [{ id: identifier }, { fhirId: identifier }] },
          include: { address: true },
        })
      : null;

    const data = {
      fhirId: persistable.fhirId ?? undefined,
      name: persistable.name,
      taxId: persistable.taxId,
      dunsNumber: persistable.DUNSNumber ?? undefined,
      imageUrl: persistable.imageURL ?? undefined,
      type: persistable.type as OrganizationType,
      petNamePreference: persistable.petNamePreference ?? undefined,
      phoneNo: persistable.phoneNo,
      website: persistable.website ?? undefined,
      documensoTeamId: persistable.documensoTeamId ?? undefined,
      documensoApiKey: persistable.documensoApiKey ?? undefined,
      isVerified: persistable.isVerified ?? false,
      isActive: persistable.isActive ?? true,
      typeCoding: (persistable.typeCoding ??
        undefined) as unknown as Prisma.InputJsonValue,
      healthAndSafetyCertNo: persistable.healthAndSafetyCertNo ?? undefined,
      animalWelfareComplianceCertNo:
        persistable.animalWelfareComplianceCertNo ?? undefined,
      fireAndEmergencyCertNo: persistable.fireAndEmergencyCertNo ?? undefined,
      googlePlacesId: persistable.googlePlacesId ?? undefined,
      stripeAccountId: persistable.stripeAccountId ?? undefined,
      averageRating: persistable.averageRating ?? 0,
      ratingCount: persistable.ratingCount ?? 0,
      appointmentCheckInBufferMinutes:
        persistable.appointmentCheckInBufferMinutes ??
        DEFAULT_APPOINTMENT_CHECK_IN_BUFFER_MINUTES,
      appointmentCheckInRadiusMeters:
        persistable.appointmentCheckInRadiusMeters ??
        DEFAULT_APPOINTMENT_CHECK_IN_RADIUS_METERS,
    };

    const organisation = existing
      ? await prisma.organization.update({
          where: { id: existing.id },
          data,
          include: { address: true },
        })
      : await prisma.organization.create({
          data,
          include: { address: true },
        });

    const created = !existing;

    const address = persistable.address ?? undefined;
    if (address) {
      await prisma.organizationAddress.upsert({
        where: { organizationId: organisation.id },
        create: {
          organizationId: organisation.id,
          addressLine: address.addressLine ?? undefined,
          country: address.country ?? undefined,
          city: address.city ?? undefined,
          state: address.state ?? undefined,
          postalCode: address.postalCode ?? undefined,
          latitude: address.latitude ?? undefined,
          longitude: address.longitude ?? undefined,
          location: (address.location ?? undefined) as Prisma.InputJsonValue,
        },
        update: {
          addressLine: address.addressLine ?? undefined,
          country: address.country ?? undefined,
          city: address.city ?? undefined,
          state: address.state ?? undefined,
          postalCode: address.postalCode ?? undefined,
          latitude: address.latitude ?? undefined,
          longitude: address.longitude ?? undefined,
          location: (address.location ?? undefined) as Prisma.InputJsonValue,
        },
      });
    }

    if (created) {
      await prisma.organizationBilling.create({
        data: { orgId: organisation.id },
      });
      await prisma.organizationUsageCounter.create({
        data: { orgId: organisation.id },
      });

      if (userId) {
        await UserOrganizationService.createUserOrganizationMapping({
          practitionerReference: userId,
          organizationReference: organisation.id,
          roleCode: "OWNER",
          active: true,
        });

        const existingProfile = await prisma.userProfile.findFirst({
          where: { userId, organizationId: organisation.id },
        });

        if (!existingProfile) {
          await prisma.userProfile.create({
            data: {
              userId,
              organizationId: organisation.id,
              personalDetails: {} as Prisma.InputJsonValue,
              professionalDetails: {} as Prisma.InputJsonValue,
              status: "DRAFT",
            },
          });
        }
      }

      if (persistable.imageURL && !persistable.imageURL.includes("https://")) {
        const finalKey = buildS3Key("org", organisation.id, "image/jpg");
        const profileUrl = await moveFile(persistable.imageURL, finalKey);
        await prisma.organization.update({
          where: { id: organisation.id },
          data: { imageUrl: profileUrl },
        });
      }
    }

    return {
      response: buildFHIRResponseFromPrisma(
        await prisma.organization.findUniqueOrThrow({
          where: { id: organisation.id },
          include: { address: true },
        }),
      ),
      created,
    };
  },

  async getById(id: string) {
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return null;
    }
    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
      include: { address: true },
    });

    return organisation ? buildFHIRResponseFromPrisma(organisation) : null;
  },

  async listAll() {
    const organisations = await prisma.organization.findMany({
      include: { address: true },
    });
    return organisations.map((org) => buildFHIRResponseFromPrisma(org));
  },

  async deleteById(id: string) {
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return false;
    }

    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
    });
    if (!organisation) {
      return false;
    }

    await prisma.organization.update({
      where: { id: organisation.id },
      data: { isActive: false },
    });
    await UserOrganizationService.deleteAllByOrganizationId(organisation.id);
    await SpecialityService.deleteAllByOrganizationId(organisation.id);
    await OrganisationRoomService.deleteAllByOrganizationId(organisation.id);
    return true;
  },

  async update(id: string, payload: OrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return null;
    }

    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
    });

    if (!organisation) {
      return null;
    }

    await prisma.organization.update({
      where: { id: organisation.id },
      data: {
        fhirId: persistable.fhirId ?? undefined,
        name: persistable.name,
        taxId: persistable.taxId,
        dunsNumber: persistable.DUNSNumber ?? undefined,
        imageUrl: persistable.imageURL ?? undefined,
        type: persistable.type as OrganizationType,
        petNamePreference: persistable.petNamePreference ?? undefined,
        phoneNo: persistable.phoneNo,
        website: persistable.website ?? undefined,
        documensoTeamId: persistable.documensoTeamId ?? undefined,
        documensoApiKey: persistable.documensoApiKey ?? undefined,
        isVerified: persistable.isVerified ?? false,
        isActive: persistable.isActive ?? true,
        typeCoding: (persistable.typeCoding ??
          undefined) as unknown as Prisma.InputJsonValue,
        healthAndSafetyCertNo: persistable.healthAndSafetyCertNo ?? undefined,
        animalWelfareComplianceCertNo:
          persistable.animalWelfareComplianceCertNo ?? undefined,
        fireAndEmergencyCertNo: persistable.fireAndEmergencyCertNo ?? undefined,
        googlePlacesId: persistable.googlePlacesId ?? undefined,
        stripeAccountId: persistable.stripeAccountId ?? undefined,
        averageRating: persistable.averageRating ?? 0,
        ratingCount: persistable.ratingCount ?? 0,
        appointmentCheckInBufferMinutes:
          persistable.appointmentCheckInBufferMinutes ??
          DEFAULT_APPOINTMENT_CHECK_IN_BUFFER_MINUTES,
        appointmentCheckInRadiusMeters:
          persistable.appointmentCheckInRadiusMeters ??
          DEFAULT_APPOINTMENT_CHECK_IN_RADIUS_METERS,
      },
    });

    const updated = await prisma.organization.findUniqueOrThrow({
      where: { id: organisation.id },
      include: { address: true },
    });

    return buildFHIRResponseFromPrisma(updated);
  },

  async upadtePofileVerificationStatus(id: string, isVerified: boolean) {
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return null;
    }

    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
      include: { address: true },
    });
    if (!organisation) {
      return null;
    }

    const updated = await prisma.organization.update({
      where: { id: organisation.id },
      data: { isVerified },
      include: { address: true },
    });

    return buildFHIRResponseFromPrisma(updated);
  },

  async updateProfilePhotoUrl(id: string, imageURL: string) {
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return null;
    }

    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
      include: { address: true },
    });
    if (!organisation) {
      return null;
    }

    const updated = await prisma.organization.update({
      where: { id: organisation.id },
      data: { imageUrl: imageURL },
      include: { address: true },
    });

    return buildFHIRResponseFromPrisma(updated);
  },

  async resolveOrganisation(
    input: OrganisationSearchInput,
  ): Promise<OrganisationSearchResult> {
    if (!input.placeId && (!input.lat || !input.lng) && !input.name) {
      throw new OrganizationServiceError("Invalid search input.", 400);
    }

    if (input.placeId) {
      const org = await prisma.organization.findFirst({
        where: { googlePlacesId: input.placeId },
        include: { address: true },
      });
      if (org) {
        return {
          isPmsOrganisation: true,
          organisation: buildFHIRResponseFromPrisma(org),
        };
      }
    }

    if (input.lat != null && input.lng != null) {
      const lat = input.lat;
      const lng = input.lng;
      const metersPerDegreeLat = 111000;
      const latDelta = 120 / metersPerDegreeLat;
      const lngDelta = 120 / (metersPerDegreeLat * Math.cos(toRadians(lat)));

      const orgs = await prisma.organization.findMany({
        where: {
          address: {
            is: {
              latitude: { gte: lat - latDelta, lte: lat + latDelta },
              longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
            },
          },
        },
        include: { address: true },
      });

      const closest = orgs.find((org) => {
        if (org.address?.latitude == null || org.address?.longitude == null) {
          return false;
        }
        return (
          calculateDistanceMeters(
            lat,
            lng,
            org.address.latitude,
            org.address.longitude,
          ) <= 120
        );
      });

      if (closest) {
        return {
          isPmsOrganisation: true,
          organisation: buildFHIRResponseFromPrisma(closest),
        };
      }
    }

    if (input.name) {
      const safeName = input.name.trim();
      if (safeName) {
        const org = await prisma.organization.findFirst({
          where: { name: { contains: safeName, mode: "insensitive" } },
          include: { address: true },
        });
        if (org) {
          return {
            isPmsOrganisation: true,
            organisation: buildFHIRResponseFromPrisma(org),
          };
        }
      }
    }

    return {
      isPmsOrganisation: false,
    };
  },

  async listNearbyForAppointmentsPaginated(
    lat: number,
    lng: number,
    radius = 50000,
    page = 1,
    limit = 10,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("lat/lng are required");
    }

    const skip = (page - 1) * limit;
    const metersPerDegreeLat = 111000;
    const latDelta = radius / metersPerDegreeLat;
    const lngDelta = radius / (metersPerDegreeLat * Math.cos(toRadians(lat)));

    let organisations = await prisma.organization.findMany({
      where: {
        isVerified: true,
        isActive: true,
        address: {
          is: {
            latitude: { gte: lat - latDelta, lte: lat + latDelta },
            longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
          },
        },
      },
      include: { address: true },
    });

    organisations = organisations.filter((org) => {
      if (org.address?.latitude == null || org.address?.longitude == null) {
        return false;
      }
      return (
        calculateDistanceMeters(
          lat,
          lng,
          org.address.latitude,
          org.address.longitude,
        ) <= radius
      );
    });

    if (organisations.length === 0) {
      logger.warn("No nearby organisations found, returning all organisations");
      organisations = await prisma.organization.findMany({
        include: { address: true },
      });
    }

    const total = organisations.length;
    const pageOrgs = organisations.slice(skip, skip + limit);
    const results = [];

    for (const org of pageOrgs) {
      const [specialities, services] = await Promise.all([
        prisma.speciality.findMany({
          where: { organisationId: org.id },
        }),
        prisma.service.findMany({
          where: { organisationId: org.id },
        }),
      ]);

      const specialitiesWithServices = specialities.map((spec) => ({
        ...spec,
        services: services.filter((srv) => srv.specialityId === spec.id),
      }));

      const distanceInMeters =
        org.address?.latitude != null && org.address?.longitude != null
          ? Math.round(
              calculateDistanceMeters(
                lat,
                lng,
                org.address.latitude,
                org.address.longitude,
              ),
            )
          : null;

      results.push({
        org: {
          _id: org.id,
          name: org.name,
          imageURL: org.imageUrl ?? undefined,
          phoneNo: org.phoneNo ?? undefined,
          type: org.type,
          appointmentCheckInBufferMinutes:
            org.appointmentCheckInBufferMinutes ??
            DEFAULT_APPOINTMENT_CHECK_IN_BUFFER_MINUTES,
          appointmentCheckInRadiusMeters:
            org.appointmentCheckInRadiusMeters ??
            DEFAULT_APPOINTMENT_CHECK_IN_RADIUS_METERS,
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
          googlePlacesId: org.googlePlacesId ?? undefined,
        },
        distanceInMeters,
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
