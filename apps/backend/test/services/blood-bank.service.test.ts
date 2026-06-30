import { BloodBankService } from "../../src/services/blood-bank.service";

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

beforeEach(() => jest.clearAllMocks());

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
