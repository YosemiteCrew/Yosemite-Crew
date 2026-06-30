import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class IsolationProtocolError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "IsolationProtocolError";
  }
}

type IsolationReason =
  | "PARVOVIRUS"
  | "DISTEMPER"
  | "RINGWORM"
  | "MRSA"
  | "RESPIRATORY_INFECTION"
  | "GASTROINTESTINAL_INFECTION"
  | "TICK_BORNE_DISEASE"
  | "UNDIAGNOSED_CONTAGIOUS"
  | "POST_OP_PRECAUTION"
  | "OTHER";

type IsolationLevel =
  | "STANDARD"
  | "CONTACT"
  | "DROPLET"
  | "AIRBORNE"
  | "STRICT";

export interface CreateIsolationParams {
  organisationId: string;
  patientId: string;
  reason?: IsolationReason;
  level?: IsolationLevel;
  unitId?: string;
  startedAt: Date;
  initiatedBy?: string;
  ppe?: string[];
  notes?: string;
}

export interface EndIsolationParams {
  endedAt: Date;
  endedBy?: string;
  notes?: string;
}

const isolationSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  reason: true,
  level: true,
  unitId: true,
  startedAt: true,
  endedAt: true,
  initiatedBy: true,
  endedBy: true,
  ppe: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IsolationProtocolSelect;

const assertProtocol = async (id: string, organisationId: string) => {
  const protocol = await prisma.isolationProtocol.findFirst({
    where: { id, organisationId },
    select: isolationSelect,
  });
  if (!protocol) {
    throw new IsolationProtocolError("Isolation protocol not found.", 404);
  }
  return protocol;
};

export const IsolationProtocolService = {
  async start(params: CreateIsolationParams) {
    const { organisationId, patientId, initiatedBy, ...rest } = params;

    const protocol = await prisma.isolationProtocol.create({
      data: {
        organisationId,
        patientId,
        reason: rest.reason ?? "OTHER",
        level: rest.level ?? "CONTACT",
        unitId: rest.unitId ?? null,
        startedAt: rest.startedAt,
        initiatedBy: initiatedBy ?? null,
        ppe: rest.ppe ?? [],
        notes: rest.notes ?? null,
      },
      select: isolationSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "ISOLATION_PROTOCOL_STARTED",
      actorType: "PMS_USER",
      actorId: initiatedBy ?? null,
      entityType: "COMPANION",
      entityId: protocol.id,
      metadata: {
        reason: rest.reason ?? "OTHER",
        level: rest.level ?? "CONTACT",
      },
    });

    return protocol;
  },

  async get(id: string, organisationId: string) {
    return assertProtocol(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    active?: boolean;
    reason?: IsolationReason;
  }) {
    const { organisationId, patientId, active, reason } = params;
    return prisma.isolationProtocol.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(reason ? { reason } : {}),
        ...(active === true ? { endedAt: null } : {}),
        ...(active === false ? { endedAt: { not: null } } : {}),
      },
      select: isolationSelect,
      orderBy: { startedAt: "desc" },
    });
  },

  async end(id: string, organisationId: string, params: EndIsolationParams) {
    const existing = await assertProtocol(id, organisationId);
    if (existing.endedAt) {
      throw new IsolationProtocolError(
        "Isolation protocol is already ended.",
        409,
      );
    }

    const protocol = await prisma.isolationProtocol.update({
      where: { id },
      data: {
        endedAt: params.endedAt,
        endedBy: params.endedBy ?? null,
        notes: params.notes !== undefined ? params.notes : existing.notes,
      },
      select: isolationSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "ISOLATION_PROTOCOL_ENDED",
      actorType: "PMS_USER",
      actorId: params.endedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { endedAt: params.endedAt.toISOString() },
    });

    return protocol;
  },

  async update(
    id: string,
    organisationId: string,
    params: Partial<
      Pick<CreateIsolationParams, "level" | "ppe" | "notes" | "unitId">
    >,
  ) {
    await assertProtocol(id, organisationId);

    const data: Prisma.IsolationProtocolUpdateInput = {};
    if (params.level !== undefined) data.level = params.level;
    if (params.ppe !== undefined) data.ppe = params.ppe;
    if (params.notes !== undefined) data.notes = params.notes;
    if (params.unitId !== undefined) data.unitId = params.unitId;

    return prisma.isolationProtocol.update({
      where: { id },
      data,
      select: isolationSelect,
    });
  },
};
