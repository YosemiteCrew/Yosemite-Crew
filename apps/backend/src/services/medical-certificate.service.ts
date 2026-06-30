import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class MedicalCertificateError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MedicalCertificateError";
  }
}

type MedicalCertificateType =
  | "HEALTH_CERTIFICATE"
  | "VACCINATION_CERTIFICATE"
  | "FIT_FOR_TRAVEL"
  | "EXPORT_CERTIFICATE"
  | "BOARDING_CLEARANCE"
  | "BREEDING_CLEARANCE"
  | "OTHER";

type MedicalCertificateStatus = "DRAFT" | "ISSUED" | "EXPIRED" | "REVOKED";

const TERMINAL_STATUSES: MedicalCertificateStatus[] = ["REVOKED", "EXPIRED"];

export interface CreateCertificateParams {
  organisationId: string;
  patientId: string;
  clientId: string;
  encounterId?: string;
  appointmentId?: string;
  certificateType: MedicalCertificateType;
  issuedBy?: string;
  validForTravel?: boolean;
  destinationCountry?: string;
  clinicalFindings?: string;
  restrictions?: string;
  notes?: string;
}

const certSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  clientId: true,
  encounterId: true,
  appointmentId: true,
  certificateType: true,
  status: true,
  issueNumber: true,
  issuedAt: true,
  expiresAt: true,
  issuedBy: true,
  validForTravel: true,
  destinationCountry: true,
  clinicalFindings: true,
  restrictions: true,
  notes: true,
  revokedAt: true,
  revokedReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MedicalCertificateSelect;

const generateIssueNumber = (organisationId: string): string => {
  const prefix = organisationId.slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `CERT-${prefix}-${ts}`;
};

const assertCertificate = async (id: string, organisationId: string) => {
  const cert = await prisma.medicalCertificate.findFirst({
    where: { id, organisationId },
    select: certSelect,
  });
  if (!cert)
    throw new MedicalCertificateError("Medical certificate not found.", 404);
  return cert;
};

export const MedicalCertificateService = {
  async create(params: CreateCertificateParams) {
    return prisma.medicalCertificate.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        clientId: params.clientId,
        encounterId: params.encounterId ?? null,
        appointmentId: params.appointmentId ?? null,
        certificateType: params.certificateType,
        status: "DRAFT",
        issuedBy: params.issuedBy ?? null,
        validForTravel: params.validForTravel ?? false,
        destinationCountry: params.destinationCountry ?? null,
        clinicalFindings: params.clinicalFindings ?? null,
        restrictions: params.restrictions ?? null,
        notes: params.notes ?? null,
      },
      select: certSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertCertificate(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    clientId?: string;
    status?: MedicalCertificateStatus;
    certificateType?: MedicalCertificateType;
  }) {
    const { organisationId, patientId, clientId, status, certificateType } =
      params;
    return prisma.medicalCertificate.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(status ? { status } : {}),
        ...(certificateType ? { certificateType } : {}),
      },
      select: certSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async issue(
    id: string,
    organisationId: string,
    params: {
      issuedBy: string;
      expiresAt?: Date;
      clinicalFindings?: string;
      restrictions?: string;
      notes?: string;
    },
  ) {
    const existing = await assertCertificate(id, organisationId);
    if (
      TERMINAL_STATUSES.includes(existing.status as MedicalCertificateStatus)
    ) {
      throw new MedicalCertificateError(
        `Cannot issue a certificate with status ${existing.status}.`,
        409,
      );
    }
    if (existing.status === "ISSUED") {
      throw new MedicalCertificateError("Certificate is already issued.", 409);
    }

    const cert = await prisma.medicalCertificate.update({
      where: { id },
      data: {
        status: "ISSUED",
        issueNumber: generateIssueNumber(organisationId),
        issuedAt: new Date(),
        issuedBy: params.issuedBy,
        expiresAt: params.expiresAt ?? null,
        clinicalFindings: params.clinicalFindings ?? existing.clinicalFindings,
        restrictions: params.restrictions ?? existing.restrictions,
        notes: params.notes ?? existing.notes,
      },
      select: certSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "MEDICAL_CERTIFICATE_ISSUED",
      actorType: "PMS_USER",
      actorId: params.issuedBy,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {
        certificateId: id,
        issueNumber: cert.issueNumber,
        certificateType: existing.certificateType,
      },
    });

    return cert;
  },

  async revoke(
    id: string,
    organisationId: string,
    revokedBy: string,
    revokedReason?: string,
  ) {
    const existing = await assertCertificate(id, organisationId);
    if (existing.status === "REVOKED") {
      throw new MedicalCertificateError("Certificate is already revoked.", 409);
    }

    const cert = await prisma.medicalCertificate.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: revokedReason ?? null,
      },
      select: certSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "MEDICAL_CERTIFICATE_REVOKED",
      actorType: "PMS_USER",
      actorId: revokedBy,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: {
        certificateId: id,
        issueNumber: existing.issueNumber,
        revokedReason,
      },
    });

    return cert;
  },

  async expire(id: string, organisationId: string) {
    const existing = await assertCertificate(id, organisationId);
    if (
      TERMINAL_STATUSES.includes(existing.status as MedicalCertificateStatus)
    ) {
      throw new MedicalCertificateError(
        `Cannot expire a certificate with status ${existing.status}.`,
        409,
      );
    }
    return prisma.medicalCertificate.update({
      where: { id },
      data: { status: "EXPIRED" },
      select: certSelect,
    });
  },
};
