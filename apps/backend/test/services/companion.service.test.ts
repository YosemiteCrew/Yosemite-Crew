import {
  CompanionService,
  CompanionServiceError,
} from "../../src/services/companion.service";
import { ParentService } from "../../src/services/parent.service";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import { prisma } from "src/config/prisma";
import { moveFile } from "src/middlewares/upload";
import { tempUploadPrefixFor } from "src/utils/upload-key";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    parentPatient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    patientOrganisation: {
      findMany: jest.fn(),
    },
    codeEntry: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/parent.service", () => ({
  ParentService: {
    findByLinkedUserId: jest.fn(),
    mayOrganisationAddCompanion: jest.fn(),
    isInOrganisation: jest.fn(),
  },
}));

// The practice-side checks default to "one of the practice's own clients".
const allowPracticeClient = () => {
  (ParentService.mayOrganisationAddCompanion as jest.Mock).mockResolvedValue(
    true,
  );
  (ParentService.isInOrganisation as jest.Mock).mockResolvedValue(true);
};

jest.mock("../../src/services/parent-companion.service", () => {
  const actual = jest.requireActual(
    "../../src/services/parent-companion.service",
  );
  return {
    ...actual,
    ParentCompanionService: {
      linkParent: jest.fn(),
      getLinksForCompanion: jest.fn(),
      getActiveCompanionIdsForParent: jest.fn(),
      getLinksForParent: jest.fn(),
      ensurePrimaryOwnership: jest.fn(),
      deleteLinksForCompanion: jest.fn(),
    },
  };
});

jest.mock("@yosemite-crew/types", () => ({
  fromCompanionRequestDTO: jest.fn((dto) => dto),
  toCompanionResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

jest.mock("src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "patient/image-key"),
  moveFile: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../src/services/taskLibrary.service", () => ({
  TaskLibraryService: {
    listForSpecies: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createFromLibrary: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  patient: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentPatient: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
  };
  patientOrganisation: {
    findMany: jest.Mock;
  };
  codeEntry: {
    findFirst: jest.Mock;
  };
  parent: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("CompanionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockedPrisma),
    );
    mockedPrisma.parentPatient.findFirst.mockResolvedValue(null);
    allowPracticeClient();
  });

  const companionPayload: any = {
    resourceType: "Patient",
    name: "Buddy",
    type: "dog",
    breed: "Labrador",
    dateOfBirth: new Date("2026-01-01"),
    gender: "male",
    isInsured: false,
    status: "active",
  };

  const createdPatient = {
    id: "patient-1",
    name: "Buddy",
    type: "dog",
    breed: "Labrador",
    speciesCode: null,
    breedCode: null,
    dateOfBirth: new Date("2026-01-01"),
    gender: "male",
    photoUrl: null,
    currentWeight: null,
    colour: null,
    allergy: null,
    bloodGroup: null,
    isNeutered: null,
    ageWhenNeutered: null,
    microchipNumber: null,
    passportNumber: null,
    isInsured: false,
    insurance: null,
    countryOfOrigin: null,
    source: null,
    status: "active",
    physicalAttribute: null,
    breedingInfo: null,
    medicalRecords: null,
    alerts: [],
    isProfileComplete: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("creates a companion and links it to the parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.create.mockResolvedValueOnce(createdPatient);
    mockedPrisma.patient.update.mockResolvedValueOnce(createdPatient);
    (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
      async () => ({
        id: "parent-1",
      }),
    );
    (ParentCompanionService.linkParent as jest.Mock).mockResolvedValueOnce({
      parentId: "parent-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: {},
    });

    const result = await CompanionService.create(companionPayload, {
      authUserId: "provider-1",
      organisationId: "org-1",
    });

    expect(ParentCompanionService.linkParent).toHaveBeenCalledWith({
      parentId: "parent-1",
      patientId: "patient-1",
      role: "PRIMARY",
    });
    expect((result.response as any).mapped).toBe(true);
    // A parent adding their own companion is not a practice action.
    expect(ParentService.mayOrganisationAddCompanion).not.toHaveBeenCalled();
  });

  it("does not add a companion for a parent outside the practice", async () => {
    (
      ParentService.mayOrganisationAddCompanion as jest.Mock
    ).mockResolvedValueOnce(false);

    await expect(
      CompanionService.create(companionPayload, {
        parentId: "parent-9",
        organisationId: "org-1",
      }),
    ).rejects.toMatchObject({ message: "Parent not found.", statusCode: 404 });

    expect(ParentService.mayOrganisationAddCompanion).toHaveBeenCalledWith(
      "parent-9",
      "org-1",
    );
    expect(mockedPrisma.patient.create).not.toHaveBeenCalled();
    expect(ParentCompanionService.linkParent).not.toHaveBeenCalled();
  });

  it("loads default tasks from the task library when present", async () => {
    const { TaskLibraryService } =
      await import("../../src/services/taskLibrary.service");
    const { TaskService } = await import("../../src/services/task.service");

    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.create.mockResolvedValueOnce(createdPatient);
    (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValueOnce({
      id: "parent-1",
    });
    (ParentCompanionService.linkParent as jest.Mock).mockResolvedValueOnce({
      parentId: "parent-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: {},
    });
    (TaskLibraryService.listForSpecies as jest.Mock).mockResolvedValueOnce([
      {
        id: "task-lib-1",
        schema: {
          recurrence: {
            default: {
              type: "WEEKLY",
              cronExpression: "0 0 * * 0",
              endAfterDays: 14,
            },
          },
        },
      },
    ]);

    await CompanionService.create(companionPayload, {
      parentId: "parent-1",
      organisationId: "org-1",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(TaskService.createFromLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        libraryTaskId: "task-lib-1",
        recurrence: expect.objectContaining({
          type: "WEEKLY",
          cronExpression: "0 0 * * 0",
        }),
      }),
    );
  });

  it("strips line breaks from an invalid species code before logging it", async () => {
    const logger = (await import("src/utils/logger")).default;
    (logger.warn as jest.Mock).mockClear();
    // jest.clearAllMocks() does not drain mockResolvedValueOnce queues, so
    // reset the two mocks this case depends on rather than inheriting a
    // leftover from an earlier test.
    mockedPrisma.parentPatient.findFirst.mockReset();
    mockedPrisma.codeEntry.findFirst.mockReset();
    mockedPrisma.parentPatient.findFirst.mockResolvedValue(null);
    // No matching code entry: drives ensureCodeExists down the invalid branch.
    mockedPrisma.codeEntry.findFirst.mockResolvedValue(null);

    try {
      await expect(
        CompanionService.create(
          { ...companionPayload, speciesCode: "dog\r\nforged line" },
          { parentId: "parent-1", organisationId: "org-1" },
        ),
      ).rejects.toEqual(expect.objectContaining({ statusCode: 400 }));

      const logged = (logger.warn as jest.Mock).mock.calls.flat().join(" ");
      expect(logged).toContain("dogforged line");
      expect(logged).not.toContain("\n");
      expect(logged).not.toContain("\r");
    } finally {
      // Leave both mocks pristine so the persistent values above cannot leak.
      mockedPrisma.parentPatient.findFirst.mockReset();
      mockedPrisma.codeEntry.findFirst.mockReset();
    }
  });

  it("rolls back the patient record when parent linking fails", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.create.mockResolvedValueOnce(createdPatient);
    (ParentCompanionService.linkParent as jest.Mock).mockRejectedValueOnce(
      new ParentCompanionServiceError("Link failed", 409),
    );

    await expect(
      CompanionService.create(companionPayload, {
        parentId: "parent-1",
        organisationId: "org-1",
      }),
    ).rejects.toEqual(
      expect.objectContaining({ message: "Link failed", statusCode: 409 }),
    );
    expect(mockedPrisma.patient.deleteMany).toHaveBeenCalledWith({
      where: { id: "patient-1" },
    });
  });

  // Earlier tests leave persistent/once implementations on this mock, so each of these
  // pins findByLinkedUserId explicitly.
  const mockLinkedParent = (parent: { id: string } | null) => {
    (ParentService.findByLinkedUserId as jest.Mock).mockReset();
    (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
      async () => parent,
    );
  };

  it("returns companions linked to a parent", async () => {
    mockLinkedParent({ id: "parent-1" });
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockResolvedValueOnce(["patient-1"]);
    mockedPrisma.patient.findMany.mockResolvedValueOnce([createdPatient]);

    const result = await CompanionService.listByParent("parent-1", {
      authUserId: "auth-1",
    });

    expect(result.responses).toHaveLength(1);
    expect((result.responses[0] as any).id).toBe("patient-1");
  });

  it("returns an empty companion list when the parent has no companions", async () => {
    mockLinkedParent({ id: "parent-1" });
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockReset();
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockImplementation(async () => []);

    const result = await CompanionService.listByParent("parent-1", {
      authUserId: "auth-1",
    });

    expect(result.responses).toEqual([]);
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("rejects listing companions for a parent the caller does not own", async () => {
    mockLinkedParent({ id: "parent-1" });
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockReset();

    await expect(
      CompanionService.listByParent("victim-parent", { authUserId: "auth-1" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Parent not found.",
        statusCode: 404,
      }),
    );
    expect(
      ParentCompanionService.getActiveCompanionIdsForParent,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("rejects listing companions when the caller has no parent record", async () => {
    mockLinkedParent(null);
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockReset();

    await expect(
      CompanionService.listByParent("parent-1", { authUserId: "auth-1" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Parent not found.",
        statusCode: 404,
      }),
    );
    expect(
      ParentCompanionService.getActiveCompanionIdsForParent,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("rejects listing companions without an authenticated user", async () => {
    mockLinkedParent({ id: "parent-1" });

    await expect(CompanionService.listByParent("parent-1", {})).rejects.toEqual(
      expect.objectContaining({
        message: "Authenticated user is required to list companions.",
        statusCode: 401,
      }),
    );
    expect(ParentService.findByLinkedUserId).not.toHaveBeenCalled();
  });

  it("returns companions not linked to an organisation", async () => {
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockResolvedValueOnce(["patient-1", "patient-2"]);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValueOnce([
      { patientId: "patient-2" },
    ]);
    mockedPrisma.patient.findMany.mockResolvedValueOnce([createdPatient]);

    const result = await CompanionService.listByParentNotInOrganisation(
      "parent-1",
      "org-1",
    );

    expect(result.responses).toHaveLength(1);
    expect(ParentService.isInOrganisation).toHaveBeenCalledWith(
      "parent-1",
      "org-1",
    );
  });

  it("reads a parent outside the practice as missing", async () => {
    (ParentService.isInOrganisation as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      CompanionService.listByParentNotInOrganisation("parent-9", "org-1"),
    ).rejects.toMatchObject({ message: "Parent not found.", statusCode: 404 });

    expect(
      ParentCompanionService.getActiveCompanionIdsForParent,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty list when every companion is already linked", async () => {
    (
      ParentCompanionService.getActiveCompanionIdsForParent as jest.Mock
    ).mockResolvedValueOnce(["patient-1"]);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValueOnce([
      { patientId: "patient-1" },
    ]);

    const result = await CompanionService.listByParentNotInOrganisation(
      "parent-1",
      "org-1",
    );

    expect(result.responses).toEqual([]);
    expect(mockedPrisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("updates a companion", async () => {
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.update.mockResolvedValueOnce(createdPatient);

    const result = await CompanionService.update("patient-1", companionPayload);

    expect(mockedPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "patient-1" },
      }),
    );
    expect(result.response.id).toBe("patient-1");
  });

  it("rejects a practice update with no organisation context", async () => {
    await expect(
      CompanionService.updateForOrg("patient-1", "  ", companionPayload),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Organisation is required.",
        statusCode: 400,
      }),
    );
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
  });

  it("never writes a companion that is not linked to the practice", async () => {
    mockedPrisma.patient.findFirst.mockResolvedValueOnce(null);

    await expect(
      CompanionService.updateForOrg("patient-1", "org-1", companionPayload),
    ).resolves.toBeNull();
    expect(mockedPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        id: "patient-1",
        organisations: {
          some: { organisationId: "org-1", status: "ACTIVE" },
        },
      },
      select: { id: true },
    });
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
  });

  it("updates a companion that is linked to the practice", async () => {
    mockedPrisma.patient.findFirst.mockResolvedValueOnce({ id: "patient-1" });
    mockedPrisma.codeEntry.findFirst.mockResolvedValueOnce({ id: "species-1" });
    mockedPrisma.patient.update.mockResolvedValueOnce(createdPatient);

    const result = await CompanionService.updateForOrg(
      "patient-1",
      "org-1",
      companionPayload,
    );

    expect(mockedPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "patient-1" } }),
    );
    expect(result?.response.id).toBe("patient-1");
  });

  it("soft-deletes a companion when the primary parent removes it", async () => {
    (ParentService.findByLinkedUserId as jest.Mock).mockReset();
    (ParentCompanionService.getLinksForCompanion as jest.Mock).mockReset();
    (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
      async () => ({
        id: "parent-1",
      }),
    );
    (
      ParentCompanionService.getLinksForCompanion as jest.Mock
    ).mockImplementation(async () => [
      {
        id: "link-1",
        parentId: "parent-1",
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: {},
      },
    ]);
    mockedPrisma.patient.update.mockResolvedValueOnce({
      ...createdPatient,
      status: "inactive",
    });
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 2 });

    await CompanionService.delete("patient-1", { authUserId: "provider-1" });

    expect(mockedPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: { status: "inactive" },
    });
    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
    });
    expect(mockedPrisma.patient.deleteMany).not.toHaveBeenCalled();
  });

  it("only removes the current link when a co-parent deletes a companion", async () => {
    (ParentService.findByLinkedUserId as jest.Mock).mockReset();
    (ParentCompanionService.getLinksForCompanion as jest.Mock).mockReset();
    (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
      async () => ({
        id: "parent-2",
      }),
    );
    (
      ParentCompanionService.getLinksForCompanion as jest.Mock
    ).mockImplementation(async () => [
      {
        id: "link-2",
        parentId: "parent-2",
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: {},
      },
    ]);
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 1 });

    await CompanionService.delete("patient-1", { authUserId: "provider-1" });

    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: {
        parentId: "parent-2",
        patientId: "patient-1",
      },
    });
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["PRIMARY", "CO_PARENT"])(
    "rejects deletes through a %s link that is still PENDING",
    async (role) => {
      (ParentService.findByLinkedUserId as jest.Mock).mockReset();
      (ParentCompanionService.getLinksForCompanion as jest.Mock).mockReset();
      (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
        async () => ({ id: "parent-4" }),
      );
      (
        ParentCompanionService.getLinksForCompanion as jest.Mock
      ).mockImplementation(async () => [
        {
          id: "link-4",
          parentId: "parent-4",
          role,
          status: "PENDING",
          permissions: {},
        },
      ]);

      await expect(
        CompanionService.delete("patient-1", { authUserId: "provider-1" }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
      expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("rejects deletes when the caller has no companion link", async () => {
    (ParentService.findByLinkedUserId as jest.Mock).mockReset();
    (ParentCompanionService.getLinksForCompanion as jest.Mock).mockReset();
    (ParentService.findByLinkedUserId as jest.Mock).mockImplementation(
      async () => ({
        id: "parent-3",
      }),
    );
    (
      ParentCompanionService.getLinksForCompanion as jest.Mock
    ).mockImplementation(async () => []);

    await expect(
      CompanionService.delete("patient-1", { authUserId: "provider-1" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "You are not authorized to modify this companion.",
        statusCode: 403,
      }),
    );
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.deleteMany).not.toHaveBeenCalled();
  });

  it("throws when a companion lacks a valid parent context", async () => {
    await expect(
      CompanionService.create(companionPayload, undefined),
    ).rejects.toBeInstanceOf(CompanionServiceError);
  });

  it("returns null for invalid companion identifiers", async () => {
    await expect(CompanionService.getById("")).resolves.toBeNull();
  });

  it("returns null when no companion matches the id", async () => {
    mockedPrisma.patient.findUnique.mockResolvedValueOnce(null);

    await expect(CompanionService.getById("missing-1")).resolves.toBeNull();
    expect(mockedPrisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: "missing-1" },
    });
  });

  it("returns a mapped companion by id", async () => {
    mockedPrisma.patient.findUnique.mockResolvedValueOnce(createdPatient);

    const result = await CompanionService.getById("patient-1");

    expect(mockedPrisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: "patient-1" },
    });
    expect(result?.response).toMatchObject({ id: "patient-1" });
  });

  it("returns null for an invalid id in the org-scoped read", async () => {
    await expect(
      CompanionService.getByIdForOrg("", "org-1"),
    ).resolves.toBeNull();
  });

  // `Patient` rows are not org-scoped in the schema, so a read with no
  // organisation would return any tenant's companion.
  it("rejects an org-scoped read with no organisation context", async () => {
    await expect(
      CompanionService.getByIdForOrg("patient-1", "  "),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Organisation is required.",
        statusCode: 400,
      }),
    );
  });

  it("returns null when the id is not linked to the organisation", async () => {
    mockedPrisma.patient.findFirst.mockResolvedValueOnce(null);

    await expect(
      CompanionService.getByIdForOrg("patient-1", "org-1"),
    ).resolves.toBeNull();
    expect(mockedPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        id: "patient-1",
        organisations: {
          some: { organisationId: "org-1", status: "ACTIVE" },
        },
      },
    });
  });

  it("returns a mapped companion when the id is linked to the organisation", async () => {
    mockedPrisma.patient.findFirst.mockResolvedValueOnce(createdPatient);

    const result = await CompanionService.getByIdForOrg("patient-1", "org-1");

    expect(result?.response).toMatchObject({ id: "patient-1" });
  });

  it("rejects blank search terms", async () => {
    await expect(CompanionService.getByName("   ", "org-1")).rejects.toEqual(
      expect.objectContaining({
        message: "Name is required for searching.",
        statusCode: 400,
      }),
    );
  });

  // `Patient` rows are not org-scoped in the schema, so a search with no
  // organisation would return every companion in the product.
  it("rejects a search with no organisation context", async () => {
    await expect(CompanionService.getByName("fido", "  ")).rejects.toEqual(
      expect.objectContaining({
        message: "Organisation is required for searching.",
        statusCode: 400,
      }),
    );
  });

  it("scopes the search with a relation filter, not a materialised id list", async () => {
    // The previous form fetched every active patient id for the organisation
    // and sent them back as an IN clause, so both the work and the query size
    // grew with the organisation.
    mockedPrisma.patient.findMany.mockResolvedValueOnce([createdPatient]);

    await CompanionService.getByName("fido", "org-1");

    expect(mockedPrisma.patient.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: "fido", mode: "insensitive" },
        organisations: {
          some: { organisationId: "org-1", status: "ACTIVE" },
        },
      },
    });
    expect(mockedPrisma.patientOrganisation.findMany).not.toHaveBeenCalled();
  });

  it("rejects delete requests without authenticated parent context", async () => {
    await expect(CompanionService.delete("patient-1")).rejects.toEqual(
      expect.objectContaining({
        message: "Authenticated user is required to delete a companion.",
        statusCode: 401,
      }),
    );
  });
});

describe("CompanionService.create profile photo", () => {
  const MINE = `${tempUploadPrefixFor("user-1")}photo.jpg`;
  const THEIRS = `${tempUploadPrefixFor("user-2")}photo.jpg`;

  // A signed-in parent adds a companion from the app.
  const create = (photoUrl: string) =>
    CompanionService.create(
      { resourceType: "Patient", name: "Buddy", type: "dog", photoUrl } as any,
      { authUserId: "user-1" },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue({
      id: "parent-1",
    });
    allowPracticeClient();
    mockedPrisma.patient.create.mockResolvedValue({ id: "patient-1" });
    mockedPrisma.patient.update.mockResolvedValue({ id: "patient-1" });
    (ParentCompanionService.linkParent as jest.Mock).mockResolvedValue({});
    (moveFile as jest.Mock).mockResolvedValue(
      "https://cdn.example.test/patient/image-key",
    );
  });

  it("moves the caller's fresh upload into the companion's folder", async () => {
    await create(MINE);

    // The upload itself is never saved on the companion.
    expect(mockedPrisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoUrl: undefined }),
    });
    expect(moveFile).toHaveBeenCalledWith(MINE, "patient/image-key", "user-1");
    expect(mockedPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: { photoUrl: "https://cdn.example.test/patient/image-key" },
    });
  });

  it("creates the companion without a photo when the upload cannot be moved", async () => {
    (moveFile as jest.Mock).mockRejectedValueOnce(new Error("missing"));

    await expect(create(MINE)).resolves.toBeDefined();

    expect(mockedPrisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoUrl: undefined }),
    });
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
  });

  it.each([
    "https://cdn.example.test/companion/pet-9/photo.jpg",
    "data:image/png;base64,iVBORw0KGgo=",
  ])("keeps the link %s as given", async (photoUrl) => {
    await create(photoUrl);

    expect(mockedPrisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoUrl }),
    });
    expect(moveFile).not.toHaveBeenCalled();
  });

  it.each([
    ["another person's upload", THEIRS],
    ["an upload that is not kept per person", "temp/uploads/photo.jpg"],
    ["a stored companion file", "companion/pet-9/photo.jpg"],
    ["a relative path", `${tempUploadPrefixFor("user-1")}../photo.jpg`],
    ["an http link", "http://cdn.example.test/photo.jpg"],
    ["a file link", "file:///etc/hosts"],
    ["a script link", "javascript:alert(1)"],
    ["an inline svg", "data:image/svg+xml;base64,PHN2Zz4="],
  ])(
    "returns 400 for %s without creating the companion",
    async (_label, photoUrl) => {
      await expect(create(photoUrl)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid photo key.",
      });
      expect(mockedPrisma.patient.create).not.toHaveBeenCalled();
      expect(moveFile).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for a fresh upload on a practice create, which names no uploader", async () => {
    await expect(
      CompanionService.create(
        {
          resourceType: "Patient",
          name: "Buddy",
          type: "dog",
          photoUrl: MINE,
        } as any,
        { parentId: "parent-1", organisationId: "org-1" },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPrisma.patient.create).not.toHaveBeenCalled();
  });
});

describe("CompanionService.update profile photo", () => {
  const MINE = `${tempUploadPrefixFor("user-1")}photo.jpg`;
  const THEIRS = `${tempUploadPrefixFor("user-2")}photo.jpg`;
  const SAVED = "https://cdn.example.test/companion/patient-1/old.jpg";

  const update = (photoUrl: string) =>
    CompanionService.update(
      "patient-1",
      { resourceType: "Patient", name: "Buddy", type: "dog", photoUrl } as any,
      { authUserId: "user-1" },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.patient.findUnique.mockResolvedValue({
      alerts: null,
      photoUrl: SAVED,
    });
    mockedPrisma.patient.update.mockResolvedValue({ id: "patient-1" });
    (moveFile as jest.Mock).mockResolvedValue(
      "https://cdn.example.test/patient/image-key",
    );
  });

  it("moves the caller's fresh upload into the companion's folder and saves where it went", async () => {
    await update(MINE);

    expect(moveFile).toHaveBeenCalledWith(MINE, "patient/image-key", "user-1");
    expect(mockedPrisma.patient.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({
        photoUrl: "https://cdn.example.test/patient/image-key",
      }),
    });
  });

  it("leaves the saved photo in place when the upload cannot be moved", async () => {
    (moveFile as jest.Mock).mockRejectedValueOnce(new Error("missing"));

    await update(MINE);

    expect(mockedPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({ photoUrl: undefined }),
    });
  });

  it("keeps the saved photo as it is", async () => {
    mockedPrisma.patient.findUnique.mockResolvedValue({
      alerts: null,
      photoUrl: "temp/uploads/legacy.jpg",
    });

    await update("temp/uploads/legacy.jpg");

    expect(moveFile).not.toHaveBeenCalled();
    expect(mockedPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({ photoUrl: "temp/uploads/legacy.jpg" }),
    });
  });

  it.each([
    ["another person's upload", THEIRS],
    ["an http link", "http://cdn.example.test/photo.jpg"],
    ["a file link", "file:///etc/hosts"],
    ["a stored companion file", "companion/pet-9/photo.jpg"],
  ])("returns 400 for %s without saving", async (_label, photoUrl) => {
    await expect(update(photoUrl)).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid photo key.",
    });
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
    expect(moveFile).not.toHaveBeenCalled();
  });

  it("returns 400 for a fresh upload when no uploader is known", async () => {
    await expect(
      CompanionService.update("patient-1", {
        resourceType: "Patient",
        name: "Buddy",
        type: "dog",
        photoUrl: MINE,
      } as any),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPrisma.patient.update).not.toHaveBeenCalled();
  });
});
