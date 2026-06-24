import {
  ParentService,
  ParentServiceError,
} from "../../src/services/parent.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { prisma } from "src/config/prisma";
import { moveFile } from "../../src/middlewares/upload";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentAddress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentPatient: {
      deleteMany: jest.fn(),
    },
    authUserMobile: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getAuthUserMobileIdByProviderId: jest.fn(),
    linkParent: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "parent/image-key"),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromParentRequestDTO: jest.fn((dto) => dto),
  toParentResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

const mockedPrisma = prisma as unknown as {
  parent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentAddress: {
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentPatient: {
    deleteMany: jest.Mock;
  };
  authUserMobile: {
    findFirst: jest.Mock;
    updateMany: jest.Mock;
  };
};

const mockParent = {
  id: "parent-1",
  firstName: "Jane",
  lastName: "Doe",
  birthDate: new Date("2026-01-01"),
  email: "jane@example.com",
  phoneNumber: "123",
  currency: "USD",
  timezone: "UTC",
  profileImageUrl: null,
  isProfileComplete: true,
  linkedUserId: "auth-1",
  createdFrom: "mobile",
  alerts: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  address: {
    addressLine: "Line 1",
    country: "US",
    city: "Austin",
    state: "TX",
    postalCode: "73301",
    latitude: null,
    longitude: null,
  },
};

describe("ParentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a mobile parent and links the auth user", async () => {
    (
      AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
    ).mockResolvedValueOnce("auth-1");
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      id: "auth-1",
      parentId: null,
    });
    mockedPrisma.parent.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.parent.create.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
    });
    mockedPrisma.parent.update.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
    });
    (moveFile as jest.Mock).mockResolvedValueOnce(
      "https://cdn.example.com/parent.jpg",
    );
    (AuthUserMobileService.linkParent as jest.Mock).mockResolvedValueOnce({
      id: "auth-1",
      parentId: "parent-1",
    });

    const result = await ParentService.create(
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "Jane@example.com",
        phoneNumber: "123",
        birthDate: new Date("2026-01-01"),
        address: {
          addressLine: "Line 1",
          country: "US",
          city: "Austin",
          state: "TX",
          postalCode: "73301",
          latitude: null,
          longitude: null,
        },
      } as any,
      { source: "mobile", authUserId: "provider-1" },
    );

    expect(AuthUserMobileService.linkParent).toHaveBeenCalledWith(
      "provider-1",
      "parent-1",
    );
    expect((result.response as any).mapped).toBe(true);
  });

  it("rejects invalid parent timezone values", async () => {
    await expect(
      ParentService.create(
        {
          firstName: "Jane",
          email: "jane@example.com",
          timezone: "Mars/Phobos",
        } as any,
        { source: "pms" },
      ),
    ).rejects.toMatchObject({
      message: "Timezone must be a valid IANA timezone or UTC offset.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);
  });

  it("rejects duplicate linked users when creating parents", async () => {
    (
      AuthUserMobileService.getAuthUserMobileIdByProviderId as jest.Mock
    ).mockResolvedValueOnce("auth-1");
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      id: "auth-1",
      parentId: null,
    });
    mockedPrisma.parent.findFirst.mockResolvedValueOnce({
      id: "parent-existing",
    });

    await expect(
      ParentService.create(
        {
          firstName: "Jane",
          email: "jane@example.com",
        } as any,
        { source: "mobile", authUserId: "provider-1" },
      ),
    ).rejects.toMatchObject({
      message: "Parent already exists for this user.",
      statusCode: 409,
    } satisfies Partial<ParentServiceError>);
  });

  it("logs profile image move failures but still creates the parent", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.parent.create.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
      profileImageUrl: null,
      linkedUserId: null,
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
      profileImageUrl: null,
      linkedUserId: null,
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      ...mockParent,
      isProfileComplete: false,
      address: null,
      profileImageUrl: null,
      linkedUserId: null,
    });
    (moveFile as jest.Mock).mockRejectedValueOnce(new Error("bad key"));

    const result = await ParentService.create(
      {
        firstName: "Jane",
        email: "jane@example.com",
        profileImageUrl: "https://cdn.example.com/original.jpg",
      } as any,
      { source: "pms" },
    );

    expect(moveFile).toHaveBeenCalledWith(
      "https://cdn.example.com/original.jpg",
      "parent/image-key",
    );
    expect(result.response.id).toBe("parent-1");
  });

  it("throws when mobile create is missing auth user", async () => {
    await expect(
      ParentService.create(
        { firstName: "Jane", email: "jane@example.com" } as any,
        {
          source: "mobile",
        },
      ),
    ).rejects.toBeInstanceOf(ParentServiceError);
  });

  it("returns a parent by id", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(mockParent);

    const result = await ParentService.get("parent-1");

    expect((result?.response as any).mapped).toBe(true);
    expect(result?.response.id).toBe("parent-1");
  });

  it("updates a parent and normalizes timezone", async () => {
    mockedPrisma.parent.update.mockResolvedValueOnce(mockParent);
    // findUnique is called for the pre-update alert snapshot and twice via resolveParentRecord.
    mockedPrisma.parent.findUnique.mockResolvedValue(mockParent);

    const result = await ParentService.update(
      "parent-1",
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123",
        birthDate: new Date("2026-01-01"),
        timezone: "UTC+05:30 - Asia/Kolkata",
        alerts: [{ title: "Allergy", severity: "high" }],
        address: {
          addressLine: "Line 1",
          country: "US",
          city: "Austin",
          state: "TX",
          postalCode: "73301",
          latitude: null,
          longitude: null,
        },
      } as any,
      { source: "pms" },
    );

    expect(mockedPrisma.parent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-1" },
        data: expect.objectContaining({ timezone: "Asia/Kolkata" }),
      }),
    );
    expect(mockedPrisma.parent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-1" },
        data: expect.objectContaining({
          alerts: [{ title: "Allergy", severity: "high" }],
        }),
      }),
    );
    expect(result?.response.id).toBe("parent-1");
  });

  it("persists client alerts on a PMS update", async () => {
    mockedPrisma.parent.update.mockResolvedValueOnce(mockParent);
    mockedPrisma.parent.findUnique.mockResolvedValue(mockParent);

    const alerts = [{ title: "Aggressive", severity: "high" }];
    await ParentService.update(
      "parent-1",
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "123",
        alerts,
      } as any,
      { source: "pms" },
    );

    expect(mockedPrisma.parent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "parent-1" },
        data: expect.objectContaining({ alerts }),
      }),
    );
  });

  it("does not touch client alerts on a mobile update (prevents wiping vet-set alerts)", async () => {
    // clearAllMocks does not drain mockResolvedValueOnce queues, so reset to avoid
    // consuming a leaked queued value and leaving this one for a later test.
    mockedPrisma.authUserMobile.findFirst.mockReset();
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      parentId: "parent-1",
    });
    mockedPrisma.parent.update.mockResolvedValueOnce(mockParent);
    mockedPrisma.parent.findUnique.mockResolvedValue(mockParent);

    // A mobile self-service profile edit never carries client alerts.
    await ParentService.update(
      "parent-1",
      {
        firstName: "Jane",
        email: "jane@example.com",
        phoneNumber: "123",
      } as any,
      { source: "mobile", authUserId: "provider-1" },
    );

    const dataArg =
      mockedPrisma.parent.update.mock.calls.at(-1)?.[0]?.data ?? {};
    expect(dataArg).not.toHaveProperty("alerts");
  });

  it("clears links and auth user mapping on delete", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(mockParent);
    mockedPrisma.parentPatient.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.authUserMobile.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parentAddress.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.parent.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await ParentService.delete("parent-1", { source: "pms" });

    expect(result?.id).toBe("parent-1");
    expect(mockedPrisma.parentPatient.deleteMany).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
    });
  });

  it("returns null when linked user mapping is missing", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce(null);

    const result = await ParentService.findByLinkedUserId("provider-1");

    expect(result).toBeNull();
  });

  it("rejects invalid auth ids and empty search names", async () => {
    await expect(ParentService.findByLinkedUserId("")).rejects.toMatchObject({
      message: "Invalid AuthUser ID.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);

    await expect(ParentService.getByName("   ")).rejects.toMatchObject({
      message: "Name is required for searching.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);
  });

  it("returns null when a mobile-authenticated caller asks for a different parent", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      parentId: "other-parent",
    });

    const result = await ParentService.get("parent-1", {
      source: "mobile",
      authUserId: "provider-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when a mobile-authenticated update targets another parent", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValueOnce({
      parentId: "other-parent",
    });

    const result = await ParentService.update(
      "parent-1",
      {
        firstName: "Jane",
        email: "jane@example.com",
      } as any,
      {
        source: "mobile",
        authUserId: "provider-1",
      },
    );

    expect(result).toBeNull();
    expect(mockedPrisma.parent.update).not.toHaveBeenCalled();
  });

  it("rejects mobile deletes without an authenticated user", async () => {
    await expect(
      ParentService.delete("parent-1", { source: "mobile" }),
    ).rejects.toMatchObject({
      message: "Authenticated user ID required.",
      statusCode: 401,
    } satisfies Partial<ParentServiceError>);
  });

  it("returns parents by name", async () => {
    mockedPrisma.parent.findMany.mockResolvedValueOnce([mockParent]);

    const result = await ParentService.getByName("Jane");

    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].id).toBe("parent-1");
  });
});
