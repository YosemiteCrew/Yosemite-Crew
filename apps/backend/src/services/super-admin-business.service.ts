import { OrganizationType, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { organisationReferenceMatches } from "src/services/shared/organisation-membership";

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

const countMembers = async (
  id: string,
  fhirId?: string | null,
): Promise<number> =>
  prisma.userOrganization.count({
    where: { active: true, OR: organisationReferenceMatches(id, fhirId) },
  });

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

    const memberships = await prisma.userOrganization.findMany({
      where: {
        active: true,
        OR: organisationReferenceMatches(organization.id, organization.fhirId),
      },
      orderBy: { createdAt: "asc" },
      select: {
        practitionerReference: true,
        roleCode: true,
        roleDisplay: true,
        createdAt: true,
      },
    });

    return memberships.map((membership) => ({
      userId: membership.practitionerReference,
      roleCode: membership.roleCode,
      ...(membership.roleDisplay
        ? { roleDisplay: membership.roleDisplay }
        : {}),
      since: toIsoString(membership.createdAt),
    }));
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
