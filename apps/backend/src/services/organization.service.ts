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
import { recomputeOrganizationVerification } from "./organization-verification.service";
import { SpecialityService } from "./speciality.service";
import { OrganisationRoomService } from "./organisation-room.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import logger from "src/utils/logger";
import { pruneUndefined } from "src/utils/prune-undefined";
import { Prisma } from "@prisma/client";
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

  if (!/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    throw new OrganizationServiceError("Invalid identifier format.", 400);
  }

  return identifier;
};

const resolveOrganisationByPlaceId = async (placeId: string) => {
  const org = await prisma.organization.findFirst({
    where: { googlePlacesId: placeId },
    include: { address: true },
  });

  if (!org) return null;

  return {
    isPmsOrganisation: true as const,
    organisation: buildPublicSummaryFromPrisma(org),
  };
};

const resolveOrganisationByCoordinates = async (lat: number, lng: number) => {
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

  if (!closest) return null;

  return {
    isPmsOrganisation: true as const,
    organisation: buildPublicSummaryFromPrisma(closest),
  };
};

const resolveOrganisationByName = async (name: string) => {
  const safeName = name.trim();
  if (!safeName) return null;

  const org = await prisma.organization.findFirst({
    where: { name: { contains: safeName, mode: "insensitive" } },
    include: { address: true },
  });

  if (!org) return null;

  return {
    isPmsOrganisation: true as const,
    organisation: buildPublicSummaryFromPrisma(org),
  };
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
  const appointmentLockWindowOutpatientMinutes = optionalNonNegativeInteger(
    dto.appointmentLockWindowOutpatientMinutes,
    "Appointment lock window outpatient minutes",
  );
  const appointmentLockWindowInpatientMinutes = optionalNonNegativeInteger(
    dto.appointmentLockWindowInpatientMinutes,
    "Appointment lock window inpatient minutes",
  );
  const crossOrgMessagingEnabled =
    dto.crossOrgMessagingEnabled === undefined
      ? undefined
      : Boolean(dto.crossOrgMessagingEnabled);
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
    appointmentLockWindowOutpatientMinutes,
    appointmentLockWindowInpatientMinutes,
    crossOrgMessagingEnabled,
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
    appointmentLockWindowOutpatientMinutes:
      organisation.appointmentLockWindowOutpatientMinutes ?? undefined,
    appointmentLockWindowInpatientMinutes:
      organisation.appointmentLockWindowInpatientMinutes ?? undefined,
    crossOrgMessagingEnabled: organisation.crossOrgMessagingEnabled ?? false,
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

/**
 * Projection for the unauthenticated `/check` route. The full organisation resource carries
 * tax/DUNS identifiers, compliance certificate numbers, the Stripe account id and contact
 * details; an anonymous caller only needs to learn that the organisation exists and how to
 * reference it, so nothing else is assembled here.
 */
const buildPublicSummaryFromPrisma = (
  organisation: PrismaOrganizationWithAddress,
): ReturnType<typeof toOrganizationResponseDTO> =>
  toOrganizationResponseDTO({
    _id: organisation.fhirId ?? organisation.id,
    name: organisation.name,
    type: coerceOrganizationType(organisation.type),
    isActive: organisation.isActive ?? true,
    googlePlacesId: organisation.googlePlacesId ?? undefined,
    taxId: "",
    phoneNo: "",
  });

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

const buildOrganizationWriteData = (persistable: OrganizationMongo) => ({
  fhirId: persistable.fhirId ?? undefined,
  name: persistable.name,
  taxId: persistable.taxId,
  dunsNumber: persistable.DUNSNumber ?? undefined,
  imageUrl: persistable.imageURL ?? undefined,
  type: persistable.type,
  petNamePreference: persistable.petNamePreference ?? undefined,
  phoneNo: persistable.phoneNo,
  website: persistable.website ?? undefined,
  documensoTeamId: persistable.documensoTeamId ?? undefined,
  documensoApiKey: persistable.documensoApiKey ?? undefined,
  // isVerified is deliberately absent: it is derived from Stripe Connect status
  // and compliance certificates via recomputeOrganizationVerification, and it
  // gates federation directory listing. Writing it from the client payload let
  // any caller with teams:edit:any mark their own organisation verified.
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
  appointmentLockWindowOutpatientMinutes:
    persistable.appointmentLockWindowOutpatientMinutes ?? undefined,
  appointmentLockWindowInpatientMinutes:
    persistable.appointmentLockWindowInpatientMinutes ?? undefined,
  crossOrgMessagingEnabled: persistable.crossOrgMessagingEnabled ?? false,
});

/**
 * Proves the caller is an active member of an organisation they are about to
 * mutate. Used by write paths that resolve their target from the request body
 * rather than from an org-scoped route, where `withOrgPermissions` has nothing
 * to bind to.
 */
const assertActiveMembership = async (
  organisationId: string,
  userId?: string,
): Promise<void> => {
  const actor = userId?.trim();
  if (!actor) {
    throw new OrganizationServiceError(
      "Not authorised to modify this organisation.",
      403,
    );
  }
  const mapping = await prisma.userOrganization.findFirst({
    where: {
      practitionerReference: actor,
      active: true,
      OR: [
        { organizationReference: organisationId },
        { organizationReference: `Organization/${organisationId}` },
      ],
    },
    select: { id: true },
  });
  if (!mapping) {
    throw new OrganizationServiceError(
      "Not authorised to modify this organisation.",
      403,
    );
  }
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

    // The onboarding route is only authenticated, not org-scoped - a new
    // practice has no organisation to be scoped to yet. That makes the CREATE
    // branch safe for any signed-in user, but the UPDATE branch is a different
    // operation reached purely by naming an existing identifier in the body, so
    // it needs the membership check the route cannot perform.
    if (existing) {
      await assertActiveMembership(existing.id, userId);
    }

    const data = buildOrganizationWriteData(persistable);

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
              personalDetails: {},
              professionalDetails: {},
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

    // isVerified is derived, never client-supplied: recompute from Stripe
    // Connect status + compliance certs (honouring any manual override).
    await recomputeOrganizationVerification(organisation.id);

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

  /**
   * The organisations the caller actually belongs to.
   *
   * This replaces an unfiltered `findMany` that handed every authenticated web
   * session the whole tenant table. Membership is read from the same
   * `userOrganization` mappings RBAC authorises against, so the list can never
   * be wider than what the caller could already open individually.
   */
  async listForUser(userId: string) {
    const trimmed = userId.trim();
    if (!trimmed) return [];

    const memberships = await prisma.userOrganization.findMany({
      where: { practitionerReference: trimmed, active: true },
      select: { organizationReference: true },
    });
    // Mappings are stored either bare or as a FHIR `Organization/<id>`
    // reference, exactly as `rbac.ts` matches them.
    const organisationIds = [
      ...new Set(
        memberships.map((row) =>
          row.organizationReference.replace(/^Organization\//, ""),
        ),
      ),
    ];
    if (organisationIds.length === 0) return [];

    const organisations = await prisma.organization.findMany({
      where: { id: { in: organisationIds } },
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
      data: buildOrganizationWriteData(persistable),
    });

    // The upsert path already did this; this one did not, so an authenticated
    // update could leave a stale or client-forced verification state behind.
    await recomputeOrganizationVerification(organisation.id);

    const updated = await prisma.organization.findUniqueOrThrow({
      where: { id: organisation.id },
      include: { address: true },
    });

    return buildFHIRResponseFromPrisma(updated);
  },

  /**
   * Sets (or clears) the manual verification override. Reserved for the
   * verification authority (SuperAdmin), NOT org-scoped self-service — an org
   * must never be able to verify itself and bypass the federation trust gate.
   * Pass null to revert to automatic (Stripe Connect + compliance cert) status.
   */
  async setVerificationOverride(id: string, override: boolean | null) {
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
      data: { verificationOverride: override },
    });
    await recomputeOrganizationVerification(organisation.id);

    return buildFHIRResponseFromPrisma(
      await prisma.organization.findUniqueOrThrow({
        where: { id: organisation.id },
        include: { address: true },
      }),
    );
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
      const byPlaceId = await resolveOrganisationByPlaceId(input.placeId);
      if (byPlaceId) return byPlaceId;
    }

    if (input.lat != null && input.lng != null) {
      const byCoordinates = await resolveOrganisationByCoordinates(
        input.lat,
        input.lng,
      );
      if (byCoordinates) return byCoordinates;
    }

    if (input.name) {
      const byName = await resolveOrganisationByName(input.name);
      if (byName) return byName;
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
      throw new TypeError("lat/lng are required");
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

    // The widen-the-net fallback is deliberate and covered by a test, so it
    // stays. What was NOT deliberate is that it carried neither `isVerified`
    // nor `isActive`, unlike the primary query above - so on an UNAUTHENTICATED
    // endpoint it surfaced unverified and deactivated practices that the
    // primary query is careful to exclude. Apply the same guards.
    //
    // Worth revisiting separately: whether "nothing within the radius" should
    // widen to every organisation at all, since a caller in Berlin currently
    // gets clinics on other continents. That is a product call, not a fix.
    if (organisations.length === 0) {
      logger.warn("No nearby organisations found, returning all organisations");
      organisations = await prisma.organization.findMany({
        where: { isVerified: true, isActive: true },
        include: { address: true },
      });
    }

    const total = organisations.length;
    const pageOrgs = organisations.slice(skip, skip + limit);
    const results = [];

    for (const org of pageOrgs) {
      // Select explicitly rather than spreading the rows. This response is
      // UNAUTHENTICATED, and the `org` object below is already hand-projected
      // for exactly that reason; the speciality and service rows were not, so
      // `...spec` and the raw service rows published every column.
      //
      // What that exposed: `maxDiscount`, a practice's internal discount
      // ceiling, and `cost`, alongside `headName`, `headProfilePicUrl`,
      // `headUserId` and `memberUserIds` - naming department heads, showing
      // their photograph, and handing staff user ids to anyone who could guess
      // a latitude and longitude.
      //
      // Listing fields rather than removing them means anything added to these
      // models in future is excluded by default. That is the point.
      const [specialities, services] = await Promise.all([
        prisma.speciality.findMany({
          where: { organisationId: org.id, isActive: true },
          select: { id: true, name: true, description: true },
        }),
        prisma.service.findMany({
          where: { organisationId: org.id, isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            serviceType: true,
            // Groups services under their speciality below; not emitted.
            specialityId: true,
          },
        }),
      ]);

      const specialitiesWithServices = specialities.map((spec) => ({
        id: spec.id,
        name: spec.name,
        description: spec.description ?? undefined,
        services: services
          .filter((srv) => srv.specialityId === spec.id)
          .map(({ specialityId: _specialityId, ...srv }) => srv),
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
