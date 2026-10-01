import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  PracticeProfileFieldsError,
  PracticeProfileFieldsService,
} from "../../src/services/practice-profile-fields.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    practiceProfileField: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    practiceProfileFieldValue: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

const db = prisma as unknown as {
  patientOrganisation: { findFirst: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  practiceProfileField: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  practiceProfileFieldValue: { deleteMany: jest.Mock; upsert: jest.Mock };
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
};

const active = { id: "link-1" };
const orgId = "9b2bfe50-e965-4e75-93a7-41cb5307639b";
const patientId = "9da2fc52-4f92-4411-b499-0c4897ca4a7d";

describe("PracticeProfileFieldsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.patientOrganisation.findFirst.mockResolvedValue(active);
    db.parentPatient.findFirst.mockResolvedValue(active);
    db.practiceProfileField.findFirst.mockResolvedValue(null);
    db.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  it("lists active definitions and returns null for unset values", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([
      {
        id: "f-1",
        label: "Coat color",
        values: [{ value: "blue" }],
      },
      { id: "f-2", label: "Adoption date", values: [] },
    ]);

    await expect(
      PracticeProfileFieldsService.list("PATIENT", patientId, orgId),
    ).resolves.toEqual([
      { id: "f-1", label: "Coat color", value: "blue" },
      { id: "f-2", label: "Adoption date", value: null },
    ]);
    expect(db.patientOrganisation.findFirst).toHaveBeenCalledWith({
      where: { patientId, organisationId: orgId, status: "ACTIVE" },
      select: { id: true },
    });
  });

  it("uses an active client-to-patient link for client profile access", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([]);

    await PracticeProfileFieldsService.list(
      "CLIENT",
      "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
      orgId,
    );

    expect(db.parentPatient.findFirst).toHaveBeenCalledWith({
      where: {
        parentId: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
        status: "ACTIVE",
        patient: {
          organisations: {
            some: { organisationId: orgId, status: "ACTIVE" },
          },
        },
      },
      select: { id: true },
    });
  });

  it("does not reveal profiles without an active practice link", async () => {
    db.patientOrganisation.findFirst.mockResolvedValue(null);

    await expect(
      PracticeProfileFieldsService.list("PATIENT", patientId, orgId),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.practiceProfileField.findMany).not.toHaveBeenCalled();
  });

  it("creates a normalized field definition", async () => {
    db.practiceProfileField.create.mockResolvedValue({ id: "f-1" });

    await expect(
      PracticeProfileFieldsService.create("PATIENT", orgId, {
        label: "  Coat color  ",
        type: "TEXT",
        options: [],
      }),
    ).resolves.toEqual({ id: "f-1" });
    expect(db.practiceProfileField.create).toHaveBeenCalledWith({
      data: {
        label: "Coat color",
        fieldKey: "coat-color",
        type: "TEXT",
        options: [],
        entityType: "PATIENT",
        organisationId: orgId,
      },
    });
  });

  it("restores a removed field of the same name and type with its saved values", async () => {
    db.practiceProfileField.findFirst.mockResolvedValue({ id: "f-removed" });
    db.practiceProfileField.update.mockResolvedValue({
      id: "f-removed",
      isActive: true,
    });

    await expect(
      PracticeProfileFieldsService.create("CLIENT", orgId, {
        label: "Contact time",
        type: "SELECT",
        options: ["Morning", "Evening"],
      }),
    ).resolves.toEqual({ id: "f-removed", isActive: true });
    expect(db.practiceProfileField.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: orgId,
        entityType: "CLIENT",
        fieldKey: "contact-time",
        type: "SELECT",
        isActive: false,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    expect(db.practiceProfileField.update).toHaveBeenCalledWith({
      where: { id: "f-removed" },
      data: {
        label: "Contact time",
        options: ["Morning", "Evening"],
        isActive: true,
      },
    });
    expect(db.practiceProfileField.create).not.toHaveBeenCalled();
  });

  it("reports a restore that races an active field as a conflict", async () => {
    db.practiceProfileField.findFirst.mockResolvedValue({ id: "f-removed" });
    db.practiceProfileField.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      PracticeProfileFieldsService.create("CLIENT", orgId, {
        label: "Contact time",
        type: "TEXT",
        options: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([
    { label: "  ", type: "TEXT" as const, options: [] },
    { label: "Valid", type: "SELECT" as const, options: ["Only one"] },
    { label: "Valid", type: "SELECT" as const, options: ["Same", " Same "] },
    { label: "Valid", type: "TEXT" as const, options: ["Unexpected"] },
  ])("rejects an invalid field definition", async (input) => {
    await expect(
      PracticeProfileFieldsService.create("PATIENT", orgId, input),
    ).rejects.toBeInstanceOf(PracticeProfileFieldsError);
    expect(db.practiceProfileField.create).not.toHaveBeenCalled();
  });

  it("reports duplicate field keys as a conflict and rethrows other errors", async () => {
    db.practiceProfileField.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      PracticeProfileFieldsService.create("PATIENT", orgId, {
        label: "Coat color",
        type: "TEXT",
        options: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const failure = new Error("database unavailable");
    db.practiceProfileField.create.mockRejectedValueOnce(failure);
    await expect(
      PracticeProfileFieldsService.create("PATIENT", orgId, {
        label: "Coat color",
        type: "TEXT",
        options: [],
      }),
    ).rejects.toBe(failure);
  });

  it("deactivates a definition and returns not-found when it is not in the practice", async () => {
    db.$executeRaw.mockResolvedValueOnce(1);
    await expect(
      PracticeProfileFieldsService.deactivate(
        "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
        orgId,
      ),
    ).resolves.toBeUndefined();
    expect(db.$executeRaw.mock.calls[0].slice(1)).toEqual([
      "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
      orgId,
    ]);

    db.$executeRaw.mockResolvedValueOnce(0);
    await expect(
      PracticeProfileFieldsService.deactivate(
        "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394",
        orgId,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("validates field ownership and type before transactionally saving values", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([
      { id: "11057e80-4b4a-4a00-a9e9-d9bb11a60001", type: "TEXT", options: [] },
      {
        id: "11057e80-4b4a-4a00-a9e9-d9bb11a60002",
        type: "NUMBER",
        options: [],
      },
      { id: "11057e80-4b4a-4a00-a9e9-d9bb11a60003", type: "DATE", options: [] },
      {
        id: "11057e80-4b4a-4a00-a9e9-d9bb11a60004",
        type: "BOOLEAN",
        options: [],
      },
      {
        id: "11057e80-4b4a-4a00-a9e9-d9bb11a60005",
        type: "SELECT",
        options: ["Morning", "Evening"],
      },
    ]);
    const values = [
      { fieldId: "11057e80-4b4a-4a00-a9e9-d9bb11a60001", value: "Calm" },
      { fieldId: "11057e80-4b4a-4a00-a9e9-d9bb11a60002", value: 4.5 },
      { fieldId: "11057e80-4b4a-4a00-a9e9-d9bb11a60003", value: "2026-09-27" },
      { fieldId: "11057e80-4b4a-4a00-a9e9-d9bb11a60004", value: false },
      { fieldId: "11057e80-4b4a-4a00-a9e9-d9bb11a60005", value: "Evening" },
    ];

    await expect(
      PracticeProfileFieldsService.saveValues(
        "PATIENT",
        patientId,
        orgId,
        values,
      ),
    ).resolves.toBeUndefined();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: "TEXT", options: [], value: 3 },
    { type: "NUMBER", options: [], value: Number.NaN },
    { type: "DATE", options: [], value: "2026-02-30" },
    { type: "DATE", options: [], value: "27/09/2026" },
    { type: "BOOLEAN", options: [], value: "true" },
    { type: "SELECT", options: ["Morning"], value: "Afternoon" },
  ])(
    "rejects an invalid stored value for $type",
    async ({ type, options, value }) => {
      db.practiceProfileField.findMany.mockResolvedValue([
        { id: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394", type, options },
      ]);

      await expect(
        PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
          { fieldId: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394", value },
        ]),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("rejects duplicate, inactive, or foreign field ids before writing", async () => {
    await expect(
      PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
        { fieldId: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394", value: "a" },
        { fieldId: "3c99a7e6-2b6d-4b5b-83cf-d6115b76a394", value: "b" },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.practiceProfileField.findMany.mockResolvedValue([]);
    await expect(
      PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
        { fieldId: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", value: "a" },
      ]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes cleared values and upserts populated values", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([
      { id: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", type: "TEXT", options: [] },
      { id: "82b5bc73-e456-4614-a0ca-b3aad820a901", type: "TEXT", options: [] },
    ]);
    db.practiceProfileFieldValue.deleteMany.mockResolvedValue({ count: 1 });
    db.practiceProfileFieldValue.upsert.mockResolvedValue({ id: "value-1" });
    db.$executeRaw.mockResolvedValue(1);

    await PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
      { fieldId: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", value: "" },
      { fieldId: "82b5bc73-e456-4614-a0ca-b3aad820a901", value: "note" },
    ]);

    expect(db.$executeRaw.mock.calls[0].slice(1)).toEqual([
      orgId,
      "PATIENT",
      patientId,
      "7fd4c410-5191-49c4-a7f9-9283f6ec9100",
    ]);
    expect(db.practiceProfileFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fieldId_entityId: {
            fieldId: "82b5bc73-e456-4614-a0ca-b3aad820a901",
            entityId: patientId,
          },
        },
      }),
    );
  });

  // The two reads below carry the tenant boundary. Every other test here mocks
  // the return value, so a dropped organisationId would leave the suite green
  // while handing every practice's field definitions to every caller.
  it("scopes the field definitions it lists to the caller's organisation", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([]);

    await PracticeProfileFieldsService.list("PATIENT", patientId, orgId);

    expect(db.practiceProfileField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: orgId,
          entityType: "PATIENT",
        }),
      }),
    );
  });

  it("scopes the field lookup behind a value write to the caller's organisation", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([
      { id: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", type: "TEXT", options: [] },
    ]);

    await PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
      { fieldId: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", value: "note" },
    ]);

    expect(db.practiceProfileField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: orgId,
          entityType: "PATIENT",
        }),
      }),
    );
  });

  it("refuses to write a value against another organisation's field", async () => {
    db.practiceProfileField.findMany.mockResolvedValue([]);

    await expect(
      PracticeProfileFieldsService.saveValues("PATIENT", patientId, orgId, [
        { fieldId: "7fd4c410-5191-49c4-a7f9-9283f6ec9100", value: "note" },
      ]),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("ignores an organisation supplied in the field definition", async () => {
    db.practiceProfileField.create.mockResolvedValue({ id: "f-1" });

    const input = {
      label: "Coat color",
      type: "TEXT" as const,
      options: [] as string[],
      organisationId: "other-org",
    };
    await PracticeProfileFieldsService.create("PATIENT", orgId, input);

    expect(db.practiceProfileField.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organisationId: orgId }),
    });
  });
});
