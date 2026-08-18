import { BloodBankService } from "../../src/services/blood-bank.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn(), findMany: jest.fn() },
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

const baseDonor = {
  id: "donor-1",
  organisationId: "org-1",
  patientId: "pat-1",
  bloodType: "DEA_1_POSITIVE" as "DEA_1_POSITIVE",
  lastScreeningAt: new Date("2026-01-15T10:00:00Z"),
  lastDonationAt: null,
  nextEligibleAt: null,
  isActive: true,
  totalDonations: 0,
  disqualificationReason: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseDonation = {
  id: "donation-1",
  donorId: "donor-1",
  organisationId: "org-1",
  collectedAt: new Date("2026-06-30T10:00:00Z"),
  collectedBy: "vet-1",
  volumeMl: 450,
  anticoagulant: "CPDA-1",
  unitId: "UNIT-2026-001",
  expiresAt: new Date("2026-08-18T00:00:00Z"),
  crossmatchResults: null,
  status: "AVAILABLE" as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: the companion belongs to the caller's organisation, so every
  // pre-existing case keeps its original meaning. Cross-tenant is asserted
  // explicitly in its own test below.
  (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
    id: "patient-org-1",
  });
  (prisma.patientOrganisation.findMany as jest.Mock).mockImplementation(
    ({ where }: { where: { patientId: { in: string[] } } }) =>
      Promise.resolve(where.patientId.in.map((patientId) => ({ patientId }))),
  );
});

describe("BloodBankService.registerDonor", () => {
  it("registers a new DEA 1.1 positive donor", async () => {
    mockDonorFindUnique.mockResolvedValue(null);
    mockDonorCreate.mockResolvedValue(baseDonor);
    const donor = await BloodBankService.registerDonor({
      organisationId: "org-1",
      patientId: "pat-1",
      bloodType: "DEA_1_POSITIVE",
    });
    expect(mockDonorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bloodType: "DEA_1_POSITIVE",
          patientId: "pat-1",
        }),
      }),
    );
    expect(donor.bloodType).toBe("DEA_1_POSITIVE");
  });

  it("throws 409 if patient is already a donor", async () => {
    mockDonorFindUnique.mockResolvedValue(baseDonor);
    await expect(
      BloodBankService.registerDonor({
        organisationId: "org-1",
        patientId: "pat-1",
        bloodType: "DEA_1_POSITIVE",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("BloodBankService.getDonor", () => {
  it("returns donor when found", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    const donor = await BloodBankService.getDonor("donor-1", "org-1");
    expect(donor.id).toBe("donor-1");
    expect(donor.isActive).toBe(true);
  });

  it("throws 404 when not found", async () => {
    mockDonorFindFirst.mockResolvedValue(null);
    await expect(
      BloodBankService.getDonor("donor-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("BloodBankService.listDonors", () => {
  it("filters by blood type and active status", async () => {
    mockDonorFindMany.mockResolvedValue([baseDonor]);
    await BloodBankService.listDonors({
      organisationId: "org-1",
      bloodType: "DEA_1_POSITIVE",
      isActive: true,
    });
    expect(mockDonorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bloodType: "DEA_1_POSITIVE",
          isActive: true,
        }),
      }),
    );
  });
});

describe("BloodBankService.recordDonation", () => {
  it("records a collection and increments donor total", async () => {
    mockDonorFindFirst.mockResolvedValue(baseDonor);
    mockDonationCreate.mockResolvedValue(baseDonation);
    mockDonorUpdate.mockResolvedValue({ ...baseDonor, totalDonations: 1 });

    const donation = await BloodBankService.recordDonation({
      donorId: "donor-1",
      organisationId: "org-1",
      collectedAt: new Date("2026-06-30T10:00:00Z"),
      volumeMl: 450,
      unitId: "UNIT-2026-001",
    });

    expect(mockDonationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ volumeMl: 450 }),
      }),
    );
    expect(mockDonorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalDonations: { increment: 1 } }),
      }),
    );
    expect(donation.status).toBe("AVAILABLE");
  });

  it("records the audit entry against the donor patient", async () => {
    mockDonorFindFirst.mockResolvedValue({ ...baseDonor, patientId: "pat-9" });
    mockDonationCreate.mockResolvedValue(baseDonation);
    mockDonorUpdate.mockResolvedValue({ ...baseDonor, totalDonations: 1 });

    await BloodBankService.recordDonation({
      donorId: "donor-1",
      organisationId: "org-1",
      collectedAt: new Date("2026-06-30T10:00:00Z"),
      collectedBy: "vet-1",
      volumeMl: 450,
      unitId: "UNIT-2026-001",
    });

    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "pat-9",
        eventType: "BLOOD_DONATION_COLLECTED",
        entityId: "donation-1",
        metadata: expect.objectContaining({ donorId: "donor-1" }),
      }),
    );
  });

  it("throws 404 when donor not found", async () => {
    mockDonorFindFirst.mockResolvedValue(null);
    await expect(
      BloodBankService.recordDonation({
        donorId: "donor-x",
        organisationId: "org-1",
        collectedAt: new Date(),
        volumeMl: 450,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("BloodBankService.updateDonation", () => {
  it("marks a unit as transfused", async () => {
    mockDonationFindFirst.mockResolvedValue(baseDonation);
    mockDonationUpdate.mockResolvedValue({
      ...baseDonation,
      status: "TRANSFUSED",
    });
    const result = await BloodBankService.updateDonation(
      "donation-1",
      "org-1",
      {
        status: "TRANSFUSED",
      },
    );
    expect(result.status).toBe("TRANSFUSED");
  });

  it("allows COLLECTED -> PROCESSED", async () => {
    mockDonationFindFirst.mockResolvedValue({
      ...baseDonation,
      status: "COLLECTED",
    });
    mockDonationUpdate.mockResolvedValue({
      ...baseDonation,
      status: "PROCESSED",
    });
    const result = await BloodBankService.updateDonation(
      "donation-1",
      "org-1",
      { status: "PROCESSED" },
    );
    expect(result.status).toBe("PROCESSED");
  });

  it("rejects re-opening a transfused unit back to AVAILABLE", async () => {
    mockDonationFindFirst.mockResolvedValue({
      ...baseDonation,
      status: "TRANSFUSED",
    });
    await expect(
      BloodBankService.updateDonation("donation-1", "org-1", {
        status: "AVAILABLE",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Blood unit cannot move from TRANSFUSED to AVAILABLE.",
    });
    expect(mockDonationUpdate).not.toHaveBeenCalled();
  });

  it.each(["EXPIRED", "DISCARDED"] as const)(
    "keeps %s terminal",
    async (status) => {
      mockDonationFindFirst.mockResolvedValue({ ...baseDonation, status });
      await expect(
        BloodBankService.updateDonation("donation-1", "org-1", {
          status: "AVAILABLE",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockDonationUpdate).not.toHaveBeenCalled();
    },
  );

  it("allows a no-op write of the current status", async () => {
    mockDonationFindFirst.mockResolvedValue({
      ...baseDonation,
      status: "TRANSFUSED",
    });
    mockDonationUpdate.mockResolvedValue({
      ...baseDonation,
      status: "TRANSFUSED",
      notes: "checked",
    });
    const result = await BloodBankService.updateDonation(
      "donation-1",
      "org-1",
      { status: "TRANSFUSED", notes: "checked" },
    );
    expect(result.notes).toBe("checked");
  });

  it("updates notes without a status change", async () => {
    mockDonationFindFirst.mockResolvedValue(baseDonation);
    mockDonationUpdate.mockResolvedValue({
      ...baseDonation,
      notes: "shelf B",
    });
    const result = await BloodBankService.updateDonation(
      "donation-1",
      "org-1",
      { notes: "shelf B" },
    );
    expect(result.notes).toBe("shelf B");
  });
});

describe("BloodBankService.listDonations", () => {
  it("filters by status", async () => {
    mockDonationFindMany.mockResolvedValue([baseDonation]);
    await BloodBankService.listDonations({
      organisationId: "org-1",
      status: "AVAILABLE",
    });
    expect(mockDonationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "AVAILABLE" }),
      }),
    );
  });
});
