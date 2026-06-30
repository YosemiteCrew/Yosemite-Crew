import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class TelemedicineSessionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TelemedicineSessionError";
  }
}

type TelemedicinePlatform = "VIDEO_CALL" | "PHONE_CALL" | "CHAT" | "EMAIL";
type TelemedicineStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

const TERMINAL_STATUSES: TelemedicineStatus[] = [
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

export interface CreateTelemedicineSessionParams {
  organisationId: string;
  clientId: string;
  patientId?: string;
  appointmentId?: string;
  platform: TelemedicinePlatform;
  conductedBy?: string;
  chiefComplaint?: string;
  externalSessionId?: string;
}

const sessionSelect = {
  id: true,
  organisationId: true,
  appointmentId: true,
  clientId: true,
  patientId: true,
  platform: true,
  status: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  conductedBy: true,
  chiefComplaint: true,
  clinicianNotes: true,
  followUpRequired: true,
  recordingUrl: true,
  externalSessionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TelemedicineSessionSelect;

const assertSession = async (id: string, organisationId: string) => {
  const session = await prisma.telemedicineSession.findFirst({
    where: { id, organisationId },
    select: sessionSelect,
  });
  if (!session)
    throw new TelemedicineSessionError("Telemedicine session not found.", 404);
  return session;
};

export const TelemedicineSessionService = {
  async schedule(params: CreateTelemedicineSessionParams) {
    return prisma.telemedicineSession.create({
      data: {
        organisationId: params.organisationId,
        clientId: params.clientId,
        patientId: params.patientId ?? null,
        appointmentId: params.appointmentId ?? null,
        platform: params.platform,
        status: "SCHEDULED",
        conductedBy: params.conductedBy ?? null,
        chiefComplaint: params.chiefComplaint ?? null,
        externalSessionId: params.externalSessionId ?? null,
      },
      select: sessionSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertSession(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    clientId?: string;
    patientId?: string;
    status?: TelemedicineStatus;
    platform?: TelemedicinePlatform;
  }) {
    const { organisationId, clientId, patientId, status, platform } = params;
    return prisma.telemedicineSession.findMany({
      where: {
        organisationId,
        ...(clientId ? { clientId } : {}),
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
      select: sessionSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async start(id: string, organisationId: string) {
    const existing = await assertSession(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as TelemedicineStatus)) {
      throw new TelemedicineSessionError(
        `Cannot start a session with status ${existing.status}.`,
        409,
      );
    }
    const session = await prisma.telemedicineSession.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      select: sessionSelect,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId ?? "",
      eventType: "TELEMEDICINE_SESSION_STARTED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { platform: existing.platform, clientId: existing.clientId },
    });
    return session;
  },

  async complete(
    id: string,
    organisationId: string,
    params: {
      clinicianNotes?: string;
      followUpRequired?: boolean;
      recordingUrl?: string;
    },
  ) {
    const existing = await assertSession(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as TelemedicineStatus)) {
      throw new TelemedicineSessionError(
        `Cannot complete a session with status ${existing.status}.`,
        409,
      );
    }

    const endedAt = new Date();
    const startedAt = existing.startedAt ?? endedAt;
    const durationMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000,
    );

    const session = await prisma.telemedicineSession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endedAt,
        durationMinutes,
        clinicianNotes: params.clinicianNotes ?? null,
        followUpRequired: params.followUpRequired ?? false,
        recordingUrl: params.recordingUrl ?? null,
      },
      select: sessionSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId ?? "",
      eventType: "TELEMEDICINE_SESSION_COMPLETED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { durationMinutes, platform: existing.platform },
    });

    return session;
  },

  async cancel(id: string, organisationId: string) {
    const existing = await assertSession(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as TelemedicineStatus)) {
      throw new TelemedicineSessionError(
        `Cannot cancel a session with status ${existing.status}.`,
        409,
      );
    }
    return prisma.telemedicineSession.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: sessionSelect,
    });
  },

  async markNoShow(id: string, organisationId: string) {
    const existing = await assertSession(id, organisationId);
    if (TERMINAL_STATUSES.includes(existing.status as TelemedicineStatus)) {
      throw new TelemedicineSessionError(
        `Cannot mark no-show for a session with status ${existing.status}.`,
        409,
      );
    }
    return prisma.telemedicineSession.update({
      where: { id },
      data: { status: "NO_SHOW" },
      select: sessionSelect,
    });
  },
};
