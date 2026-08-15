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

  it("resolves ensurePrimaryOwnership for the active primary parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "primary-link",
    });

    await expect(
      ParentCompanionService.ensurePrimaryOwnership("parent-1", "patient-1"),
    ).resolves.toBeUndefined();

    expect(mockedPrisma.parentPatient.findFirst).toHaveBeenCalledWith({
      where: {
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
        status: "ACTIVE",
      },
      select: { id: true },
    });
  });
});

const PARENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  profileImageUrl: true,
};

const linkRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "link-1",
  parentId: "parent-1",
  patientId: "patient-1",
  role: "CO_PARENT",
  status: "ACTIVE",
  permissions: {
    assignAsPrimaryParent: false,
    emergencyBasedPermissions: false,
    appointments: false,
    companionProfile: false,
    documents: false,
    expenses: false,
    tasks: false,
    chatWithVet: false,
  },
  invitedByParentId: null,
  acceptedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

// `jest.clearAllMocks()` does not drain `mockResolvedValueOnce` queues, so every
// suite below starts from a hard reset and re-installs the `$transaction` passthrough.
const resetPrismaMocks = () => {
  Object.values(mockedPrisma.parentPatient).forEach((mock) => mock.mockReset());
  Object.values(mockedPrisma.parent).forEach((mock) => mock.mockReset());
  mockedPrisma.$transaction.mockReset();
  mockedPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );
};

describe("ParentCompanionService.linkParent", () => {
  beforeEach(resetPrismaMocks);

  it("rejects a blank identifier before touching the database", async () => {
    await expect(
      ParentCompanionService.linkParent({
        parentId: "   ",
        patientId: "patient-1",
      }),
    ).rejects.toMatchObject({
      message: "Identifier is required.",
      statusCode: 400,
    });

    expect(mockedPrisma.parentPatient.create).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
  });

  it("creates a PENDING co-parent invite without checking for an existing primary", async () => {
    mockedPrisma.parentPatient.create.mockResolvedValueOnce(
      linkRecord({
        id: "link-2",
        parentId: "parent-2",
        status: "PENDING",
        invitedByParentId: "parent-9",
      }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(null);

    const result = await ParentCompanionService.linkParent({
      parentId: "parent-2",
      patientId: "patient-1",
      role: "CO_PARENT",
      invitedByParentId: { toString: () => "parent-9" },
      permissionsOverride: { appointments: true, assignAsPrimaryParent: true },
    });

    // The duplicate-primary guard only runs for an ACTIVE primary link.
    expect(mockedPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.create).toHaveBeenCalledWith({
      data: {
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
        status: "PENDING",
        permissions: expect.objectContaining({
          appointments: true,
          // A co-parent can never be granted the primary flag through an override.
          assignAsPrimaryParent: false,
        }),
        invitedByParentId: "parent-9",
        acceptedAt: undefined,
      },
    });
    expect(result.status).toBe("PENDING");
    expect(result.invitedByParentId).toBe("parent-9");
    expect(result.parent).toBeUndefined();
    expect(result.acceptedAt).toBeUndefined();
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("skips the duplicate-primary guard when an explicit non-active status is given", async () => {
    mockedPrisma.parentPatient.create.mockResolvedValueOnce(
      linkRecord({ role: "PRIMARY", status: "PENDING" }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(null);

    await ParentCompanionService.linkParent({
      parentId: "parent-1",
      patientId: "patient-1",
      role: "PRIMARY",
      status: "PENDING",
    });

    expect(mockedPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PENDING",
        acceptedAt: undefined,
        permissions: expect.objectContaining({ assignAsPrimaryParent: true }),
      }),
    });
  });

  it("maps a P2002 unique-constraint failure on a primary link to a 409", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.parentPatient.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-1",
        patientId: "patient-1",
        role: "PRIMARY",
      }),
    ).rejects.toMatchObject({
      name: "ParentCompanionServiceError",
      message: "Companion already has an active primary parent.",
      statusCode: 409,
    });
  });

  it("maps a P2002 on a co-parent link to a distinct 409 message", async () => {
    mockedPrisma.parentPatient.create.mockRejectedValueOnce({
      code: "P2002",
    });

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      }),
    ).rejects.toMatchObject({
      message: "Parent is already linked to this companion.",
      statusCode: 409,
    });
  });

  it("rethrows a prisma error carrying a different error code", async () => {
    const failure = Object.assign(new Error("FK violation"), {
      code: "P2003",
    });
    mockedPrisma.parentPatient.create.mockRejectedValueOnce(failure);

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      }),
    ).rejects.toBe(failure);
  });

  it("rethrows an error object with no code property", async () => {
    const failure = new Error("connection lost");
    mockedPrisma.parentPatient.create.mockRejectedValueOnce(failure);

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      }),
    ).rejects.toBe(failure);
  });

  it("rethrows a non-object rejection untouched", async () => {
    mockedPrisma.parentPatient.create.mockRejectedValueOnce("db exploded");

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      }),
    ).rejects.toBe("db exploded");
  });

  it("rethrows a nullish rejection untouched", async () => {
    mockedPrisma.parentPatient.create.mockRejectedValueOnce(null);

    await expect(
      ParentCompanionService.linkParent({
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      }),
    ).rejects.toBeNull();
  });
});

describe("ParentCompanionService.activateLink", () => {
  beforeEach(resetPrismaMocks);

  it("returns null when no PENDING invite matches", async () => {
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      ParentCompanionService.activateLink("parent-2", "patient-1"),
    ).resolves.toBeNull();

    expect(mockedPrisma.parentPatient.updateMany).toHaveBeenCalledWith({
      where: {
        parentId: "parent-2",
        patientId: "patient-1",
        status: "PENDING",
      },
      data: { status: "ACTIVE", acceptedAt: expect.any(Date) },
    });
    expect(mockedPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the activated row can no longer be read back", async () => {
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.activateLink("parent-2", "patient-1"),
    ).resolves.toBeNull();
    expect(mockedPrisma.parent.findUnique).not.toHaveBeenCalled();
  });

  it("activates a pending invite and returns it with the parent identity", async () => {
    const acceptedAt = new Date("2026-03-03T10:00:00.000Z");
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(
      linkRecord({
        id: "link-2",
        parentId: "parent-2",
        status: "ACTIVE",
        acceptedAt,
        invitedByParentId: "parent-1",
      }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      id: "parent-2",
      firstName: "Alex",
      lastName: null,
      email: "alex@example.com",
      phoneNumber: null,
      profileImageUrl: null,
    });

    const result = await ParentCompanionService.activateLink(
      { toString: () => "parent-2" },
      "patient-1",
    );

    expect(mockedPrisma.parent.findUnique).toHaveBeenCalledWith({
      where: { id: "parent-2" },
      select: PARENT_SELECT,
    });
    expect(result).toMatchObject({
      parentId: "parent-2",
      status: "ACTIVE",
      acceptedAt: acceptedAt.toISOString(),
      invitedByParentId: "parent-1",
      // Nullable identity columns collapse to empty strings for the client.
      parent: {
        firstName: "Alex",
        lastName: "",
        email: "alex@example.com",
        phoneNumber: "",
        profileImageUrl: "",
      },
    });
  });

  it("rejects a blank parent identifier", async () => {
    await expect(
      ParentCompanionService.activateLink("", "patient-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPrisma.parentPatient.updateMany).not.toHaveBeenCalled();
  });
});

describe("ParentCompanionService.revokeLink", () => {
  beforeEach(resetPrismaMocks);

  it("throws 404 when no row was revoked", async () => {
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      ParentCompanionService.revokeLink("link-1"),
    ).rejects.toMatchObject({ message: "Link not found.", statusCode: 404 });

    expect(mockedPrisma.parentPatient.findUnique).not.toHaveBeenCalled();
  });

  it("throws 404 when the revoked row cannot be read back", async () => {
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parentPatient.findUnique.mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.revokeLink("link-1"),
    ).rejects.toMatchObject({ message: "Link not found.", statusCode: 404 });
  });

  it("revokes the link and returns the updated record", async () => {
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parentPatient.findUnique.mockResolvedValueOnce(
      linkRecord({ status: "REVOKED" }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phoneNumber: "123",
      profileImageUrl: "https://cdn.example.com/jane.png",
    });

    const result = await ParentCompanionService.revokeLink({
      toString: () => " link-1 ",
    });

    expect(mockedPrisma.parentPatient.updateMany).toHaveBeenCalledWith({
      where: { id: "link-1" },
      data: { status: "REVOKED" },
    });
    expect(result.status).toBe("REVOKED");
    expect(result.parent?.profileImageUrl).toBe(
      "https://cdn.example.com/jane.png",
    );
  });

  it("rejects a blank link id", async () => {
    await expect(ParentCompanionService.revokeLink("  ")).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    );
    expect(mockedPrisma.parentPatient.updateMany).not.toHaveBeenCalled();
  });
});

describe("ParentCompanionService.updatePermissions", () => {
  beforeEach(resetPrismaMocks);

  it("rejects a requester who is not the active primary parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.updatePermissions(
        "parent-9",
        "parent-2",
        "patient-1",
        { appointments: true },
      ),
    ).rejects.toMatchObject({
      message: "You are not authorized to modify this companion.",
      statusCode: 403,
    });

    expect(mockedPrisma.parentPatient.update).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.findFirst).toHaveBeenCalledTimes(1);
  });

  it("throws 404 when the target link does not exist", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({ id: "primary-link" })
      .mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.updatePermissions(
        "parent-1",
        "parent-2",
        "patient-1",
        { tasks: true },
      ),
    ).rejects.toMatchObject({ message: "Link not found.", statusCode: 404 });

    expect(mockedPrisma.parentPatient.update).not.toHaveBeenCalled();
  });

  it("refuses to strip the primary flag without promoting a replacement", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({ id: "primary-link" })
      .mockResolvedValueOnce(linkRecord({ role: "PRIMARY", status: "ACTIVE" }));

    await expect(
      ParentCompanionService.updatePermissions(
        "parent-1",
        "parent-1",
        "patient-1",
        { assignAsPrimaryParent: false },
      ),
    ).rejects.toMatchObject({
      message:
        "Cannot remove primary assignment without promoting another parent first.",
      statusCode: 400,
    });

    expect(mockedPrisma.parentPatient.update).not.toHaveBeenCalled();
  });

  it("merges permission updates onto a co-parent without changing the role", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({ id: "primary-link" })
      .mockResolvedValueOnce(
        linkRecord({
          id: "co-link",
          parentId: "parent-2",
          permissions: {
            assignAsPrimaryParent: false,
            emergencyBasedPermissions: false,
            appointments: false,
            companionProfile: true,
            documents: false,
            expenses: false,
            tasks: false,
            chatWithVet: false,
          },
        }),
      );
    mockedPrisma.parentPatient.update.mockResolvedValueOnce(
      linkRecord({
        id: "co-link",
        parentId: "parent-2",
        permissions: {
          assignAsPrimaryParent: false,
          companionProfile: true,
          appointments: true,
        },
      }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(null);

    const result = await ParentCompanionService.updatePermissions(
      "parent-1",
      "parent-2",
      "patient-1",
      { appointments: true },
    );

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "co-link" },
        data: {
          permissions: {
            assignAsPrimaryParent: false,
            emergencyBasedPermissions: false,
            appointments: true,
            companionProfile: true,
            documents: false,
            expenses: false,
            tasks: false,
            chatWithVet: false,
          },
        },
      }),
    );
    expect(result.role).toBe("CO_PARENT");
  });

  it("keeps the primary flag set when updating the acting primary's own permissions", async () => {
    mockedPrisma.parentPatient.findFirst
      .mockResolvedValueOnce({ id: "primary-link" })
      .mockResolvedValueOnce(
        linkRecord({
          id: "primary-link",
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: {
            assignAsPrimaryParent: true,
            documents: true,
          },
        }),
      );
    mockedPrisma.parentPatient.update.mockResolvedValueOnce(
      linkRecord({ id: "primary-link", role: "PRIMARY", status: "ACTIVE" }),
    );
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(null);

    await ParentCompanionService.updatePermissions(
      "parent-1",
      "parent-1",
      "patient-1",
      { assignAsPrimaryParent: true, documents: false },
    );

    // Already primary, so the promotion transaction is skipped and the flag is re-forced.
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          permissions: {
            assignAsPrimaryParent: true,
            documents: false,
          },
        },
      }),
    );
  });
});

describe("ParentCompanionService.removeCoParent", () => {
  beforeEach(resetPrismaMocks);

  it("rejects a requester who is not the active primary parent", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);

    await expect(
      ParentCompanionService.removeCoParent(
        "parent-9",
        "parent-2",
        "patient-1",
        false,
      ),
    ).rejects.toMatchObject({
      message: "You are not authorized to modify this companion.",
      statusCode: 403,
    });

    expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.updateMany).not.toHaveBeenCalled();
  });

  it("soft-revokes the co-parent link", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "primary-link",
    });
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      ParentCompanionService.removeCoParent(
        "parent-1",
        "parent-2",
        "patient-1",
        true,
      ),
    ).resolves.toBeUndefined();

    expect(mockedPrisma.parentPatient.updateMany).toHaveBeenCalledWith({
      where: {
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      },
      data: { status: "REVOKED" },
    });
    expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
  });

  it("throws 404 when a soft revoke matches nothing", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "primary-link",
    });
    mockedPrisma.parentPatient.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      ParentCompanionService.removeCoParent(
        "parent-1",
        "parent-2",
        "patient-1",
        true,
      ),
    ).rejects.toMatchObject({
      message: "Co-parent link not found.",
      statusCode: 404,
    });
  });

  it("hard-deletes the co-parent link", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "primary-link",
    });
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      ParentCompanionService.removeCoParent(
        "parent-1",
        "parent-2",
        "patient-1",
        false,
      ),
    ).resolves.toBeUndefined();

    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: {
        parentId: "parent-2",
        patientId: "patient-1",
        role: "CO_PARENT",
      },
    });
    expect(mockedPrisma.parentPatient.updateMany).not.toHaveBeenCalled();
  });

  it("throws 404 when a hard delete matches nothing", async () => {
    mockedPrisma.parentPatient.findFirst.mockResolvedValueOnce({
      id: "primary-link",
    });
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      ParentCompanionService.removeCoParent(
        "parent-1",
        "parent-2",
        "patient-1",
        false,
      ),
    ).rejects.toMatchObject({
      message: "Co-parent link not found.",
      statusCode: 404,
    });
  });
});

describe("ParentCompanionService link queries", () => {
  beforeEach(resetPrismaMocks);

  it("returns an empty list without querying parents when a companion has no links", async () => {
    mockedPrisma.parentPatient.findMany.mockResolvedValueOnce([]);

    await expect(
      ParentCompanionService.getLinksForCompanion("patient-1"),
    ).resolves.toEqual([]);

    expect(mockedPrisma.parent.findMany).not.toHaveBeenCalled();
  });

  it("omits parent details when the parent record is missing", async () => {
    mockedPrisma.parentPatient.findMany.mockResolvedValueOnce([
      linkRecord({ id: "link-1", parentId: "parent-1" }),
      linkRecord({ id: "link-2", parentId: "parent-2" }),
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

    expect(mockedPrisma.parent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["parent-1", "parent-2"] } },
      select: PARENT_SELECT,
    });
    expect(result[0].parent?.email).toBe("jane@example.com");
    expect(result[1].parent).toBeUndefined();
  });

  it("returns a parent's links without hydrating contact details", async () => {
    mockedPrisma.parentPatient.findMany.mockResolvedValueOnce([
      linkRecord({
        id: "link-1",
        role: "PRIMARY",
        acceptedAt: new Date("2026-04-04T00:00:00.000Z"),
        createdAt: undefined,
        updatedAt: undefined,
      }),
    ]);

    const result = await ParentCompanionService.getLinksForParent("parent-1");

    expect(mockedPrisma.parentPatient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: "parent-1" } }),
    );
    expect(mockedPrisma.parent.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.parent.findUnique).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].parent).toBeUndefined();
    expect(result[0].acceptedAt).toBe("2026-04-04T00:00:00.000Z");
    expect(result[0].createdAt).toBeUndefined();
    expect(result[0].updatedAt).toBeUndefined();
  });

  it("reports whether a parent holds any link at all", async () => {
    mockedPrisma.parentPatient.count.mockResolvedValueOnce(2);
    await expect(ParentCompanionService.hasAnyLinks("parent-1")).resolves.toBe(
      true,
    );
    expect(mockedPrisma.parentPatient.count).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
    });

    mockedPrisma.parentPatient.count.mockResolvedValueOnce(0);
    await expect(ParentCompanionService.hasAnyLinks("parent-2")).resolves.toBe(
      false,
    );
  });

  it("deletes every link for a companion and reports the count", async () => {
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 3 });

    await expect(
      ParentCompanionService.deleteLinksForCompanion("patient-1"),
    ).resolves.toBe(3);
    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
    });
  });

  it("deletes every link for a parent and reports the count", async () => {
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      ParentCompanionService.deleteLinksForParent({
        toString: () => "parent-1",
      }),
    ).resolves.toBe(1);
    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
    });
  });

  it("rejects blank identifiers on the bulk queries", async () => {
    await expect(ParentCompanionService.hasAnyLinks(" ")).rejects.toMatchObject(
      { statusCode: 400 },
    );
    await expect(
      ParentCompanionService.deleteLinksForCompanion(" "),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ParentCompanionService.deleteLinksForParent(" "),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ParentCompanionService.getLinksForParent(" "),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      ParentCompanionService.getActiveCompanionIdsForParent(" "),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.parentPatient.count).not.toHaveBeenCalled();
  });
});
