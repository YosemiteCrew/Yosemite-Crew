import AuditTrailModel, {
  AuditActorType,
  AuditEntityType,
  AuditEventType,
  type AuditTrailDocument,
} from "../models/audit-trail";
import logger from "src/utils/logger";
import { ParentModel } from "src/models/parent";
import UserModel from "src/models/user";

export class AuditTrailServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuditTrailServiceError";
  }
}

export type AuditTrailRecordInput = {
  organisationId: string;
  companionId: string;
  eventType: AuditEventType;
  actorType?: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

const ensureSafeString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuditTrailServiceError(`${fieldName} is required`, 400);
  }
  if (value.includes("$") || value.includes(".")) {
    throw new AuditTrailServiceError(`Invalid ${fieldName}`, 400);
  }
  return value.trim();
};

const buildQueryFilters = (params: {
  organisationId: string;
  companionId?: string;
  eventTypes?: AuditEventType[];
  entityTypes?: AuditEntityType[];
  before?: Date;
}) => {
  const filters: Record<string, unknown> = {
    organisationId: ensureSafeString(params.organisationId, "organisationId"),
  };

  if (params.companionId) {
    filters.companionId = ensureSafeString(params.companionId, "companionId");
  }

  if (params.eventTypes?.length) {
    filters.eventType = { $in: params.eventTypes };
  }

  if (params.entityTypes?.length) {
    filters.entityType = { $in: params.entityTypes };
  }

  if (params.before) {
    filters.occurredAt = { $lt: params.before };
  }

  return filters;
};

const buildDisplayName = (
  profile?: { firstName?: string; lastName?: string } | null,
): string | null => {
  if (!profile) return null;
  const parts = [profile.firstName, profile.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};

const resolveActorName = async (params: {
  actorType?: AuditActorType;
  actorId?: string | null;
}): Promise<string | null> => {
  if (!params.actorType || !params.actorId) return null;

  if (params.actorType === "PARENT") {
    const parent = await ParentModel.findById(params.actorId)
      .select("firstName lastName")
      .lean();
    return buildDisplayName(parent ?? null);
  }

  if (params.actorType === "PMS_USER") {
    const user = await UserModel.findOne(
      { userId: params.actorId },
      { firstName: 1, lastName: 1 },
    ).lean();
    return buildDisplayName(user ?? null);
  }

  return null;
};

export const AuditTrailService = {
  async record(input: AuditTrailRecordInput): Promise<AuditTrailDocument> {
    const organisationId = ensureSafeString(
      input.organisationId,
      "organisationId",
    );
    const companionId = ensureSafeString(input.companionId, "companionId");
    const actorName =
      input.actorName ??
      (await resolveActorName({
        actorType: input.actorType,
        actorId: input.actorId ?? null,
      }));

    return AuditTrailModel.create({
      organisationId,
      companionId,
      eventType: input.eventType,
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
      actorName: actorName ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });
  },

  async recordSafely(input: AuditTrailRecordInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      logger.warn("Audit trail record failed", error);
    }
  },

  async listForOrganisation(params: {
    organisationId: string;
    companionId?: string;
    eventTypes?: AuditEventType[];
    entityTypes?: AuditEntityType[];
    limit?: number;
    before?: Date;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const filters = buildQueryFilters({
      organisationId: params.organisationId,
      companionId: params.companionId,
      eventTypes: params.eventTypes,
      entityTypes: params.entityTypes,
      before: params.before,
    });

    const entries = await AuditTrailModel.find(filters)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor =
      entries.length > 0
        ? entries[entries.length - 1].occurredAt.toISOString()
        : null;

    return { entries, nextCursor };
  },

  async listForAppointment(params: {
    organisationId: string;
    appointmentId: string;
    limit?: number;
    before?: Date;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const organisationId = ensureSafeString(
      params.organisationId,
      "organisationId",
    );
    const appointmentId = ensureSafeString(
      params.appointmentId,
      "appointmentId",
    );

    const filters: Record<string, unknown> = {
      organisationId,
      $or: [
        { entityType: "APPOINTMENT", entityId: appointmentId },
        { "metadata.appointmentId": appointmentId },
      ],
    };

    if (params.before) {
      filters.occurredAt = { $lt: params.before };
    }

    const entries = await AuditTrailModel.find(filters)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor =
      entries.length > 0
        ? entries[entries.length - 1].occurredAt.toISOString()
        : null;

    return { entries, nextCursor };
  },
};
