import {
  InsuranceClaimService,
  InsuranceClaimError,
} from "src/services/insurance-claim.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
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
  // Every create here files a record against a companion, which must belong
  // to the organisation the record is filed under.
  (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
    id: "patient-org-link",
  });
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
  // `patientId` comes from the request body while RBAC only authorised the
  // organisation, so without this a caller could file a insurance claim against
  // another tenant's companion.
  it("rejects a companion outside the caller's organisation", async () => {
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      InsuranceClaimService.create({
        organisationId: "org-1",
        patientId: "pat-other",
      } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

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
  it("rejects approving above the submitted amount", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "APPROVED",
        approvedAmount: 900,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(pm.insuranceClaim.update).not.toHaveBeenCalled();
  });

  it("requires an approved amount to reach APPROVED", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "APPROVED",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("requires a partial approval to be below the submitted amount", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "PARTIALLY_APPROVED",
        approvedAmount: 500,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a genuine partial approval", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "SUBMITTED" }),
    );
    await InsuranceClaimService.updateStatus("claim-1", "org-1", {
      status: "PARTIALLY_APPROVED",
      approvedAmount: 300,
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalled();
  });

  it("rejects paying more than was approved", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", approvedAmount: 450 }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "PAID",
        paidAmount: 5000,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects reaching PAID with no payment figure at all", async () => {
    // Otherwise reporting reads a paid claim whose paidAmount is NULL.
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", approvedAmount: 450 }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "PAID",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a payment up to the approved amount", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", approvedAmount: 450 }),
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

  it("accepts a persisted paidAmount carried from an earlier write", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", approvedAmount: 450, paidAmount: 450 }),
    );
    await InsuranceClaimService.updateStatus("claim-1", "org-1", {
      status: "PAID",
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalled();
  });

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

  it("transitions DRAFT to SUBMITTED and sets submittedAt", async () => {
    await InsuranceClaimService.updateStatus("claim-1", "org-1", {
      status: "SUBMITTED",
    });
    expect(pm.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
          submittedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects skipping ahead from DRAFT to PAID", async () => {
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "PAID",
        paidAmount: 500,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(pm.insuranceClaim.update).not.toHaveBeenCalled();
  });

  it("rejects moving backwards from APPROVED to DRAFT", async () => {
    pm.insuranceClaim.findFirst.mockResolvedValue(
      makeClaim({ status: "APPROVED", approvedAt: new Date() }),
    );
    await expect(
      InsuranceClaimService.updateStatus("claim-1", "org-1", {
        status: "DRAFT",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(pm.insuranceClaim.update).not.toHaveBeenCalled();
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
