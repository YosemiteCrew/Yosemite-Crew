import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    parent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  },
}));

const mockedPrisma = prisma as unknown as {
  parentPatient: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
  };
  parent: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("ParentCompanionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a primary link", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.parentPatient.create.mockResolvedValueOnce({
      id: "link-1",
      parentId: "parent-1",
      patientId: "patient-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: {},
      invitedByParentId: null,
      acceptedAt: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phoneNumber: "123",
      profileImageUrl: null,
    });

    const result = await ParentCompanionService.linkParent({
      parentId: "parent-1",
      patientId: "patient-1",
      role: "PRIMARY",
    });

    expect(mockedPrisma.parentPatient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: "parent-1",
          patientId: "patient-1",
          role: "PRIMARY",
          status: "ACTIVE",
        }),
      }),
    );
    expect(result.parentId).toBe("parent-1");
  });

  it("rejects duplicate active primary links", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "link-1",
      parentId: "other-parent",
      patientId: "patient-1",
      role: "PRIMARY",
      status: "ACTIVE",
    });

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns linked parents for a companion", async () => {
    mockedPrisma.parentPatient.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: {},
        invitedByParentId: null,
        acceptedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ]);
    mockedPrisma.parent.findMany.mockResolvedValueOnce([
      {
        id: "parent-1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123",
        profileImageUrl: null,
      },
    ]);

    const result =
      await ParentCompanionService.getLinksForCompanion("patient-1");

    expect(result).toHaveLength(1);
    expect(result[0].parent?.email).toBe("jane@example.com");
  });

  it("promotes a co-parent to primary", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({
        id: "primary-link",
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "target-link",
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: {},
        invitedByParentId: null,
        acceptedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });
    mockedPrisma.parentPatient.update.mockResolvedValueOnce({
      id: "target-link",
      parentId: "parent-2",
      patientId: "patient-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: { assignAsPrimaryParent: true },
      invitedByParentId: null,
      acceptedAt: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    mockedPrisma.parent.findUnique.mockResolvedValue({
      id: "parent-2",
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phoneNumber: "456",
      profileImageUrl: null,
    });

    const result = await ParentCompanionService.updatePermissions(
      "parent-1",
      "parent-2",
      "patient-1",
      { assignAsPrimaryParent: true },
    );

    expect(result.role).toBe("PRIMARY");
  });

  it("demotes the existing primary when promoting via permission updates", async () => {
    const acceptedAt = new Date("2026-02-02");
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({
        id: "requester-link",
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "target-link",
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: {},
        invitedByParentId: null,
        acceptedAt,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      })
      .mockResolvedValueOnce({ id: "old-primary-link" });
    mockedPrisma.parentPatient.update
      .mockResolvedValueOnce({ id: "old-primary-link" })
      .mockResolvedValueOnce({
        id: "target-link",
        parentId: "parent-2",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: { assignAsPrimaryParent: true },
        invitedByParentId: null,
        acceptedAt,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });
    mockedPrisma.parent.findUnique.mockResolvedValue({
      id: "parent-2",
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phoneNumber: "456",
      profileImageUrl: null,
    });

    const result = await ParentCompanionService.updatePermissions(
      "parent-1",
      "parent-2",
      "patient-1",
      { assignAsPrimaryParent: true },
    );

    expect(mockedPrisma.parentPatient.update).toHaveBeenNthCalledWith(1, {
      where: { id: "old-primary-link" },
      data: {
        role: "CO_PARENT",
        permissions: expect.objectContaining({
          assignAsPrimaryParent: false,
        }),
      },
    });
    expect(mockedPrisma.parentPatient.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "target-link" },
        data: expect.objectContaining({
          role: "PRIMARY",
          status: "ACTIVE",
          acceptedAt,
        }),
      }),
    );
    expect(result.role).toBe("PRIMARY");
  });

  it("promotes an active co-parent via promoteToPrimary without an existing primary", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({
        id: "requester-link",
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "target-link",
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: {},
        invitedByParentId: null,
        acceptedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      })
      .mockResolvedValueOnce(null);
    mockedPrisma.parentPatient.update.mockResolvedValueOnce({
      id: "target-link",
      parentId: "parent-2",
      patientId: "patient-1",
      role: "PRIMARY",
      status: "ACTIVE",
      permissions: { assignAsPrimaryParent: true },
      invitedByParentId: null,
      acceptedAt: new Date("2026-03-03"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    mockedPrisma.parent.findUnique.mockResolvedValue({
      id: "parent-2",
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phoneNumber: "456",
      profileImageUrl: null,
    });

    const result = await ParentCompanionService.promoteToPrimary(
      "parent-1",
      "patient-1",
      "parent-2",
    );

    expect(mockedPrisma.parentPatient.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockedPrisma.parentPatient.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "target-link" });
    expect(updateArgs.data.role).toBe("PRIMARY");
    expect(updateArgs.data.acceptedAt).toBeInstanceOf(Date);
    expect(result.role).toBe("PRIMARY");
  });

  it("throws when the promoteToPrimary target link is missing", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({
        id: "requester-link",
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.promoteToPrimary(
        "parent-1",
        "patient-1",
        "parent-2",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns active companion ids for a parent", async () => {
    mockedPrisma.parentPatient.findMany.mockResolvedValueOnce([
      { patientId: "patient-1" },
      { patientId: "patient-2" },
    ]);

    await expect(
      ParentCompanionService.getActiveCompanionIdsForParent("parent-1"),
    ).resolves.toEqual(["patient-1", "patient-2"]);
  });

  it("throws when the requester is not a primary parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.ensurePrimaryOwnership("parent-1", "patient-1"),
    ).rejects.toBeInstanceOf(ParentCompanionServiceError);
  });
});
