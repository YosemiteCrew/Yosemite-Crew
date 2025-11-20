import { Types } from "mongoose";
import ParentCompanionModel, {
  toCompanionParentLink,
  type ParentCompanionDocument,
  type ParentCompanionMongo,
} from "../models/parent-companion";
import type {
  CompanionParentLink,
  ParentCompanionPermissions,
  ParentCompanionRole,
  ParentCompanionStatus,
} from "@yosemite-crew/types";

export class ParentCompanionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ParentCompanionServiceError";
  }
}

// Permissions Preset

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
  return {
    ...base,
    ...overrides,
  };
};

const isDuplicateKeyError = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

// Types

interface LinkParentInput {
  parentId: Types.ObjectId;
  companionId: Types.ObjectId;
  role?: ParentCompanionRole;
  permissionsOverride?: Partial<ParentCompanionPermissions>;
  invitedByParentId?: Types.ObjectId;
  status?: ParentCompanionStatus; // optional override (default: PRIMARY→ACTIVE, CO_PARENT→PENDING)
}

export const ParentCompanionService = {
  /**
   * Link a parent to a companion.
   *
   * Used by:
   *  - PMS creating parent + companion (PRIMARY, ACTIVE)
   *  - Mobile creating companion (PRIMARY, ACTIVE)
   *  - Inviting a co-parent (CO_PARENT, PENDING by default)
   */
  async linkParent({
    parentId,
    companionId,
    role = "PRIMARY",
    permissionsOverride,
    invitedByParentId,
    status,
  }: LinkParentInput): Promise<ParentCompanionDocument> {
    if (!parentId || !companionId) {
      throw new ParentCompanionServiceError(
        "Parent and companion identifiers are required.",
        400,
      );
    }

    const effectiveStatus: ParentCompanionStatus =
      status ?? (role === "PRIMARY" ? "ACTIVE" : "PENDING");

    const permissions = buildPermissions(role, permissionsOverride);

    const payload: ParentCompanionMongo = {
      parentId,
      companionId,
      role,
      status: effectiveStatus,
      permissions,
      invitedByParentId,
    };

    try {
      const [document] = await ParentCompanionModel.create([payload]);
      return document;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const message =
          role === "PRIMARY"
            ? "Companion already has an active primary parent."
            : "Parent is already linked to this companion.";
        throw new ParentCompanionServiceError(message, 409);
      }

      throw error;
    }
  },

  /**
   * Accept a pending (PENDING) link for a parent+companion.
   * Typically used when a co-parent accepts invitation.
   */
  async activateLink(
    parentId: Types.ObjectId,
    companionId: Types.ObjectId,
  ): Promise<ParentCompanionDocument | null> {
    const document = await ParentCompanionModel.findOneAndUpdate(
      { parentId, companionId, status: "PENDING" },
      { $set: { status: "ACTIVE", acceptedAt: new Date() } },
      { new: true, sanitizeFilter: true },
    );

    return document;
  },

  /**
   * Revoke / remove a single link (used when deleting a specific co-parent).
   * This does NOT delete the document; it just marks it as REVOKED.
   */
  async revokeLink(linkId: Types.ObjectId): Promise<ParentCompanionDocument> {
    const document = await ParentCompanionModel.findByIdAndUpdate(
      linkId,
      { $set: { status: "REVOKED" } },
      { new: true },
    );

    if (!document) {
      throw new ParentCompanionServiceError("Link not found.", 404);
    }

    return document;
  },

  /**
   * Update permissions for a link.
   *
   * Special handling:
   *  - If assignAsPrimaryParent is toggled ON for a co-parent,
   *    this will TRANSFER primary ownership:
   *      - Old primary becomes CO_PARENT with base permissions
   *      - This link becomes PRIMARY with full permissions
   */
  async updatePermissions(
    linkId: Types.ObjectId,
    updates: Partial<ParentCompanionPermissions>,
  ): Promise<CompanionParentLink> {
    const document = await ParentCompanionModel.findById(linkId);

    if (!document) {
      throw new ParentCompanionServiceError("Link not found.", 404);
    }

    const isCurrentlyPrimary =
      document.role === "PRIMARY" && document.status === "ACTIVE";

    const wantsPrimary = updates.assignAsPrimaryParent === true;

    // If co-parent wants to become primary
    if (wantsPrimary && !isCurrentlyPrimary) {
      const { companionId } = document;

      // Demote existing primary (if any)
      const existingPrimary = await ParentCompanionModel.findOne({
        companionId,
        role: "PRIMARY",
        status: "ACTIVE",
      });

      if (
        existingPrimary &&
        existingPrimary._id.toString() !== document._id.toString()
      ) {
        existingPrimary.role = "CO_PARENT";
        existingPrimary.permissions = {
          ...BASE_PERMISSIONS,
          assignAsPrimaryParent: false,
        };
        await existingPrimary.save();
      }

      // Promote this link to PRIMARY
      document.role = "PRIMARY";
      document.status = "ACTIVE";
      document.permissions = buildPermissions("PRIMARY", updates);
      document.acceptedAt = document.acceptedAt ?? new Date();

      try {
        await document.save();
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          // Race condition: another primary got promoted in between
          throw new ParentCompanionServiceError(
            "Companion already has an active primary parent.",
            409,
          );
        }
        throw error;
      }

      return toCompanionParentLink(document);
    }

    // Otherwise: normal permission update
    const mergedPermissions: ParentCompanionPermissions = {
      ...document.permissions,
      ...updates,
    };

    // Never allow removing "assignAsPrimaryParent" from the current primary,
    // to avoid having a companion with no primary at all.
    if (isCurrentlyPrimary) {
      mergedPermissions.assignAsPrimaryParent = true;
    }

    document.permissions = mergedPermissions;
    await document.save();

    return toCompanionParentLink(document);
  },

  /**
   * Get all parent links for a given companion.
   */
  async getLinksForCompanion(
    companionId: Types.ObjectId,
  ): Promise<CompanionParentLink[]> {
    const documents = await ParentCompanionModel.find({ companionId }, null, {
      lean: false,
      sanitizeFilter: true,
    });

    return documents.map((document) => toCompanionParentLink(document));
  },

  /**
   * Get all companion links for a given parent.
   */
  async getLinksForParent(
    parentId: Types.ObjectId,
  ): Promise<CompanionParentLink[]> {
    const documents = await ParentCompanionModel.find({ parentId }, null, {
      lean: false,
      sanitizeFilter: true,
    });

    return documents.map((document) => toCompanionParentLink(document));
  },

  /**
   * Return active (and pending) companion ids for a parent.
   * Used when listing companions for a parent account.
   */
  async getActiveCompanionIdsForParent(
    parentId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const documents = await ParentCompanionModel.find(
      { parentId, status: { $in: ["ACTIVE", "PENDING"] } },
      { companionId: 1 },
    );

    return documents.map((doc) => doc.companionId);
  },

  /**
   * Check if a parent has ANY links at all.
   * Useful before deleting a parent record.
   */
  async hasAnyLinks(parentId: Types.ObjectId): Promise<boolean> {
    const count = await ParentCompanionModel.countDocuments({ parentId });
    return count > 0;
  },

  /**
   * Hard delete all links for a companion.
   * Use when the companion itself is being deleted.
   */
  async deleteLinksForCompanion(companionId: Types.ObjectId): Promise<number> {
    const result = await ParentCompanionModel.deleteMany({ companionId });
    return result.deletedCount ?? 0;
  },

  /**
   * Hard delete all links for a parent.
   * Use when the parent itself is being deleted.
   */
  async deleteLinksForParent(parentId: Types.ObjectId): Promise<number> {
    const result = await ParentCompanionModel.deleteMany({ parentId });
    return result.deletedCount ?? 0;
  },

  /**
   * Ensure that a given parent is the ACTIVE PRIMARY parent for a companion.
   * Use this before allowing destructive actions on a companion
   * (e.g., delete, edit core profile, transfer ownership).
   */
  async ensurePrimaryOwnership(
    parentId: Types.ObjectId,
    companionId: Types.ObjectId,
  ): Promise<void> {
    const link = await ParentCompanionModel.findOne(
      { parentId, companionId, role: "PRIMARY", status: "ACTIVE" },
      null,
      { sanitizeFilter: true },
    );

    if (!link) {
      throw new ParentCompanionServiceError(
        "You are not authorized to modify this companion.",
        403,
      );
    }
  },
};
