import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class PatientConsentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PatientConsentError";
  }
}

type ConsentType =
  | "SURGICAL"
  | "ANESTHESIA"
  | "DIAGNOSTIC"
  | "TREATMENT"
  | "DATA_SHARING"
  | "DNR"
  | "OTHER";
type ConsentStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface GrantConsentParams {
  organisationId: string;
  patientId: string;
  consentType: ConsentType;
  procedureDesc?: string;
  consentedBy?: string;
  consentedByName?: string;
  consentedAt?: Date;
  expiresAt?: Date;
  witnessedBy?: string;
  documentId?: string;
  notes?: string;
}

export interface ListConsentsParams {
  organisationId: string;
  patientId?: string;
  status?: ConsentStatus;
  consentType?: ConsentType;
}

const consentSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  consentType: true,
  status: true,
  procedureDesc: true,
  consentedBy: true,
  consentedByName: true,
  consentedAt: true,
  expiresAt: true,
  witnessedBy: true,
  revokedAt: true,
  revokedReason: true,
  documentId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientConsentSelect;

const assertConsent = async (id: string, organisationId: string) => {
  const record = await prisma.patientConsent.findFirst({
    where: { id, organisationId },
    select: consentSelect,
  });
  if (!record) {
    throw new PatientConsentError("Consent record not found.", 404);
  }
  return record;
};

export const PatientConsentService = {
  async grant(params: GrantConsentParams) {
    const {
      organisationId,
      patientId,
      consentType,
      procedureDesc,
      consentedBy,
      consentedByName,
      consentedAt,
      expiresAt,
      witnessedBy,
      documentId,
      notes,
    } = params;

    const record = await prisma.patientConsent.create({
      data: {
        organisationId,
        patientId,
        consentType,
        status: "ACTIVE",
        procedureDesc: procedureDesc ?? null,
        consentedBy: consentedBy ?? null,
        consentedByName: consentedByName ?? null,
        consentedAt: consentedAt ?? new Date(),
        expiresAt: expiresAt ?? null,
        witnessedBy: witnessedBy ?? null,
        documentId: documentId ?? null,
        notes: notes ?? null,
      },
      select: consentSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "CONSENT_GRANTED",
      actorType: "PMS_USER",
      actorId: consentedBy ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { consentType, consentedByName: consentedByName ?? null },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertConsent(id, organisationId);
  },

  async list(params: ListConsentsParams) {
    const { organisationId, patientId, status, consentType } = params;
    return prisma.patientConsent.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(consentType ? { consentType } : {}),
      },
      select: consentSelect,
      orderBy: { consentedAt: "desc" },
    });
  },

  async revoke(
    id: string,
    organisationId: string,
    revokedReason: string | undefined,
    revokedBy?: string,
  ) {
    const record = await assertConsent(id, organisationId);
    if (record.status === "REVOKED") {
      throw new PatientConsentError("Consent is already revoked.", 409);
    }

    const updated = await prisma.patientConsent.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: revokedReason ?? null,
      },
      select: consentSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "CONSENT_REVOKED",
      actorType: "PMS_USER",
      actorId: revokedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {
        consentType: record.consentType,
        revokedReason: revokedReason ?? null,
      },
    });

    return updated;
  },
};
