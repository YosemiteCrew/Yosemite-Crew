import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ClinicalAlertLogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClinicalAlertLogError";
  }
}

type ClinicalAlertType =
  | "DRUG_INTERACTION"
  | "CRITICAL_LAB_VALUE"
  | "OVERDUE_VACCINATION"
  | "ALLERGY_CONTRAINDICATION"
  | "DOSE_CHECK"
  | "ABNORMAL_VITALS"
  | "SPECIALIST_REVIEW_DUE"
  | "WEIGHT_THRESHOLD"
  | "OTHER";

type ClinicalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface CreateAlertParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  alertType: ClinicalAlertType;
  severity?: ClinicalAlertSeverity;
  title: string;
  body?: string;
  triggeredBy?: string;
}

const alertSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  alertType: true,
  severity: true,
  title: true,
  body: true,
  triggeredBy: true,
  acknowledgedAt: true,
  acknowledgedBy: true,
  acknowledgedNote: true,
  dismissed: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicalAlertLogSelect;

const assertAlert = async (id: string, organisationId: string) => {
  const alert = await prisma.clinicalAlertLog.findFirst({
    where: { id, organisationId },
    select: alertSelect,
  });
  if (!alert) throw new ClinicalAlertLogError("Clinical alert not found.", 404);
  return alert;
};

export const ClinicalAlertLogService = {
  async trigger(params: CreateAlertParams) {
    const alert = await prisma.clinicalAlertLog.create({
      data: {
        organisationId: params.organisationId,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        alertType: params.alertType,
        severity: params.severity ?? "WARNING",
        title: params.title,
        body: params.body ?? null,
        triggeredBy: params.triggeredBy ?? null,
        dismissed: false,
      },
      select: alertSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.patientId,
      eventType: "CLINICAL_ALERT_TRIGGERED",
      actorType: "PMS_USER",
      actorId: null,
      entityType: "COMPANION",
      entityId: params.patientId,
      metadata: {
        alertType: params.alertType,
        severity: params.severity ?? "WARNING",
        title: params.title,
      },
    });

    return alert;
  },

  async get(id: string, organisationId: string) {
    return assertAlert(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    encounterId?: string;
    severity?: ClinicalAlertSeverity;
    alertType?: ClinicalAlertType;
    dismissed?: boolean;
  }) {
    const {
      organisationId,
      patientId,
      encounterId,
      severity,
      alertType,
      dismissed,
    } = params;
    return prisma.clinicalAlertLog.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(severity ? { severity } : {}),
        ...(alertType ? { alertType } : {}),
        ...(dismissed !== undefined ? { dismissed } : {}),
      },
      select: alertSelect,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
  },

  async acknowledge(
    id: string,
    organisationId: string,
    acknowledgedBy: string,
    note?: string,
  ) {
    const existing = await assertAlert(id, organisationId);
    if (existing.acknowledgedAt) {
      throw new ClinicalAlertLogError(
        "Alert has already been acknowledged.",
        409,
      );
    }

    const alert = await prisma.clinicalAlertLog.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy,
        acknowledgedNote: note ?? null,
      },
      select: alertSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "CLINICAL_ALERT_ACKNOWLEDGED",
      actorType: "PMS_USER",
      actorId: acknowledgedBy,
      entityType: "COMPANION",
      entityId: existing.patientId,
      metadata: { alertType: existing.alertType },
    });

    return alert;
  },

  async dismiss(id: string, organisationId: string) {
    const existing = await assertAlert(id, organisationId);
    if (existing.dismissed) {
      throw new ClinicalAlertLogError("Alert is already dismissed.", 409);
    }
    return prisma.clinicalAlertLog.update({
      where: { id },
      data: { dismissed: true },
      select: alertSelect,
    });
  },
};
