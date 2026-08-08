import { OrganizationType, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

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

const loadMemberCounts = async (organizationIds: string[]) => {
  if (organizationIds.length === 0) {
    return new Map<string, number>();
  }

  const counts: Array<readonly [string, number]> = await Promise.all(
    organizationIds.map(
      async (organizationId): Promise<readonly [string, number]> => [
        organizationId,
        await prisma.userOrganization.count({
          where: {
            active: true,
            organizationReference: organizationId,
          },
        }),
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
    const memberCounts = await loadMemberCounts(
      organizations.map((organization) => organization.id),
    );

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

    const memberCount =
      (await prisma.userOrganization.count({
        where: {
          organizationReference: organization.id,
          active: true,
        },
      })) ?? 0;

    return mapDetail(organization, memberCount);
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

    const memberCount = await prisma.userOrganization.count({
      where: {
        organizationReference: updated.id,
        active: true,
      },
    });

    return mapDetail(updated, memberCount);
  },

  normalizeBusinessId,
  mapSummary,
  mapDetail,
  loadMemberCounts,
  findOrganizationById,
};
