import {
  BloodBankService,
  BloodBankError,
} from "../../src/services/blood-bank.service";

// Companion suite to blood-bank.service.test.ts. That file owns the happy paths for
// donor registration and collection recording; this one owns the readers and patch
// builders it does not reach - getDonorByPatient, updateDonor, getDonation,
// updateDonation - plus the optional-filter and optional-field branches on both sides.
jest.mock("src/config/prisma", () => ({
  prisma: {
    bloodBankDonor: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    bloodDonationCollection: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockRecordSafely = AuditTrailService.recordSafely as jest.Mock;
const mockDonorCreate = prisma.bloodBankDonor.create as jest.Mock;
const mockDonorFindFirst = prisma.bloodBankDonor.findFirst as jest.Mock;
const mockDonorFindUnique = prisma.bloodBankDonor.findUnique as jest.Mock;
const mockDonorFindMany = prisma.bloodBankDonor.findMany as jest.Mock;
const mockDonorUpdate = prisma.bloodBankDonor.update as jest.Mock;
const mockDonationCreate = prisma.bloodDonationCollection.create as jest.Mock;
const mockDonationFindFirst = prisma.bloodDonationCollection
  .findFirst as jest.Mock;
const mockDonationFindMany = prisma.bloodDonationCollection
  .findMany as jest.Mock;
const mockDonationUpdate = prisma.bloodDonationCollection.update as jest.Mock;

const screenedAt = new Date("2026-01-15T10:00:00.000Z");
const collectedAt = new Date("2026-06-30T10:00:00.000Z");
const expiresAt = new Date("2026-08-18T00:00:00.000Z");

const baseDonor = {
  id: "donor-1",
  organisationId: "org-1",
  patientId: "pat-1",
  bloodType: "DEA_1_NEGATIVE" as const,
  lastScreeningAt: screenedAt,
  lastDonationAt: null,
  nextEligibleAt: null,
  isActive: true,
  totalDonations: 2,
  disqualificationReason: null,
  notes: null,
  createdAt: screenedAt,
  updatedAt: screenedAt,
};

const baseDonation = {
  id: "donation-1",
  donorId: "donor-1",
  organisationId: "org-1",
  collectedAt,
  collectedBy: "vet-1",
  volumeMl: 450,
  anticoagulant: "CPDA-1",
  unitId: "UNIT-2026-001",
  expiresAt,
  crossmatchResults: null,
  status: "AVAILABLE" as const,
  notes: null,
  createdAt: collectedAt,
  updatedAt: collectedAt,
};

beforeEach(() => jest.clearAllMocks());

describe("BloodBankService.registerDonor optional fields", () => {
  it("persists every supplied optional field and stamps the registering user on the audit event", async () => {
    mockDonorFindUnique.mockResolvedValue(null);
    mockDonorCreate.mockResolvedValue(baseDonor);

    await BloodBankService.registerDonor({
      organisationId: "org-1",
      patientId: "pat-1",
      bloodType: "DEA_1_NEGATIVE",
      lastScreeningAt: screenedAt,
      isActive: false,
      notes: "Screened, awaiting titre",
      registeredBy: "vet-7",
    });

    expect(mockDonorCreate).toHaveBeenCalledWith({
      data: {
        organisationId: "org-1",
        patientId: "pat-1",
        bloodType: "DEA_1_NEGATIVE",
        lastScreeningAt: screenedAt,
        isActive: false,
        notes: "Screened, awaiting titre",
      },
      select: expect.objectContaining({ id: true, bloodType: true }),
    });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "pat-1",
        eventType: "BLOOD_DONOR_REGISTERED",
        actorType: "PMS_USER",
        actorId: "vet-7",
        entityType: "COMPANION",
        entityId: "donor-1",
        metadata: { bloodType: "DEA_1_NEGATIVE" },
      }),
    );
  });

  it("defaults the omitted optional fields and leaves the audit actor unattributed", async () => {
    mockDonorFindUnique.mockResolvedValue(null);
    mockDonorCreate.mockResolvedValue(baseDonor);

    await BloodBankService.registerDonor({
      organisationId: "org-1",
      patientId: "pat-1",
      bloodType: "TYPE_A",
    });

    expect(mockDonorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastScreeningAt: null,
          isActive: true,
          notes: null,
        }),
      }),
    );
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null }),
    );
  });

  it("checks the duplicate donor globally by patient, not per organisation, and skips the write", async () => {
    mockDonorFindUnique.mockResolvedValue({ id: "donor-9" });

    await expect(
      BloodBankService.registerDonor({
        organisationId: "org-2",
        patientId: "pat-1",
        bloodType: "TYPE_B",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Patient is already registered as a blood donor.",
    });

    expect(mockDonorFindUnique).toHaveBeenCalledWith({
      where: { patientId: "pat-1" },
      select: { id: true },
    });
    expect(mockDonorCreate).not.toHaveBeenCalled();
    expect(mockRecordSafely).not.toHaveBeenCalled();
  });
});

describe("BloodBankService.getDonorByPatient", () => {
  it("scopes the patient lookup to the organisation", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);

    await expect(
      BloodBankService.getDonorByPatient("pat-1", "org-1"),
    ).resolves.toBe(baseDonor);

    expect(mockDonorFindFirst).toHaveBeenCalledWith({
      where: { patientId: "pat-1", organisationId: "org-1" },
      select: expect.objectContaining({ id: true, patientId: true }),
    });
  });

  it("throws a 404 for a patient whose donor record belongs to another organisation", async () => {
    mockDonorFindFirst.mockResolvedValue(null);

    await expect(
      BloodBankService.getDonorByPatient("pat-1", "org-2"),
    ).rejects.toBeInstanceOf(BloodBankError);
    await expect(
      BloodBankService.getDonorByPatient("pat-1", "org-2"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "No blood bank record found for this patient.",
    });
  });
});

describe("BloodBankService.listDonors", () => {
  it("omits both optional filters when neither is supplied", async () => {
    mockDonorFindMany.mockResolvedValue([]);

    await BloodBankService.listDonors({ organisationId: "org-1" });

    expect(mockDonorFindMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      select: expect.objectContaining({ id: true }),
      orderBy: { createdAt: "desc" },
    });
  });

  it("keeps an explicit isActive:false filter instead of dropping it as falsy", async () => {
    mockDonorFindMany.mockResolvedValue([]);

    await BloodBankService.listDonors({
      organisationId: "org-1",
      isActive: false,
    });

    expect(mockDonorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", isActive: false },
      }),
    );
  });
});

describe("BloodBankService.updateDonor", () => {
  it("builds a patch from every supplied field", async () => {
    const donatedAt = new Date("2026-06-30T10:00:00.000Z");
    const eligibleAt = new Date("2026-08-30T10:00:00.000Z");
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonorUpdate.mockResolvedValue({ ...baseDonor, isActive: false });

    const result = await BloodBankService.updateDonor("donor-1", "org-1", {
      bloodType: "TYPE_AB",
      lastScreeningAt: screenedAt,
      lastDonationAt: donatedAt,
      nextEligibleAt: eligibleAt,
      isActive: false,
      totalDonations: 3,
      disqualificationReason: "Failed haematocrit screen",
      notes: "Retire from panel",
    });

    expect(mockDonorUpdate).toHaveBeenCalledWith({
      where: { id: "donor-1" },
      data: {
        bloodType: "TYPE_AB",
        lastScreeningAt: screenedAt,
        lastDonationAt: donatedAt,
        nextEligibleAt: eligibleAt,
        isActive: false,
        totalDonations: 3,
        disqualificationReason: "Failed haematocrit screen",
        notes: "Retire from panel",
      },
      select: expect.objectContaining({ id: true }),
    });
    expect(result.isActive).toBe(false);
  });

  it("patches only the named field and leaves the rest of the record untouched", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonorUpdate.mockResolvedValue(baseDonor);

    await BloodBankService.updateDonor("donor-1", "org-1", {
      notes: "Cleared for donation",
    });

    expect(mockDonorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: "Cleared for donation" } }),
    );
  });

  it("sends an empty patch when no field is supplied", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonorUpdate.mockResolvedValue(baseDonor);

    await BloodBankService.updateDonor("donor-1", "org-1", {});

    expect(mockDonorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });

  it("refuses to update a donor belonging to another organisation", async () => {
    mockDonorFindFirst.mockResolvedValue(null);

    await expect(
      BloodBankService.updateDonor("donor-1", "org-2", { isActive: false }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Blood bank donor not found.",
    });
    expect(mockDonorUpdate).not.toHaveBeenCalled();
  });
});

describe("BloodBankService.recordDonation optional fields", () => {
  it("persists the crossmatch panel and every optional collection field", async () => {
    const crossmatchResults = [
      {
        recipientId: "pat-2",
        compatible: true,
        testedAt: "2026-06-30T11:00:00.000Z",
        notes: "Major crossmatch clear",
      },
    ];
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonationCreate.mockResolvedValue(baseDonation);
    mockDonorUpdate.mockResolvedValue(baseDonor);

    await BloodBankService.recordDonation({
      donorId: "donor-1",
      organisationId: "org-1",
      collectedAt,
      collectedBy: "vet-1",
      volumeMl: 450,
      anticoagulant: "CPDA-1",
      unitId: "UNIT-2026-001",
      expiresAt,
      crossmatchResults,
      notes: "Uneventful collection",
    });

    expect(mockDonationCreate).toHaveBeenCalledWith({
      data: {
        donorId: "donor-1",
        organisationId: "org-1",
        collectedAt,
        collectedBy: "vet-1",
        volumeMl: 450,
        anticoagulant: "CPDA-1",
        unitId: "UNIT-2026-001",
        expiresAt,
        crossmatchResults,
        notes: "Uneventful collection",
      },
      select: expect.objectContaining({ id: true, crossmatchResults: true }),
    });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          donorId: "donor-1",
          volumeMl: 450,
          unitId: "UNIT-2026-001",
        },
      }),
    );
  });

  it("nulls the omitted collection fields, leaves crossmatchResults unset and advances the donor tally", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonationCreate.mockResolvedValue(baseDonation);
    mockDonorUpdate.mockResolvedValue(baseDonor);

    await BloodBankService.recordDonation({
      donorId: "donor-1",
      organisationId: "org-1",
      collectedAt,
      volumeMl: 200,
    });

    expect(mockDonationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          collectedBy: null,
          anticoagulant: null,
          unitId: null,
          expiresAt: null,
          crossmatchResults: undefined,
          notes: null,
        }),
      }),
    );
    expect(mockDonorUpdate).toHaveBeenCalledWith({
      where: { id: "donor-1" },
      data: { lastDonationAt: collectedAt, totalDonations: { increment: 1 } },
    });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        metadata: { donorId: "donor-1", volumeMl: 200, unitId: null },
      }),
    );
  });
});

describe("BloodBankService.getDonation", () => {
  it("scopes the collection lookup to the organisation", async () => {
    mockDonationFindFirst.mockResolvedValue(baseDonation);

    await expect(
      BloodBankService.getDonation("donation-1", "org-1"),
    ).resolves.toBe(baseDonation);

    expect(mockDonationFindFirst).toHaveBeenCalledWith({
      where: { id: "donation-1", organisationId: "org-1" },
      select: expect.objectContaining({ id: true, status: true }),
    });
  });

  it("throws a 404 for a collection in another organisation", async () => {
    mockDonationFindFirst.mockResolvedValue(null);

    await expect(
      BloodBankService.getDonation("donation-1", "org-2"),
    ).rejects.toBeInstanceOf(BloodBankError);
    await expect(
      BloodBankService.getDonation("donation-1", "org-2"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Blood donation collection not found.",
    });
  });
});

describe("BloodBankService.listDonations", () => {
  it("omits both optional filters when neither is supplied", async () => {
    mockDonationFindMany.mockResolvedValue([]);

    await BloodBankService.listDonations({ organisationId: "org-1" });

    expect(mockDonationFindMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      select: expect.objectContaining({ id: true }),
      orderBy: { collectedAt: "desc" },
    });
  });

  it("narrows the collection list to a single donor", async () => {
    mockDonationFindMany.mockResolvedValue([baseDonation]);

    await BloodBankService.listDonations({
      organisationId: "org-1",
      donorId: "donor-1",
    });

    expect(mockDonationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", donorId: "donor-1" },
      }),
    );
  });
});

describe("BloodBankService.updateDonation", () => {
  it("records the crossmatch panel and notes alongside a status change", async () => {
    const crossmatchResults = [{ recipientId: "pat-3", compatible: false }];
    mockDonationFindFirst.mockResolvedValue(baseDonation);
    mockDonationUpdate.mockResolvedValue({
      ...baseDonation,
      status: "DISCARDED",
    });

    const result = await BloodBankService.updateDonation(
      "donation-1",
      "org-1",
      {
        status: "DISCARDED",
        crossmatchResults,
        notes: "Incompatible with intended recipient",
      },
    );

    expect(mockDonationUpdate).toHaveBeenCalledWith({
      where: { id: "donation-1" },
      data: {
        status: "DISCARDED",
        crossmatchResults,
        notes: "Incompatible with intended recipient",
      },
      select: expect.objectContaining({ id: true }),
    });
    expect(result.status).toBe("DISCARDED");
  });

  it("sends an empty patch when no field is supplied", async () => {
    mockDonationFindFirst.mockResolvedValue(baseDonation);
    mockDonationUpdate.mockResolvedValue(baseDonation);

    await BloodBankService.updateDonation("donation-1", "org-1", {});

    expect(mockDonationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });

  it("refuses to update a collection belonging to another organisation", async () => {
    mockDonationFindFirst.mockResolvedValue(null);

    await expect(
      BloodBankService.updateDonation("donation-1", "org-2", {
        status: "EXPIRED",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Blood donation collection not found.",
    });
    expect(mockDonationUpdate).not.toHaveBeenCalled();
  });
});
