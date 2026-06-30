import {
  PatientAllergyService,
  PatientAllergyError,
} from "src/services/patient-allergy.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientAllergy: {
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
  patientAllergy: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeAllergy = (over: Record<string, unknown> = {}) => ({
  id: "allergy-1",
  organisationId: "org-1",
  patientId: "pat-1",
  allergen: "Amoxicillin",
  allergyType: "DRUG",
  severity: "SEVERE",
  reaction: "Anaphylaxis",
  status: "ACTIVE",
  onsetDate: new Date("2024-06-01"),
  resolvedDate: null,
  notes: null,
  recordedBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.patientAllergy.findFirst.mockResolvedValue(makeAllergy());
  pm.patientAllergy.create.mockResolvedValue(makeAllergy());
  pm.patientAllergy.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeAllergy({ ...args.data })),
  );
  pm.patientAllergy.findMany.mockResolvedValue([makeAllergy()]);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("PatientAllergyService.create", () => {
  it("creates an ACTIVE allergy record and emits audit", async () => {
    const result = await PatientAllergyService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      allergen: "Amoxicillin",
      allergyType: "DRUG",
      severity: "SEVERE",
      reaction: "Anaphylaxis",
      recordedBy: "vet-1",
    });
    expect(pm.patientAllergy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          allergen: "Amoxicillin",
          allergyType: "DRUG",
          severity: "SEVERE",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ALLERGY_RECORDED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("supports UNCONFIRMED status on creation", async () => {
    await PatientAllergyService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      allergen: "Pollen",
      allergyType: "ENVIRONMENTAL",
      severity: "MILD",
      status: "UNCONFIRMED",
    });
    expect(pm.patientAllergy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UNCONFIRMED" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("PatientAllergyService.get", () => {
  it("returns allergy by id and org", async () => {
    const result = await PatientAllergyService.get("allergy-1", "org-1");
    expect(result.id).toBe("allergy-1");
  });

  it("404s an unknown allergy", async () => {
    pm.patientAllergy.findFirst.mockResolvedValue(null);
    await expect(
      PatientAllergyService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PatientAllergyService.list", () => {
  it("lists all allergies for the org", async () => {
    const result = await PatientAllergyService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, status, and allergyType", async () => {
    await PatientAllergyService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
      allergyType: "DRUG",
    });
    expect(pm.patientAllergy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
          allergyType: "DRUG",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("PatientAllergyService.update", () => {
  it("updates allergy fields and emits audit", async () => {
    await PatientAllergyService.update(
      "allergy-1",
      "org-1",
      { severity: "LIFE_THREATENING", notes: "Updated based on new info" },
      "vet-1",
    );
    expect(pm.patientAllergy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "LIFE_THREATENING",
          notes: "Updated based on new info",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ALLERGY_UPDATED" }),
    );
  });

  it("can confirm an UNCONFIRMED allergy by setting status to ACTIVE", async () => {
    pm.patientAllergy.findFirst.mockResolvedValue(
      makeAllergy({ status: "UNCONFIRMED" }),
    );
    await PatientAllergyService.update("allergy-1", "org-1", {
      status: "ACTIVE",
    });
    expect(pm.patientAllergy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------

describe("PatientAllergyService.resolve", () => {
  it("marks ACTIVE allergy as RESOLVED and emits audit", async () => {
    const resolvedDate = new Date("2026-06-30");
    const result = await PatientAllergyService.resolve(
      "allergy-1",
      "org-1",
      "vet-1",
      resolvedDate,
    );
    expect(pm.patientAllergy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED", resolvedDate }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ALLERGY_RESOLVED",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("RESOLVED");
  });

  it("uses current date when no resolvedDate provided", async () => {
    await PatientAllergyService.resolve("allergy-1", "org-1");
    expect(pm.patientAllergy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED" }),
      }),
    );
  });

  it("rejects resolving an already-resolved allergy", async () => {
    pm.patientAllergy.findFirst.mockResolvedValue(
      makeAllergy({ status: "RESOLVED" }),
    );
    await expect(
      PatientAllergyService.resolve("allergy-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
