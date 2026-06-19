import type {
  CompanionParentLink,
  ParentCompanionPermissions,
  ParentCompanionRole,
  ParentCompanionStatus,
} from "@yosemite-crew/types";
import {
  ParentPatientRole as PrismaParentPatientRole,
  ParentPatientStatus as PrismaParentPatientStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class ParentCompanionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ParentCompanionServiceError";
  }
}

type ParentIdentity = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  profileImageUrl: string | null;
};

type ParentPatientRecord = {
  id: string;
  parentId: string;
  patientId: string;
  role: PrismaParentPatientRole;
  status: PrismaParentPatientStatus;
  permissions: Prisma.JsonValue;
  invitedByParentId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const BASE_PERMISSIONS: ParentCompanionPermissions = {
  assignAsPrimaryParent: false,
  emergencyBasedPermissions: false,
  appointments: false,
  companionProfile: false,
  documents: false,
  expenses: false,
  tasks: false,
  chatWithVet: false,
};

const PRIMARY_PARENT_PERMISSIONS: ParentCompanionPermissions = {
  assignAsPrimaryParent: true,
  emergencyBasedPermissions: true,
  appointments: true,
  companionProfile: true,
  documents: true,
  expenses: true,
  tasks: true,
  chatWithVet: true,
};

const buildPermissions = (
  role: ParentCompanionRole,
  overrides?: Partial<ParentCompanionPermissions>,
): ParentCompanionPermissions => {
  const base =
    role === "PRIMARY" ? PRIMARY_PARENT_PERMISSIONS : BASE_PERMISSIONS;
  const permissions = {
    ...base,
    ...overrides,
  };

  return role === "PRIMARY"
    ? { ...permissions, assignAsPrimaryParent: true }
    : { ...permissions, assignAsPrimaryParent: false };
};

const normalizeId = (value: string | { toString(): string }) => {
  const id = value.toString().trim();
  if (!id) {
    throw new ParentCompanionServiceError("Identifier is required.", 400);
  }
  return id;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

const toCompanionParentLink = (
  record: ParentPatientRecord,
  parent?: ParentIdentity,
): CompanionParentLink => ({
  parentId: record.parentId,
  role: record.role as ParentCompanionRole,
  status: record.status as ParentCompanionStatus,
  permissions: record.permissions as unknown as ParentCompanionPermissions,
  invitedByParentId: record.invitedByParentId ?? undefined,
  acceptedAt: record.acceptedAt?.toISOString(),
  createdAt: record.createdAt?.toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
  parent: parent
    ? {
        firstName: parent.firstName,
        lastName: parent.lastName ?? "",
        email: parent.email,
        phoneNumber: parent.phoneNumber ?? "",
        profileImageUrl: parent.profileImageUrl ?? "",
      }
    : undefined,
});

const loadLinkWithParent = async (record: ParentPatientRecord) => {
  const parent = await prisma.parent.findUnique({
    where: { id: record.parentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      profileImageUrl: true,
    },
  });

  return toCompanionParentLink(record, parent ?? undefined);
};

const findPrimaryLink = async (patientId: string, excludeParentId?: string) =>
  prisma.parentPatient.findFirst({
    where: {
      patientId,
      role: "PRIMARY",
      status: "ACTIVE",
      ...(excludeParentId ? { parentId: { not: excludeParentId } } : {}),
    },
    select: {
      id: true,
      parentId: true,
      patientId: true,
      role: true,
      status: true,
      permissions: true,
      invitedByParentId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

const ensurePrimaryLinkExists = async (parentId: string, patientId: string) => {
  const link = await prisma.parentPatient.findFirst({
    where: {
      parentId,
      patientId,
      role: "PRIMARY",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!link) {
    throw new ParentCompanionServiceError(
      "You are not authorized to modify this companion.",
      403,
    );
  }
};

const asRecord = (doc: {
  id: string;
  parentId: string;
  patientId: string;
  role: PrismaParentPatientRole;
  status: PrismaParentPatientStatus;
  permissions: Prisma.JsonValue;
  invitedByParentId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ParentPatientRecord => doc;

export const ParentCompanionService = {
  async linkParent({
    parentId,
    patientId,
    role = "PRIMARY",
    permissionsOverride,
    invitedByParentId,
    status,
  }: {
    parentId: string | { toString(): string };
    patientId: string | { toString(): string };
    role?: ParentCompanionRole;
    permissionsOverride?: Partial<ParentCompanionPermissions>;
    invitedByParentId?: string | { toString(): string };
    status?: ParentCompanionStatus;
  }): Promise<CompanionParentLink> {
    const normalizedParentId = normalizeId(parentId);
    const normalizedPatientId = normalizeId(patientId);
    const normalizedInvitedByParentId = invitedByParentId
      ? normalizeId(invitedByParentId)
      : undefined;

    const effectiveStatus: ParentCompanionStatus =
      status ?? (role === "PRIMARY" ? "ACTIVE" : "PENDING");
    const permissions = buildPermissions(role, permissionsOverride);

    if (role === "PRIMARY" && effectiveStatus === "ACTIVE") {
      const existingPrimary = await findPrimaryLink(
        normalizedPatientId,
        normalizedParentId,
      );
      if (existingPrimary) {
        throw new ParentCompanionServiceError(
          "Companion already has an active primary parent.",
          409,
        );
      }
    }

    try {
      const created = await prisma.parentPatient.create({
        data: {
          parentId: normalizedParentId,
          patientId: normalizedPatientId,
          role: role as PrismaParentPatientRole,
          status: effectiveStatus as PrismaParentPatientStatus,
          permissions: permissions as unknown as Prisma.InputJsonValue,
          invitedByParentId: normalizedInvitedByParentId,
          acceptedAt: effectiveStatus === "ACTIVE" ? new Date() : undefined,
        },
      });

      return loadLinkWithParent(asRecord(created));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const message =
          role === "PRIMARY"
            ? "Companion already has an active primary parent."
            : "Parent is already linked to this companion.";
        throw new ParentCompanionServiceError(message, 409);
      }

      throw error;
    }
  },

  async activateLink(
    parentId: string | { toString(): string },
    patientId: string | { toString(): string },
  ): Promise<CompanionParentLink | null> {
    const normalizedParentId = normalizeId(parentId);
    const normalizedPatientId = normalizeId(patientId);

    const updated = await prisma.parentPatient.updateMany({
      where: {
        parentId: normalizedParentId,
        patientId: normalizedPatientId,
        status: "PENDING",
      },
      data: { status: "ACTIVE", acceptedAt: new Date() },
    });

    if (!updated.count) {
      return null;
    }

    const record = await prisma.parentPatient.findFirst({
      where: {
        parentId: normalizedParentId,
        patientId: normalizedPatientId,
      },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return record ? loadLinkWithParent(asRecord(record)) : null;
  },

  async revokeLink(linkId: string | { toString(): string }) {
    const normalizedLinkId = normalizeId(linkId);
    const updated = await prisma.parentPatient.updateMany({
      where: { id: normalizedLinkId },
      data: { status: "REVOKED" },
    });

    if (!updated.count) {
      throw new ParentCompanionServiceError("Link not found.", 404);
    }

    const record = await prisma.parentPatient.findUnique({
      where: { id: normalizedLinkId },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!record) {
      throw new ParentCompanionServiceError("Link not found.", 404);
    }

    return loadLinkWithParent(asRecord(record));
  },

  async updatePermissions(
    requestingParentId: string | { toString(): string },
    targetParentId: string | { toString(): string },
    patientId: string | { toString(): string },
    updates: Partial<ParentCompanionPermissions>,
  ): Promise<CompanionParentLink> {
    const normalizedRequestingParentId = normalizeId(requestingParentId);
    const normalizedTargetParentId = normalizeId(targetParentId);
    const normalizedPatientId = normalizeId(patientId);

    await ensurePrimaryLinkExists(
      normalizedRequestingParentId,
      normalizedPatientId,
    );

    const target = await prisma.parentPatient.findFirst({
      where: {
        parentId: normalizedTargetParentId,
        patientId: normalizedPatientId,
      },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!target) {
      throw new ParentCompanionServiceError("Link not found.", 404);
    }

    const targetPermissions =
      target.permissions as unknown as ParentCompanionPermissions;
    const isCurrentlyPrimary =
      target.role === "PRIMARY" && target.status === "ACTIVE";
    const wantsPrimary = updates.assignAsPrimaryParent === true;

    if (wantsPrimary && !isCurrentlyPrimary) {
      const promoted = await prisma.$transaction(async (tx) => {
        const existingPrimary = await tx.parentPatient.findFirst({
          where: {
            patientId: normalizedPatientId,
            role: "PRIMARY",
            status: "ACTIVE",
            parentId: { not: normalizedTargetParentId },
          },
          select: { id: true },
        });

        if (existingPrimary) {
          await tx.parentPatient.update({
            where: { id: existingPrimary.id },
            data: {
              role: "CO_PARENT",
              permissions: {
                ...BASE_PERMISSIONS,
                assignAsPrimaryParent: false,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }

        return tx.parentPatient.update({
          where: { id: target.id },
          data: {
            role: "PRIMARY",
            status: "ACTIVE",
            permissions: buildPermissions(
              "PRIMARY",
              updates,
            ) as unknown as Prisma.InputJsonValue,
            acceptedAt: target.acceptedAt ?? new Date(),
          },
          select: {
            id: true,
            parentId: true,
            patientId: true,
            role: true,
            status: true,
            permissions: true,
            invitedByParentId: true,
            acceptedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      return loadLinkWithParent(asRecord(promoted));
    }

    if (isCurrentlyPrimary && updates.assignAsPrimaryParent === false) {
      throw new ParentCompanionServiceError(
        "Cannot remove primary assignment without promoting another parent first.",
        400,
      );
    }

    const mergedPermissions: ParentCompanionPermissions = {
      ...targetPermissions,
      ...updates,
    };

    if (isCurrentlyPrimary) {
      mergedPermissions.assignAsPrimaryParent = true;
    }

    const updated = await prisma.parentPatient.update({
      where: { id: target.id },
      data: {
        permissions: mergedPermissions as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return loadLinkWithParent(asRecord(updated));
  },

  async promoteToPrimary(
    requestingParentId: string | { toString(): string },
    patientId: string | { toString(): string },
    targetParentId: string | { toString(): string },
    permissionsOverride?: Partial<ParentCompanionPermissions>,
  ): Promise<CompanionParentLink> {
    const normalizedRequestingParentId = normalizeId(requestingParentId);
    const normalizedPatientId = normalizeId(patientId);
    const normalizedTargetParentId = normalizeId(targetParentId);

    await ensurePrimaryLinkExists(
      normalizedRequestingParentId,
      normalizedPatientId,
    );

    const target = await prisma.parentPatient.findFirst({
      where: {
        parentId: normalizedTargetParentId,
        patientId: normalizedPatientId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!target) {
      throw new ParentCompanionServiceError("Co-parent link not found.", 404);
    }

    const promoted = await prisma.$transaction(async (tx) => {
      const existingPrimary = await tx.parentPatient.findFirst({
        where: {
          patientId: normalizedPatientId,
          role: "PRIMARY",
          status: "ACTIVE",
          parentId: { not: normalizedTargetParentId },
        },
        select: { id: true },
      });

      if (existingPrimary) {
        await tx.parentPatient.update({
          where: { id: existingPrimary.id },
          data: {
            role: "CO_PARENT",
            permissions: {
              ...BASE_PERMISSIONS,
              assignAsPrimaryParent: false,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return tx.parentPatient.update({
        where: { id: target.id },
        data: {
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: buildPermissions(
            "PRIMARY",
            permissionsOverride,
          ) as unknown as Prisma.InputJsonValue,
          acceptedAt: target.acceptedAt ?? new Date(),
        },
        select: {
          id: true,
          parentId: true,
          patientId: true,
          role: true,
          status: true,
          permissions: true,
          invitedByParentId: true,
          acceptedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return loadLinkWithParent(asRecord(promoted));
  },

  async removeCoParent(
    requestingParentId: string | { toString(): string },
    coParentId: string | { toString(): string },
    patientId: string | { toString(): string },
    soft: boolean,
  ): Promise<void> {
    const normalizedRequestingParentId = normalizeId(requestingParentId);
    const normalizedCoParentId = normalizeId(coParentId);
    const normalizedPatientId = normalizeId(patientId);

    await ensurePrimaryLinkExists(
      normalizedRequestingParentId,
      normalizedPatientId,
    );

    if (soft) {
      const updated = await prisma.parentPatient.updateMany({
        where: {
          parentId: normalizedCoParentId,
          patientId: normalizedPatientId,
          role: "CO_PARENT",
        },
        data: { status: "REVOKED" },
      });

      if (!updated.count) {
        throw new ParentCompanionServiceError("Co-parent link not found.", 404);
      }
      return;
    }

    const deleted = await prisma.parentPatient.deleteMany({
      where: {
        parentId: normalizedCoParentId,
        patientId: normalizedPatientId,
        role: "CO_PARENT",
      },
    });

    if (!deleted.count) {
      throw new ParentCompanionServiceError("Co-parent link not found.", 404);
    }
  },

  async getLinksForCompanion(
    patientId: string | { toString(): string },
  ): Promise<CompanionParentLink[]> {
    const normalizedPatientId = normalizeId(patientId);

    const links = await prisma.parentPatient.findMany({
      where: { patientId: normalizedPatientId },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!links.length) {
      return [];
    }

    const parentIds = Array.from(new Set(links.map((link) => link.parentId)));
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        profileImageUrl: true,
      },
    });
    const parentMap = new Map(parents.map((parent) => [parent.id, parent]));

    return links.map((link) =>
      toCompanionParentLink(
        asRecord(link),
        parentMap.get(link.parentId) ?? undefined,
      ),
    );
  },

  async getLinksForParent(
    parentId: string | { toString(): string },
  ): Promise<CompanionParentLink[]> {
    const normalizedParentId = normalizeId(parentId);

    const links = await prisma.parentPatient.findMany({
      where: { parentId: normalizedParentId },
      select: {
        id: true,
        parentId: true,
        patientId: true,
        role: true,
        status: true,
        permissions: true,
        invitedByParentId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return links.map((link) => toCompanionParentLink(asRecord(link)));
  },

  async getActiveCompanionIdsForParent(
    parentId: string | { toString(): string },
  ): Promise<string[]> {
    const normalizedParentId = normalizeId(parentId);

    const links = await prisma.parentPatient.findMany({
      where: {
        parentId: normalizedParentId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: { patientId: true },
    });

    return links.map((link) => link.patientId);
  },

  async hasAnyLinks(
    parentId: string | { toString(): string },
  ): Promise<boolean> {
    const normalizedParentId = normalizeId(parentId);
    const count = await prisma.parentPatient.count({
      where: { parentId: normalizedParentId },
    });
    return count > 0;
  },

  async deleteLinksForCompanion(
    patientId: string | { toString(): string },
  ): Promise<number> {
    const normalizedPatientId = normalizeId(patientId);
    const result = await prisma.parentPatient.deleteMany({
      where: { patientId: normalizedPatientId },
    });
    return result.count;
  },

  async deleteLinksForParent(
    parentId: string | { toString(): string },
  ): Promise<number> {
    const normalizedParentId = normalizeId(parentId);
    const result = await prisma.parentPatient.deleteMany({
      where: { parentId: normalizedParentId },
    });
    return result.count;
  },

  async ensurePrimaryOwnership(
    parentId: string | { toString(): string },
    patientId: string | { toString(): string },
  ): Promise<void> {
    const normalizedParentId = normalizeId(parentId);
    const normalizedPatientId = normalizeId(patientId);

    const link = await prisma.parentPatient.findFirst({
      where: {
        parentId: normalizedParentId,
        patientId: normalizedPatientId,
        role: "PRIMARY",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!link) {
      throw new ParentCompanionServiceError(
        "You are not authorized to modify this companion.",
        403,
      );
    }
  },
};
