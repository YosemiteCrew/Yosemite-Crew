import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class InsuranceClaimError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "InsuranceClaimError";
  }
}

type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED";

export interface CreateInsuranceClaimParams {
  organisationId: string;
  patientId: string;
  invoiceId?: string;
  encounterId?: string;
  insurerName: string;
  policyNumber: string;
  submittedAmount: number;
  currency?: string;
  notes?: string;
  createdBy?: string;
}

export interface UpdateInsuranceClaimParams {
  insurerName?: string;
  policyNumber?: string;
  claimNumber?: string;
  submittedAmount?: number;
  notes?: string;
  externalClaimRef?: string;
}

export interface UpdateClaimStatusParams {
  status: ClaimStatus;
  approvedAmount?: number;
  paidAmount?: number;
  rejectionReason?: string;
  claimNumber?: string;
  externalClaimRef?: string;
  updatedBy?: string;
}

export interface ListInsuranceClaimsParams {
  organisationId: string;
  patientId?: string;
  status?: ClaimStatus;
  invoiceId?: string;
}

const claimSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  invoiceId: true,
  encounterId: true,
  insurerName: true,
  policyNumber: true,
  claimNumber: true,
  submittedAmount: true,
  approvedAmount: true,
  paidAmount: true,
  currency: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  paidAt: true,
  rejectionReason: true,
  notes: true,
  externalClaimRef: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InsuranceClaimSelect;

const assertClaim = async (id: string, organisationId: string) => {
  const claim = await prisma.insuranceClaim.findFirst({
    where: { id, organisationId },
    select: claimSelect,
  });
  if (!claim) {
    throw new InsuranceClaimError("Insurance claim not found.", 404);
  }
  return claim;
};

export const InsuranceClaimService = {
  async create(params: CreateInsuranceClaimParams) {
    const {
      organisationId,
      patientId,
      invoiceId,
      encounterId,
      insurerName,
      policyNumber,
      submittedAmount,
      currency,
      notes,
      createdBy,
    } = params;

    const claim = await prisma.insuranceClaim.create({
      data: {
        organisationId,
        patientId,
        invoiceId: invoiceId ?? null,
        encounterId: encounterId ?? null,
        insurerName,
        policyNumber,
        submittedAmount,
        currency: currency ?? "GBP",
        notes: notes ?? null,
        status: "DRAFT",
      },
      select: claimSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "INSURANCE_CLAIM_CREATED",
      actorType: "PMS_USER",
      actorId: createdBy ?? null,
      entityType: "INVOICE",
      entityId: claim.id,
      metadata: { insurerName, policyNumber, submittedAmount, invoiceId },
    });

    return claim;
  },

  async get(id: string, organisationId: string) {
    return assertClaim(id, organisationId);
  },

  async list(params: ListInsuranceClaimsParams) {
    const { organisationId, patientId, status, invoiceId } = params;
    return prisma.insuranceClaim.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
        ...(invoiceId ? { invoiceId } : {}),
      },
      select: claimSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateInsuranceClaimParams,
  ) {
    const claim = await assertClaim(id, organisationId);
    if (claim.status !== "DRAFT") {
      throw new InsuranceClaimError("Only DRAFT claims can be updated.", 409);
    }
    return prisma.insuranceClaim.update({
      where: { id },
      data: {
        ...(params.insurerName !== undefined
          ? { insurerName: params.insurerName }
          : {}),
        ...(params.policyNumber !== undefined
          ? { policyNumber: params.policyNumber }
          : {}),
        ...(params.claimNumber !== undefined
          ? { claimNumber: params.claimNumber }
          : {}),
        ...(params.submittedAmount !== undefined
          ? { submittedAmount: params.submittedAmount }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
        ...(params.externalClaimRef !== undefined
          ? { externalClaimRef: params.externalClaimRef }
          : {}),
      },
      select: claimSelect,
    });
  },

  async submit(id: string, organisationId: string, submittedBy?: string) {
    const claim = await assertClaim(id, organisationId);
    if (claim.status !== "DRAFT") {
      throw new InsuranceClaimError("Only DRAFT claims can be submitted.", 409);
    }

    const updated = await prisma.insuranceClaim.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      select: claimSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: claim.patientId,
      eventType: "INSURANCE_CLAIM_SUBMITTED",
      actorType: "PMS_USER",
      actorId: submittedBy ?? null,
      entityType: "INVOICE",
      entityId: id,
      metadata: {
        insurerName: claim.insurerName,
        policyNumber: claim.policyNumber,
      },
    });

    return updated;
  },

  async updateStatus(
    id: string,
    organisationId: string,
    params: UpdateClaimStatusParams,
  ) {
    const claim = await assertClaim(id, organisationId);
    if (
      claim.status === "CANCELLED" ||
      claim.status === "PAID" ||
      claim.status === "REJECTED"
    ) {
      throw new InsuranceClaimError(
        `Cannot update status from ${claim.status}.`,
        409,
      );
    }

    const now = new Date();
    const data: Prisma.InsuranceClaimUpdateInput = { status: params.status };

    if (
      (params.status === "APPROVED" ||
        params.status === "PARTIALLY_APPROVED") &&
      claim.approvedAt === null
    ) {
      data.approvedAt = now;
    }
    if (params.status === "PAID" && claim.paidAt === null) {
      data.paidAt = now;
    }
    if (params.approvedAmount !== undefined)
      data.approvedAmount = params.approvedAmount;
    if (params.paidAmount !== undefined) data.paidAmount = params.paidAmount;
    if (params.rejectionReason !== undefined)
      data.rejectionReason = params.rejectionReason;
    if (params.claimNumber !== undefined) data.claimNumber = params.claimNumber;
    if (params.externalClaimRef !== undefined)
      data.externalClaimRef = params.externalClaimRef;

    const updated = await prisma.insuranceClaim.update({
      where: { id },
      data,
      select: claimSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: claim.patientId,
      eventType: "INSURANCE_CLAIM_STATUS_CHANGED",
      actorType: "PMS_USER",
      actorId: params.updatedBy ?? null,
      entityType: "INVOICE",
      entityId: id,
      metadata: {
        from: claim.status,
        to: params.status,
        approvedAmount: params.approvedAmount,
        paidAmount: params.paidAmount,
        rejectionReason: params.rejectionReason,
      },
    });

    return updated;
  },

  async cancel(id: string, organisationId: string, cancelledBy?: string) {
    const claim = await assertClaim(id, organisationId);
    if (claim.status === "CANCELLED") {
      throw new InsuranceClaimError("Claim is already cancelled.", 409);
    }
    if (claim.status === "PAID") {
      throw new InsuranceClaimError("Paid claims cannot be cancelled.", 409);
    }

    const updated = await prisma.insuranceClaim.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: claimSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: claim.patientId,
      eventType: "INSURANCE_CLAIM_CANCELLED",
      actorType: "PMS_USER",
      actorId: cancelledBy ?? null,
      entityType: "INVOICE",
      entityId: id,
      metadata: { fromStatus: claim.status },
    });

    return updated;
  },
};
