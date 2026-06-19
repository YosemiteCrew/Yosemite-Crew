import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { assertSafeString } from "src/utils/sanitize";

jest.mock("src/config/prisma", () => ({
  prisma: {
    authUserMobile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

jest.mock("src/utils/sanitize", () => ({
  assertSafeString: jest.fn((value) => value),
}));

const mockedPrisma = prisma as unknown as {
  authUserMobile: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  parent: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("AuthUserMobileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an existing auth user", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      id: "auth-1",
      authProvider: "firebase",
      providerUserId: "provider-1",
      email: "user@example.com",
      parentId: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });

    const result = await AuthUserMobileService.createOrGetAuthUser(
      "firebase",
      "provider-1",
      "user@example.com",
    );

    expect(assertSafeString).toHaveBeenCalledWith(
      "provider-1",
      "providerUserId",
    );
    expect(result.id).toBe("auth-1");
    expect(mockedPrisma.authUserMobile.create).not.toHaveBeenCalled();
  });

  it("creates a new auth user when missing", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.authUserMobile.create.mockResolvedValueOnce({
      id: "auth-2",
      authProvider: "cognito",
      providerUserId: "provider-2",
      email: "new@example.com",
      parentId: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });

    const result = await AuthUserMobileService.createOrGetAuthUser(
      "cognito",
      "provider-2",
      "new@example.com",
    );

    expect(mockedPrisma.authUserMobile.create).toHaveBeenCalledWith({
      data: {
        authProvider: "cognito",
        providerUserId: "provider-2",
        email: "new@example.com",
      },
    });
    expect(result.id).toBe("auth-2");
  });

  it("links a parent to the auth user", async () => {
    mockedPrisma.authUserMobile.findFirst
      .mockResolvedValueOnce({
        id: "auth-1",
        authProvider: "firebase",
        providerUserId: "provider-1",
        email: "user@example.com",
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "auth-1",
        authProvider: "firebase",
        providerUserId: "provider-1",
        email: "user@example.com",
        parentId: "parent-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      id: "parent-1",
      linkedUserId: null,
    });
    mockedPrisma.authUserMobile.update.mockResolvedValueOnce({});
    mockedPrisma.parent.update.mockResolvedValueOnce({});

    const result = await AuthUserMobileService.linkParent(
      "provider-1",
      "parent-1",
    );

    expect(mockedPrisma.authUserMobile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-1" },
        data: { parentId: "parent-1" },
      }),
    );
    expect(result.parentId).toBe("parent-1");
  });

  it("relinks a parent and clears previous mappings", async () => {
    mockedPrisma.authUserMobile.findFirst
      .mockResolvedValueOnce({
        id: "auth-1",
        authProvider: "firebase",
        providerUserId: "provider-1",
        email: "user@example.com",
        parentId: "parent-old",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "auth-1",
        authProvider: "firebase",
        providerUserId: "provider-1",
        email: "user@example.com",
        parentId: "parent-new",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      id: "parent-new",
      linkedUserId: "auth-old",
    });
    mockedPrisma.parent.updateMany.mockResolvedValueOnce({});
    mockedPrisma.authUserMobile.updateMany.mockResolvedValueOnce({});
    mockedPrisma.authUserMobile.update.mockResolvedValueOnce({});
    mockedPrisma.parent.update.mockResolvedValueOnce({});

    const result = await AuthUserMobileService.linkParent(
      "provider-1",
      "parent-new",
    );

    expect(mockedPrisma.parent.updateMany).toHaveBeenCalledWith({
      where: { id: "parent-old" },
      data: { linkedUserId: null },
    });
    expect(mockedPrisma.authUserMobile.updateMany).toHaveBeenCalledWith({
      where: { id: "auth-old" },
      data: { parentId: null },
    });
    expect(result.parentId).toBe("parent-new");
  });

  it("auto-links parent by email", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValueOnce({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "user@example.com",
    });
    mockedPrisma.authUserMobile.updateMany.mockResolvedValueOnce({});
    mockedPrisma.parent.update.mockResolvedValueOnce({});

    const result = await AuthUserMobileService.autoLinkParentByEmail({
      id: "auth-1",
      authProvider: "firebase",
      providerUserId: "provider-1",
      email: "user@example.com",
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result).toEqual({
      id: "parent-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "user@example.com",
    });
  });

  it("returns null when no parent matches the email for auto-linking", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValueOnce(null);

    const result = await AuthUserMobileService.autoLinkParentByEmail({
      id: "auth-1",
      authProvider: "firebase",
      providerUserId: "provider-1",
      email: "user@example.com",
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result).toBeNull();
    expect(mockedPrisma.authUserMobile.updateMany).not.toHaveBeenCalled();
  });

  it("warns and returns null when auth user id lookup misses", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce(null);

    const result =
      await AuthUserMobileService.getAuthUserMobileIdByProviderId("missing");

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "AuthUserMobile not found for providerUserId: missing",
    );
  });

  it("returns an auth user id when lookup succeeds", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      id: "auth-3",
    });

    const result =
      await AuthUserMobileService.getAuthUserMobileIdByProviderId("provider-3");

    expect(result).toBe("auth-3");
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
