import AuditTrailModel, {
  AuditActorType,
  AuditEntityType,
  AuditEventType,
  type AuditTrailDocument,
} from "../models/audit-trail";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import logger from "src/utils/logger";
import { ParentModel } from "src/models/parent";
import UserModel from "src/models/user";
import { isReadFromPostgres } from "src/config/read-switch";

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
  patientId: string;
  eventType: AuditEventType;
  actorType?: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

const toPrismaAuditEntityType = (
  value: AuditEntityType | undefined,
): AuditEntityType | undefined => {
  if (value === "PATIENT_ORGANISATION") return "PATIENT_ORGANISATION";
  return value;
};

const toPrismaAuditEventType = (
  value: AuditEventType | undefined,
): AuditEventType | undefined => {
  if (!value) return value;
  if (value.startsWith("COMPANION_ORG_")) {
    return value.replace("COMPANION_ORG_", "PATIENT_ORG_") as AuditEventType;
  }
  return value;
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
  patientId?: string;
  eventTypes?: AuditEventType[];
  entityTypes?: AuditEntityType[];
  before?: Date;
}) => {
  const filters: Record<string, unknown> = {
    organisationId: ensureSafeString(params.organisationId, "organisationId"),
  };

  if (params.patientId) {
    filters.patientId = ensureSafeString(params.patientId, "patientId");
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

const buildCursorResponse = <T extends { occurredAt: Date }>(entries: T[]) => {
  const nextCursor =
    entries.length > 0 ? entries.at(-1)!.occurredAt.toISOString() : null;
  return { entries, nextCursor };
};

const resolveActorName = async (params: {
  actorType?: AuditActorType;
  actorId?: string | null;
}): Promise<string | null> => {
  if (!params.actorType || !params.actorId) return null;

  if (params.actorType === "PARENT") {
    const parent = isReadFromPostgres()
      ? await prisma.parent.findFirst({
          where: { id: params.actorId },
          select: { firstName: true, lastName: true },
        })
      : await ParentModel.findById(params.actorId)
          .select("firstName lastName")
          .lean();
    return buildDisplayName(
      parent
        ? {
            firstName: parent.firstName ?? undefined,
            lastName: parent.lastName ?? undefined,
          }
        : null,
    );
  }

  if (params.actorType === "PMS_USER") {
    const user = isReadFromPostgres()
      ? await prisma.user.findFirst({
          where: { userId: params.actorId },
          select: { firstName: true, lastName: true },
        })
      : await UserModel.findOne(
          { userId: params.actorId },
          { firstName: 1, lastName: 1 },
        ).lean();
    return buildDisplayName(
      user
        ? {
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
          }
        : null,
    );
  }

  return null;
};

export const AuditTrailService = {
  async record(input: AuditTrailRecordInput): Promise<AuditTrailDocument> {
    const organisationId = ensureSafeString(
      input.organisationId,
      "organisationId",
    );
    const patientId = ensureSafeString(input.patientId, "patientId");
    const eventType =
      toPrismaAuditEventType(input.eventType) ?? input.eventType;
    const entityType = toPrismaAuditEntityType(input.entityType);
    const actorName =
      input.actorName ??
      (await resolveActorName({
        actorType: input.actorType,
        actorId: input.actorId ?? null,
      }));

    if (isReadFromPostgres()) {
      const doc = await prisma.auditTrail.create({
        data: {
          organisationId,
          patientId,
          eventType,
          actorType: input.actorType ?? undefined,
          actorId: input.actorId ?? undefined,
          actorName: actorName ?? undefined,
          entityType,
          entityId: input.entityId ?? undefined,
          metadata: (input.metadata ??
            undefined) as unknown as Prisma.InputJsonValue,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
      return doc as unknown as AuditTrailDocument;
    }

    const doc = await AuditTrailModel.create({
      organisationId,
      patientId,
      eventType: input.eventType,
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
      actorName: actorName ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });

    if (shouldDualWrite) {
      try {
        await prisma.auditTrail.create({
          data: {
            id: doc._id.toString(),
            organisationId,
            patientId,
            eventType,
            actorType: input.actorType ?? undefined,
            actorId: input.actorId ?? undefined,
            actorName: actorName ?? undefined,
            entityType,
            entityId: input.entityId ?? undefined,
            metadata: (input.metadata ??
              undefined) as unknown as Prisma.InputJsonValue,
            occurredAt: input.occurredAt ?? new Date(),
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("AuditTrail", err);
      }
    }

    return doc;
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
    patientId?: string;
    eventTypes?: AuditEventType[];
    entityTypes?: AuditEntityType[];
    limit?: number;
    before?: Date;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const filters = buildQueryFilters({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventTypes: params.eventTypes,
      entityTypes: params.entityTypes,
      before: params.before,
    });

    if (isReadFromPostgres()) {
      const where: Prisma.AuditTrailWhereInput = {
        organisationId: filters.organisationId as string,
      };
      if (filters.patientId) where.patientId = filters.patientId as string;
      if (params.eventTypes?.length)
        where.eventType = {
          in: params.eventTypes.map(
            (value) => toPrismaAuditEventType(value) ?? value,
          ),
        };
      if (params.entityTypes?.length)
        where.entityType = {
          in: params.entityTypes.map(
            (value) => toPrismaAuditEntityType(value) ?? value,
          ),
        };
      if (filters.occurredAt) {
        where.occurredAt = { lt: (filters.occurredAt as { $lt: Date }).$lt };
      }

      const entries = await prisma.auditTrail.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: limit,
      });

      return buildCursorResponse(entries);
    }

    const entries = await AuditTrailModel.find(filters)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    return buildCursorResponse(entries);
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

    if (isReadFromPostgres()) {
      const where: Prisma.AuditTrailWhereInput = {
        organisationId,
        OR: [
          { entityType: "APPOINTMENT", entityId: appointmentId },
          {
            metadata: {
              path: ["appointmentId"],
              equals: appointmentId,
            },
          },
        ],
      };

      if (params.before) {
        where.occurredAt = { lt: params.before };
      }

      const entries = await prisma.auditTrail.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: limit,
      });

      return buildCursorResponse(entries);
    }

    const entries = await AuditTrailModel.find(filters)
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean();

    return buildCursorResponse(entries);
  },
};
