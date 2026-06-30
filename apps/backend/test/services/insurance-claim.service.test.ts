import {
  InsuranceClaimService,
  InsuranceClaimError,
} from "src/services/insurance-claim.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    insuranceClaim: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  insuranceClaim: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeClaim = (over: Record<string, unknown> = {}) => ({
  id: "claim-1",
  organisationId: "org-1",
  patientId: "pat-1",
  invoiceId: "inv-1",
  encounterId: null,
  insurerName: "PetPlan",
  policyNumber: "PP-12345",
  claimNumber: null,
  submittedAmount: 500.0,
  approvedAmount: null,
  paidAmount: null,
  currency: "GBP",
  status: "DRAFT",
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.insuranceClaim.findFirst.mockResolvedValue(makeClaim());
  pm.insuranceClaim.create.mockResolvedValue(makeClaim());
  pm.insuranceClaim.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeClaim({ ...args.data })),
  );
  pm.insuranceClaim.findMany.mockResolvedValue([makeClaim()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.create", () => {
  it("creates a DRAFT claim and emits audit event", async () => {
    const result = await InsuranceClaimService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      insurerName: "PetPlan",
      policyNumber: "PP-12345",
      submittedAmount: 500,
      createdBy: "vet-1",
    });
    expect(pm.insuranceClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          insurerName: "PetPlan",
          submittedAmount: 500,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INSURANCE_CLAIM_CREATED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("DRAFT");
  });

  it("defaults currency to GBP when not supplied", async () => {
    await InsuranceClaimService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      insurerName: "PetPlan",
      policyNumber: "PP-12345",
      submittedAmount: 200,
    });
    expect(pm.insuranceClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "GBP" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.get", () => {
  it("returns claim by id and org", async () => {
    const result = await InsuranceClaimService.get("claim-1", "org-1");
    expect(result.id).toBe("claim-1");
  });

  it("404s an unknown claim", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(null);
    await expect(
      InsuranceClaimService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("InsuranceClaimService.list", () => {
  it("lists claims for the org", async () => {
    const result = await InsuranceClaimService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, status, and invoiceId", async () => {
    await InsuranceClaimService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "SUBMITTED",
      invoiceId: "inv-1",
    });
    expect(pm.insuranceClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "SUBMITTED",
          invoiceId: "inv-1",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.update", () => {
  it("updates a DRAFT claim", async () => {
    await InsuranceClaimService.update("claim-1", "org-1", {
      insurerName: "Agria",
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ insurerName: "Agria" }),
      }),
    );
  });

  it("rejects updating a non-DRAFT claim", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await expect(
      InsuranceClaimService.update("claim-1", "org-1", { insurerName: "X" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.submit", () => {
  it("transitions DRAFT to SUBMITTED with submittedAt set", async () => {
    const result = await InsuranceClaimService.submit(
      "claim-1",
      "org-1",
      "vet-1",
    );
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INSURANCE_CLAIM_SUBMITTED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("SUBMITTED");
  });

  it("rejects submitting a non-DRAFT claim", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await expect(
      InsuranceClaimService.submit("claim-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.updateStatus", () => {
  it("transitions SUBMITTED to APPROVED and sets approvedAt", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    const result = await InsuranceClaimService.updateStatus(
      "claim-1",
      "org-1",
      {
        status: "APPROVED",
        approvedAmount: 450,
        updatedBy: "admin-1",
      },
    );
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          approvedAmount: 450,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INSURANCE_CLAIM_STATUS_CHANGED",
        actorId: "admin-1",
      }),
    );
    expect(result.status).toBe("APPROVED");
  });

  it("transitions to REJECTED with reason", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "UNDER_REVIEW" }),
    );
    await InsuranceClaimService.updateStatus("claim-1", "org-1", {
      status: "REJECTED",
      rejectionReason: "Not covered",
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "Not covered",
        }),
      }),
    );
  });

  it("transitions to PAID and sets paidAt", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", paidAt: null }),
    );
    await InsuranceClaimService.updateStatus("claim-1", "org-1", {
      status: "PAID",
      paidAmount: 450,
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID", paidAmount: 450 }),
      }),
    );
  });

  it("rejects updating from a terminal status", async () => {
    for (const status of ["CANCELLED", "PAID", "REJECTED"] as const) {
      pm.insuranceClaim.findFirst.mockResolvedValue(makeClaim({ status }));
      await expect(
        InsuranceClaimService.updateStatus("claim-1", "org-1", {
          status: "APPROVED",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("InsuranceClaimService.cancel", () => {
  it("cancels a claim and emits audit event", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    const result = await InsuranceClaimService.cancel(
      "claim-1",
      "org-1",
      "vet-1",
    );
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INSURANCE_CLAIM_CANCELLED" }),
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("rejects cancelling an already-cancelled claim", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "CANCELLED" }),
    );
    await expect(
      InsuranceClaimService.cancel("claim-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects cancelling a paid claim", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "PAID" }),
    );
    await expect(
      InsuranceClaimService.cancel("claim-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
