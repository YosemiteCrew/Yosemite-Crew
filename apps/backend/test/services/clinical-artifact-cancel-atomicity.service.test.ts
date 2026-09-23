import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { InventoryConsumptionService } from "src/services/inventory-consumption.service";
import {
  ClinicalArtifactService,
  STALE_CLINICAL_ARTIFACT_MESSAGE,
} from "../../src/services/clinical-artifact.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    prescription: { findFirst: jest.fn() },
    prescriptionDispenseRequest: { findFirst: jest.fn() },
    workspaceTreatmentItem: { findFirst: jest.fn() },
  },
}));

jest.mock("src/services/inventory-consumption.service", () => ({
  InventoryConsumptionService: {
    voidDispensePrescription: jest.fn(),
    voidDispensePrescriptionInTx: jest.fn(),
    markPrescriptionDispenseRequestNotDispensed: jest.fn(),
    markPrescriptionDispenseRequestNotDispensedInTx: jest.fn(),
    loadDispenseRequestForRetirementInTx: jest.fn(),
  },
}));

/**
 * #3495: cancelling a prescription releases its stock and retires its artifact.
 * Those used to be two transactions - the release committed first, and if the
 * version claim in the second one lost a race the retirement rolled back with
 * the stock already back on the shelf. #3144's oracle says a losing concurrent
 * intent mutates no stock at all.
 *
 * Prisma is mocked, so these tests assert WHICH client each write is issued on.
 * That is the whole distinction between one transaction and two: a release
 * issued on the caller's transaction client rolls back with it, and one issued
 * on the service's own client does not.
 */
describe("cancelPrescription stock/artifact atomicity", () => {
  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    prescription: { findFirst: jest.Mock };
    prescriptionDispenseRequest: { findFirst: jest.Mock };
    workspaceTreatmentItem: { findFirst: jest.Mock };
  };

  const mockedInventory = InventoryConsumptionService as unknown as {
    voidDispensePrescription: jest.Mock;
    voidDispensePrescriptionInTx: jest.Mock;
    markPrescriptionDispenseRequestNotDispensed: jest.Mock;
    markPrescriptionDispenseRequestNotDispensedInTx: jest.Mock;
    loadDispenseRequestForRetirementInTx: jest.Mock;
  };

  const organisationId = "org-1";
  const artifactId = "artifact-1";
  const prescriptionId = "prescription-1";
  const dispenseRequestId = "dispense-1";
  const D1 = new Date("2026-01-01T00:00:00.000Z");
  const STORED_VERSION = 5;

  // A distinct object from `prisma`, so "issued on the transaction client" is
  // an identity assertion rather than a coincidence of the mock.
  type TxClient = {
    workspaceTreatmentItem: { findFirst: jest.Mock; deleteMany: jest.Mock };
    clinicalArtifact: { update: jest.Mock };
  };
  let txClient: TxClient;

  const artifactRow = (overrides: Record<string, unknown> = {}) => ({
    id: artifactId,
    organisationId,
    appointmentId: null,
    caseId: null,
    encounterId: null,
    kind: "PRESCRIPTION",
    status: "SIGNED",
    templateId: null,
    templateVersion: null,
    templateVersionId: null,
    authorId: null,
    signedBy: null,
    signedAt: null,
    summary: null,
    version: STORED_VERSION,
    createdAt: D1,
    updatedAt: D1,
    ...overrides,
  });

  const prescriptionRow = (
    artifact: Record<string, unknown> = artifactRow(),
  ) => ({
    id: prescriptionId,
    artifactId,
    supersedesId: null,
    items: [],
    medications: [{ sourceLineKey: "line-1", quantity: 2 }],
    instructions: null,
    notes: null,
    metadata: null,
    createdAt: D1,
    updatedAt: D1,
    artifact,
  });

  const dispenseRequestRow = (status: string) => ({
    id: dispenseRequestId,
    organisationId,
    prescriptionId,
    status,
    medications: null,
    metadata: null,
    requestedBy: null,
    requestedAt: D1,
    reviewedBy: null,
    reviewedAt: null,
  });

  const recordNotFound = () =>
    new Prisma.PrismaClientKnownRequestError("No record was found", {
      code: "P2025",
      clientVersion: "6.19.3",
    });

  const actor = { canEditAny: true } as never;

  beforeEach(() => {
    jest.clearAllMocks();

    txClient = {
      workspaceTreatmentItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      clinicalArtifact: {
        update: jest
          .fn()
          .mockResolvedValue(
            artifactRow({ status: "VOID", version: STORED_VERSION + 1 }),
          ),
      },
    };

    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) =>
      typeof callback === "function"
        ? (callback as (tx: TxClient) => unknown)(txClient)
        : undefined,
    );
    mockedPrisma.prescription.findFirst.mockResolvedValue(prescriptionRow());
    // Nothing billed: the guard this suite is not about lets the cancel through.
    mockedPrisma.workspaceTreatmentItem.findFirst.mockResolvedValue(null);
    mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(
      dispenseRequestRow("DISPENSED"),
    );
    // #3503: the row the reversal branches on now comes from inside the
    // transaction. The pre-transaction read above still feeds the
    // `updatePrescription` path and is deliberately left disagreeing with this
    // one in the tests below.
    mockedInventory.loadDispenseRequestForRetirementInTx.mockResolvedValue(
      dispenseRequestRow("DISPENSED"),
    );
  });

  it("releases dispensed stock on the caller's transaction client, not its own", async () => {
    await ClinicalArtifactService.cancelPrescription(
      prescriptionId,
      organisationId,
      actor,
    );

    expect(mockedInventory.voidDispensePrescriptionInTx).toHaveBeenCalledTimes(
      1,
    );
    expect(mockedInventory.voidDispensePrescriptionInTx).toHaveBeenCalledWith(
      txClient,
      expect.objectContaining({ organisationId, prescriptionId }),
    );
    // The self-transacting form commits on its own and cannot be rolled back
    // by the retirement failing, which is the #3495 defect.
    expect(mockedInventory.voidDispensePrescription).not.toHaveBeenCalled();
  });

  it("claims the artifact version before doing any stock work", async () => {
    await ClinicalArtifactService.cancelPrescription(
      prescriptionId,
      organisationId,
      actor,
    );

    expect(
      txClient.clinicalArtifact.update.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockedInventory.voidDispensePrescriptionInTx.mock.invocationCallOrder[0],
    );
  });

  it("mutates no stock at all when the version claim is lost", async () => {
    txClient.clinicalArtifact.update.mockRejectedValueOnce(recordNotFound());

    await expect(
      ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
      ),
    ).rejects.toMatchObject({
      message: STALE_CLINICAL_ARTIFACT_MESSAGE,
      statusCode: 409,
    });

    expect(mockedInventory.voidDispensePrescription).not.toHaveBeenCalled();
    expect(mockedInventory.voidDispensePrescriptionInTx).not.toHaveBeenCalled();
  });

  it("mutates no stock at all when the caller's expected version is already stale", async () => {
    await expect(
      ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
        STORED_VERSION - 1,
      ),
    ).rejects.toMatchObject({
      message: STALE_CLINICAL_ARTIFACT_MESSAGE,
      statusCode: 409,
    });

    expect(mockedInventory.voidDispensePrescription).not.toHaveBeenCalled();
    expect(mockedInventory.voidDispensePrescriptionInTx).not.toHaveBeenCalled();
  });

  it("retires a still-pending dispense request on the same transaction client", async () => {
    mockedInventory.loadDispenseRequestForRetirementInTx.mockResolvedValue(
      dispenseRequestRow("PENDING"),
    );

    await ClinicalArtifactService.cancelPrescription(
      prescriptionId,
      organisationId,
      actor,
    );

    expect(
      mockedInventory.markPrescriptionDispenseRequestNotDispensedInTx,
    ).toHaveBeenCalledWith(
      txClient,
      expect.objectContaining({ organisationId, prescriptionId }),
    );
    expect(
      mockedInventory.markPrescriptionDispenseRequestNotDispensed,
    ).not.toHaveBeenCalled();
    expect(mockedInventory.voidDispensePrescriptionInTx).not.toHaveBeenCalled();
  });

  /**
   * #3503: the request whose status selects the reversal branch used to be read
   * before the transaction opened. An approve committing in that window flipped
   * PENDING to DISPENSED and drew the stock, so the cancel took the PENDING
   * branch, found nothing pending to retire, and committed a VOID artifact
   * whose drawn stock was never released.
   *
   * These tests set the pre-transaction read and the in-transaction read to
   * DISAGREE. That is the race made deterministic: the pre-transaction value is
   * what a racing approve has already invalidated, so a cancel that still obeys
   * it is the defect.
   */
  describe("#3503 the reversal branch follows the in-transaction read", () => {
    it("releases stock an approve drew after the pre-transaction read", async () => {
      mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(
        dispenseRequestRow("PENDING"),
      );
      mockedInventory.loadDispenseRequestForRetirementInTx.mockResolvedValue(
        dispenseRequestRow("DISPENSED"),
      );

      await ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
      );

      expect(
        mockedInventory.voidDispensePrescriptionInTx,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockedInventory.markPrescriptionDispenseRequestNotDispensedInTx,
      ).not.toHaveBeenCalled();
    });

    it("does not void stock for a request an approve has not yet drawn", async () => {
      mockedPrisma.prescriptionDispenseRequest.findFirst.mockResolvedValue(
        dispenseRequestRow("DISPENSED"),
      );
      mockedInventory.loadDispenseRequestForRetirementInTx.mockResolvedValue(
        dispenseRequestRow("PENDING"),
      );

      await ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
      );

      expect(
        mockedInventory.markPrescriptionDispenseRequestNotDispensedInTx,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockedInventory.voidDispensePrescriptionInTx,
      ).not.toHaveBeenCalled();
    });

    it("reads it on the caller's transaction client", async () => {
      await ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
      );

      expect(
        mockedInventory.loadDispenseRequestForRetirementInTx,
      ).toHaveBeenCalledWith(
        txClient,
        expect.objectContaining({ organisationId, prescriptionId }),
      );
    });

    it("reads it after the version claim and before the stock work", async () => {
      await ClinicalArtifactService.cancelPrescription(
        prescriptionId,
        organisationId,
        actor,
      );

      const claim =
        txClient.clinicalArtifact.update.mock.invocationCallOrder[0];
      const read =
        mockedInventory.loadDispenseRequestForRetirementInTx.mock
          .invocationCallOrder[0];
      const release =
        mockedInventory.voidDispensePrescriptionInTx.mock
          .invocationCallOrder[0];

      expect(claim).toBeLessThan(read);
      expect(read).toBeLessThan(release);
    });

    it("never takes the dispense-request lock when the version claim is lost", async () => {
      txClient.clinicalArtifact.update.mockRejectedValueOnce(recordNotFound());

      await expect(
        ClinicalArtifactService.cancelPrescription(
          prescriptionId,
          organisationId,
          actor,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(
        mockedInventory.loadDispenseRequestForRetirementInTx,
      ).not.toHaveBeenCalled();
    });
  });

  it("gives the combined transaction more than prisma's 5s interactive default", async () => {
    await ClinicalArtifactService.cancelPrescription(
      prescriptionId,
      organisationId,
      actor,
    );

    // The release walks every prescription line and takes a per-item advisory
    // lock. 5000 here is prisma's own default, not a copy of what we pass.
    const [, options] = mockedPrisma.$transaction.mock.calls[0];
    expect(options?.timeout).toBeGreaterThan(5_000);
  });
});
