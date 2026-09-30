import { prisma } from "src/config/prisma";
import {
  PatientDuplicateReviewError,
  PatientDuplicateReviewService,
} from "src/services/patient-duplicate-review.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findMany: jest.fn() },
    patientDuplicateDismissal: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  patient: { findMany: jest.Mock };
  patientDuplicateDismissal: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
};

const record = (
  id: string,
  overrides: Partial<{
    name: string;
    type: string;
    speciesCode: string | null;
    dateOfBirth: Date;
    microchipNumber: string | null;
  }> = {},
) => ({
  id,
  name: "Milo Jones",
  type: "DOG",
  speciesCode: "DOG",
  dateOfBirth: new Date("2020-04-05T00:00:00.000Z"),
  microchipNumber: null,
  ...overrides,
});

describe("PatientDuplicateReviewService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.patient.findMany.mockResolvedValue([]);
    mockedPrisma.patientDuplicateDismissal.findMany.mockResolvedValue([]);
  });

  it("lists exact identity candidates only within the active practice", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a", { name: "  MILO   Jones " }),
      record("patient-b"),
      record("patient-c", {
        dateOfBirth: new Date("2020-04-06T00:00:00.000Z"),
      }),
      record("patient-d", { type: "CAT", speciesCode: "CAT" }),
    ]);

    const matches = await PatientDuplicateReviewService.list(" practice-1 ");

    expect(mockedPrisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisations: {
            some: { organisationId: "practice-1", status: "ACTIVE" },
          },
        },
      }),
    );
    expect(matches).toEqual([
      {
        patientA: expect.objectContaining({
          id: "patient-a",
          name: "  MILO   Jones ",
        }),
        patientB: expect.objectContaining({
          id: "patient-b",
          name: "Milo Jones",
        }),
        matchingOn: "name-and-birth-date",
      },
    ]);
  });

  it("matches a shared microchip even when the names differ", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a", { name: "Milo", microchipNumber: " 985 112-009" }),
      record("patient-b", { name: "Buddy", microchipNumber: "985112009" }),
    ]);

    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toEqual([expect.objectContaining({ matchingOn: "microchip" })]);
  });

  it("does not match records with blank names using name and birth date", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a", { name: "  " }),
      record("patient-b", { name: "" }),
    ]);

    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toEqual([]);
  });

  it("matches equal identities when the species code is not recorded", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a", { speciesCode: null }),
      record("patient-b", { speciesCode: null }),
    ]);

    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toHaveLength(1);
  });

  it("reports a pair once when both identity and microchip match", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a", { microchipNumber: "985112009" }),
      record("patient-b", { microchipNumber: "985 112 009" }),
    ]);

    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toEqual([expect.objectContaining({ matchingOn: "microchip" })]);
  });

  it("caps the review list at 200 candidates", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue(
      Array.from({ length: 22 }, (_, index) => record(`patient-${index}`)),
    );

    const matches = await PatientDuplicateReviewService.list("practice-1");

    expect(matches).toHaveLength(200);
  });

  it("omits a dismissed pair regardless of its stored order", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      record("patient-a"),
      record("patient-b"),
    ]);
    mockedPrisma.patientDuplicateDismissal.findMany.mockResolvedValue([
      { patientAId: "patient-b", patientBId: "patient-a" },
    ]);

    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toEqual([]);
  });

  it("returns no candidates when the practice has no active patients", async () => {
    await expect(
      PatientDuplicateReviewService.list("practice-1"),
    ).resolves.toEqual([]);
    expect(
      mockedPrisma.patientDuplicateDismissal.findMany,
    ).toHaveBeenCalledWith({
      where: { organisationId: "practice-1" },
      select: { patientAId: true, patientBId: true },
    });
  });

  it("requires a practice before loading candidates", async () => {
    await expect(PatientDuplicateReviewService.list(" ")).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    );
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("records a false-match dismissal in canonical order", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([
      { id: "patient-a" },
      { id: "patient-b" },
    ]);
    mockedPrisma.patientDuplicateDismissal.upsert.mockResolvedValue({
      dismissedAt: new Date("2026-09-28T12:00:00.000Z"),
    });

    const result = await PatientDuplicateReviewService.dismiss({
      organisationId: " practice-1 ",
      patientAId: "patient-b",
      patientBId: "patient-a",
      dismissedById: "staff-1",
    });

    expect(mockedPrisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["patient-b", "patient-a"] },
          organisations: {
            some: { organisationId: "practice-1", status: "ACTIVE" },
          },
        },
      }),
    );
    expect(mockedPrisma.patientDuplicateDismissal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId_patientAId_patientBId: {
            organisationId: "practice-1",
            patientAId: "patient-a",
            patientBId: "patient-b",
          },
        },
        create: expect.objectContaining({ dismissedById: "staff-1" }),
      }),
    );
    expect(result.dismissedAt).toEqual(new Date("2026-09-28T12:00:00.000Z"));
  });

  it("rejects a pair containing the same record", async () => {
    await expect(
      PatientDuplicateReviewService.dismiss({
        organisationId: "practice-1",
        patientAId: "patient-a",
        patientBId: "patient-a",
        dismissedById: "staff-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      name: PatientDuplicateReviewError.name,
    });
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("does not dismiss records that are not both active in the practice", async () => {
    mockedPrisma.patient.findMany.mockResolvedValue([{ id: "patient-a" }]);

    await expect(
      PatientDuplicateReviewService.dismiss({
        organisationId: "practice-1",
        patientAId: "patient-a",
        patientBId: "patient-b",
        dismissedById: "staff-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      mockedPrisma.patientDuplicateDismissal.upsert,
    ).not.toHaveBeenCalled();
  });

  it("requires a practice and staff member for a dismissal", async () => {
    await expect(
      PatientDuplicateReviewService.dismiss({
        organisationId: " ",
        patientAId: "patient-a",
        patientBId: "patient-b",
        dismissedById: "staff-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PatientDuplicateReviewService.dismiss({
        organisationId: "practice-1",
        patientAId: "patient-a",
        patientBId: "patient-b",
        dismissedById: " ",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
