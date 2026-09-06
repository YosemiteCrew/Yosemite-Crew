import { OrganizationType, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { organisationReferenceMatches } from "src/services/shared/organisation-membership";

const LEADING_PRACTITIONER_PREFIX = /^Practitioner\//;

export type SuperAdminBusinessSummary = {
  id: string;
  name: string;
  type: OrganizationType;
  isVerified: boolean;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  taxId?: string;
  phoneNo?: string;
  website?: string;
};

/**
 * One active membership row. Uniqueness on `userOrganization` is
 * `(practitionerReference, organizationReference, roleCode)`, so a person
 * holding two roles in an organisation is two rows here and two in
 * `memberCount` - the list and the count stay in agreement, and a consumer
 * keying by `userId` alone would collide.
 */
export type SuperAdminBusinessMember = {
  userId: string;
  roleCode: string;
  roleDisplay?: string;
  since: string;
};

export type SuperAdminBusinessDetail = SuperAdminBusinessSummary & {
  updatedAt: string;
  DUNSNumber?: string;
  imageURL?: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  healthAndSafetyCertNo?: string;
  animalWelfareComplianceCertNo?: string;
  fireAndEmergencyCertNo?: string;
  googlePlacesId?: string;
  averageRating?: number;
  ratingCount?: number;
};

export type SuperAdminBusinessUpdateInput = {
  isVerified?: boolean;
  isActive?: boolean;
};

export class SuperAdminBusinessServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SuperAdminBusinessServiceError";
  }
}

const BUSINESS_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

const normalizeBusinessId = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new SuperAdminBusinessServiceError(
      "Business id is required.",
      400,
      "BUSINESS_ID_REQUIRED",
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new SuperAdminBusinessServiceError(
      "Business id is required.",
      400,
      "BUSINESS_ID_REQUIRED",
    );
  }

  if (!BUSINESS_ID_PATTERN.test(trimmed)) {
    throw new SuperAdminBusinessServiceError(
      "Invalid business id format.",
      400,
      "INVALID_BUSINESS_ID",
    );
  }

  return trimmed;
};

const toIsoString = (value: Date): string => value.toISOString();

const toAddress = (
  address:
    | {
        addressLine?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        postalCode?: string | null;
      }
    | null
    | undefined,
) => {
  if (!address) {
    return undefined;
  }

  const mapped = {
    addressLine: address.addressLine ?? undefined,
    city: address.city ?? undefined,
    state: address.state ?? undefined,
    country: address.country ?? undefined,
    postalCode: address.postalCode ?? undefined,
  };

  return Object.values(mapped).some((value) => value !== undefined)
    ? mapped
    : undefined;
};

const mapSummary = (
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    isVerified: boolean;
    isActive: boolean;
    taxId: string;
    phoneNo: string;
    website: string | null;
    createdAt: Date;
  },
  memberCount: number,
): SuperAdminBusinessSummary => ({
  id: organization.id,
  name: organization.name,
  type: organization.type,
  isVerified: organization.isVerified,
  isActive: organization.isActive,
  memberCount,
  createdAt: toIsoString(organization.createdAt),
  taxId: organization.taxId,
  phoneNo: organization.phoneNo,
  ...(organization.website ? { website: organization.website } : {}),
});

const mapDetail = (
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    isVerified: boolean;
    isActive: boolean;
    taxId: string;
    phoneNo: string;
    website: string | null;
    dunsNumber: string | null;
    imageUrl: string | null;
    healthAndSafetyCertNo: string | null;
    animalWelfareComplianceCertNo: string | null;
    fireAndEmergencyCertNo: string | null;
    googlePlacesId: string | null;
    averageRating: number;
    ratingCount: number;
    createdAt: Date;
    updatedAt: Date;
    address?: {
      addressLine: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      postalCode: string | null;
    } | null;
  },
  memberCount: number,
): SuperAdminBusinessDetail => {
  const address = toAddress(organization.address);

  return {
    ...mapSummary(organization, memberCount),
    updatedAt: toIsoString(organization.updatedAt),
    ...(organization.dunsNumber ? { DUNSNumber: organization.dunsNumber } : {}),
    ...(organization.imageUrl ? { imageURL: organization.imageUrl } : {}),
    ...(address ? { address } : {}),
    ...(organization.healthAndSafetyCertNo
      ? { healthAndSafetyCertNo: organization.healthAndSafetyCertNo }
      : {}),
    ...(organization.animalWelfareComplianceCertNo
      ? {
          animalWelfareComplianceCertNo:
            organization.animalWelfareComplianceCertNo,
        }
      : {}),
    ...(organization.fireAndEmergencyCertNo
      ? { fireAndEmergencyCertNo: organization.fireAndEmergencyCertNo }
      : {}),
    ...(organization.googlePlacesId
      ? { googlePlacesId: organization.googlePlacesId }
      : {}),
    averageRating: organization.averageRating,
    ratingCount: organization.ratingCount,
  };
};

/**
 * The distinct active memberships of one organisation.
 *
 * Everything member-shaped on this surface goes through here, so the roster and
 * the number printed beside it are the same list measured two ways rather than
 * two queries that have to be kept in agreement.
 *
 * Both stored columns are raw FHIR references, which forces the de-duplication.
 * `@@unique([practitionerReference, organizationReference, roleCode])` is over
 * the strings as written, so `<id>` and `Organization/<id>` are different keys:
 * the same person, organisation and role can exist as two rows and satisfy the
 * constraint. Matching one spelling saw one of them and under-counted; matching
 * all four sees both and would over-count. `Members 2` for one person is as
 * wrong as `Members 0` for forty-seven, and neither errors.
 */
/**
 * Which membership rows belong to one organisation, and what makes two of them
 * the same membership.
 *
 * Both reference columns are persisted verbatim from the inbound FHIR resource,
 * so each holds a bare id or a `<Type>/<id>` reference - see
 * `practitionerReferenceFilter` in `shared/staff-identity.ts`, where querying
 * only the bare form is what let a deletion remove no organisation roles and
 * report success. `@@unique` is over those strings as written, so one person,
 * organisation and role can exist as several rows and satisfy the constraint:
 * matching one spelling under-counts, matching all four over-counts, and
 * neither errors.
 *
 * The roster and the number beside it therefore share this `where` and this
 * identity, and differ only in how many columns they fetch. Two ROLES in one
 * organisation stay two memberships; what collapses is one membership reached
 * under several spellings. The key separator is a NUL because it cannot occur
 * in either field, so no value can forge a collision with a different pair.
 */
const membershipWhere = (id: string, fhirId?: string | null) => ({
  active: true,
  OR: organisationReferenceMatches(id, fhirId),
});

const membershipIdentity = (membership: {
  practitionerReference: string;
  roleCode: string;
}): string | null => {
  const userId = membership.practitionerReference
    .trim()
    .replace(LEADING_PRACTITIONER_PREFIX, "");
  return userId ? `${userId}\u0000${membership.roleCode}` : null;
};

const loadMembers = async (
  id: string,
  fhirId?: string | null,
): Promise<SuperAdminBusinessMember[]> => {
  const memberships = await prisma.userOrganization.findMany({
    where: membershipWhere(id, fhirId),
    orderBy: { createdAt: "asc" },
    select: {
      practitionerReference: true,
      roleCode: true,
      roleDisplay: true,
      createdAt: true,
    },
  });

  const seen = new Set<string>();
  const members: SuperAdminBusinessMember[] = [];

  for (const membership of memberships) {
    const identity = membershipIdentity(membership);
    if (!identity || seen.has(identity)) {
      continue;
    }
    seen.add(identity);

    members.push({
      userId: identity.split("\u0000")[0],
      roleCode: membership.roleCode,
      ...(membership.roleDisplay
        ? { roleDisplay: membership.roleDisplay }
        : {}),
      since: toIsoString(membership.createdAt),
    });
  }

  return members;
};

/**
 * The same count without building the roster.
 *
 * A summary endpoint needs a number, and the organisations list asks once per
 * organisation, so this fetches the two columns the identity is made of rather
 * than every row in full. It cannot drift from the list: the rows it considers
 * and the rule for which of them are the same membership are the two functions
 * above, shared. A database-side `DISTINCT` is not available for it - the
 * identity comes from an anchored prefix strip that SQL does not reproduce, so
 * counting distinct values in the database would count spellings again, which
 * is the over-count this exists to remove.
 */
const countMembers = async (
  id: string,
  fhirId?: string | null,
): Promise<number> => {
  const memberships = await prisma.userOrganization.findMany({
    where: membershipWhere(id, fhirId),
    select: { practitionerReference: true, roleCode: true },
  });

  const identities = new Set(
    memberships
      .map(membershipIdentity)
      .filter((identity): identity is string => identity !== null),
  );

  return identities.size;
};

const loadMemberCounts = async (
  organizations: ReadonlyArray<{ id: string; fhirId?: string | null }>,
) => {
  if (organizations.length === 0) {
    return new Map<string, number>();
  }

  const counts: Array<readonly [string, number]> = await Promise.all(
    organizations.map(
      async (organization): Promise<readonly [string, number]> => [
        organization.id,
        await countMembers(organization.id, organization.fhirId),
      ],
    ),
  );

  return new Map<string, number>(counts);
};

const findOrganizationById = async (id: string) =>
  prisma.organization.findFirst({
    where: { OR: [{ id }, { fhirId: id }] },
    include: { address: true },
  });

export const SuperAdminBusinessService = {
  async listBusinesses(): Promise<SuperAdminBusinessSummary[]> {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
    });
    const memberCounts = await loadMemberCounts(organizations);

    return organizations.map((organization) =>
      mapSummary(organization, memberCounts.get(organization.id) ?? 0),
    );
  },

  async getBusiness(id: unknown): Promise<SuperAdminBusinessDetail | null> {
    const businessId = normalizeBusinessId(id);
    const organization = await findOrganizationById(businessId);
    if (!organization) {
      return null;
    }

    const memberCount = await countMembers(
      organization.id,
      organization.fhirId,
    );

    return mapDetail(organization, memberCount);
  },

  /**
   * The active memberships of one organisation.
   *
   * `memberCount` is the only thing the panel has ever known about who belongs
   * to a clinic, and a bare number is not something an operator can act on: to
   * answer "nobody here can log in" they have to reach the individual accounts.
   * Resolved through the same predicate as the count, so the list and the
   * number beside it cannot disagree.
   */
  async listBusinessMembers(
    id: unknown,
  ): Promise<SuperAdminBusinessMember[] | null> {
    const businessId = normalizeBusinessId(id);
    const organization = await findOrganizationById(businessId);
    if (!organization) {
      return null;
    }

    return loadMembers(organization.id, organization.fhirId);
  },

  async updateBusiness(
    id: unknown,
    input: SuperAdminBusinessUpdateInput,
  ): Promise<SuperAdminBusinessDetail | null> {
    const businessId = normalizeBusinessId(id);
    const organization = await prisma.organization.findFirst({
      where: { OR: [{ id: businessId }, { fhirId: businessId }] },
    });

    if (!organization) {
      return null;
    }

    const data: Prisma.OrganizationUpdateInput = {};

    if (input.isVerified !== undefined) {
      data.isVerified = input.isVerified;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new SuperAdminBusinessServiceError(
        "At least one status field is required.",
        400,
        "INVALID_BUSINESS_UPDATE",
      );
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data,
      include: { address: true },
    });

    const memberCount = await countMembers(updated.id, updated.fhirId);

    return mapDetail(updated, memberCount);
  },

  normalizeBusinessId,
  mapSummary,
  mapDetail,
  loadMemberCounts,
  findOrganizationById,
};
