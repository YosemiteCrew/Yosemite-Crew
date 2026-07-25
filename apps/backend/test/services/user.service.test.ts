const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userOrganization: {
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  userProfile: {
    deleteMany: jest.fn(),
  },
  baseAvailability: {
    deleteMany: jest.fn(),
  },
  weeklyAvailabilityOverride: {
    deleteMany: jest.fn(),
  },
  occupancy: {
    deleteMany: jest.fn(),
  },
};

jest.mock("src/config/prisma", () => ({
  prisma: mockPrisma,
}));

const mockAuthUpdateUserName = jest.fn();
const mockGetAuthService = jest.fn();

jest.mock("@yosemite-crew/auth", () => ({
  ...jest.requireActual("@yosemite-crew/auth"),
  getAuthService: () => mockGetAuthService(),
}));

const mockOrganizationDeleteById = jest.fn();

jest.mock("src/services/organization.service", () => ({
  OrganizationService: {
    deleteById: mockOrganizationDeleteById,
  },
}));

const mockUserOrganizationDeleteById = jest.fn();

jest.mock("src/services/user-organization.service", () => ({
  UserOrganizationService: {
    deleteById: mockUserOrganizationDeleteById,
  },
}));

import { UserService, UserServiceError } from "src/services/user.service";

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthService.mockReset();
    mockAuthUpdateUserName.mockReset();
    mockOrganizationDeleteById.mockReset();
    mockUserOrganizationDeleteById.mockReset();
  });

  it("creates users through postgres only", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      userId: "user-321",
      email: "person@example.com",
      firstName: "First",
      lastName: "Last",
      isActive: true,
    });

    const result = await UserService.create({
      id: "user-321",
      email: "Person@Example.com",
      firstName: "First",
      lastName: "Last",
      isActive: true,
    });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        userId: "user-321",
        email: "person@example.com",
        firstName: "First",
        lastName: "Last",
        isActive: true,
      },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
    expect(result).toEqual({
      id: "user-321",
      firstName: "First",
      lastName: "Last",
      email: "person@example.com",
      isActive: true,
    });
  });

  it("throws when a duplicate user already exists", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "row-1" });

    await expect(
      UserService.create({
        id: "user-321",
        email: "person@example.com",
        firstName: "First",
        lastName: "Last",
        isActive: true,
      }),
    ).rejects.toMatchObject({
      message: "User with the same id or email already exists.",
      statusCode: 409,
    });
  });

  it("returns the existing user by id", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userId: "user-123",
      email: "person@example.com",
      firstName: "Old",
      lastName: "Name",
      isActive: true,
    });

    const result = await UserService.getById("user-123");

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
    expect(result).toEqual({
      id: "user-123",
      email: "person@example.com",
      firstName: "Old",
      lastName: "Name",
      isActive: true,
    });
  });

  it("returns null when the user does not exist", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(UserService.getById("user-404")).resolves.toBeNull();
  });

  it("updates a user's name in postgres and syncs the auth service", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userId: "user-123",
      email: "person@example.com",
      firstName: "Old",
      lastName: "Name",
      isActive: true,
    });
    mockPrisma.user.update.mockResolvedValue({
      userId: "user-123",
      email: "person@example.com",
      firstName: "New",
      lastName: "Name",
      isActive: true,
    });
    mockGetAuthService.mockReturnValue({
      updateUserName: mockAuthUpdateUserName,
    });

    const result = await UserService.updateName({
      userId: "user-123",
      firstName: "New",
      lastName: "Name",
    });

    expect(mockAuthUpdateUserName).toHaveBeenCalledWith("user-123", {
      firstName: "New",
      lastName: "Name",
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { firstName: "New", lastName: "Name" },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
    expect(result).toEqual({
      id: "user-123",
      email: "person@example.com",
      firstName: "New",
      lastName: "Name",
      isActive: true,
    });
  });

  it("returns the existing user without writing when the name is unchanged", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userId: "user-123",
      email: "person@example.com",
      firstName: "Same",
      lastName: "Name",
      isActive: true,
    });
    mockGetAuthService.mockReturnValue({
      updateUserName: mockAuthUpdateUserName,
    });

    const result = await UserService.updateName({
      userId: "user-123",
      firstName: "Same",
      lastName: "Name",
    });

    expect(mockAuthUpdateUserName).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "user-123",
      email: "person@example.com",
      firstName: "Same",
      lastName: "Name",
      isActive: true,
    });
  });

  it("updates the database even when no auth service is configured", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userId: "user-456",
      email: "person@example.com",
      firstName: "Old",
      lastName: "Name",
      isActive: true,
    });
    mockPrisma.user.update.mockResolvedValue({
      userId: "user-456",
      email: "person@example.com",
      firstName: "New",
      lastName: "Name",
      isActive: true,
    });
    mockGetAuthService.mockReturnValue(null);

    const result = await UserService.updateName({
      userId: "user-456",
      firstName: "New",
      lastName: "Name",
    });

    expect(mockAuthUpdateUserName).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "user-456",
      email: "person@example.com",
      firstName: "New",
      lastName: "Name",
      isActive: true,
    });
  });

  it("throws when the user does not exist", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      UserService.updateName({
        userId: "user-404",
        firstName: "First",
        lastName: "Last",
      }),
    ).rejects.toMatchObject({
      message: "User not found.",
      statusCode: 404,
    });
  });

  it("deletes the user, related rows and owner organizations", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "row-1" });
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        id: "mapping-1",
        roleCode: "OWNER",
        organizationReference: "Organization/org-1",
      },
      {
        id: "mapping-2",
        roleCode: "MEMBER",
        organizationReference: "Organization/org-2",
      },
    ]);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await UserService.deleteById("user-123");

    expect(mockUserOrganizationDeleteById).toHaveBeenCalledWith("mapping-1");
    expect(mockUserOrganizationDeleteById).toHaveBeenCalledWith("mapping-2");
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { isActive: false },
    });
    expect(mockOrganizationDeleteById).toHaveBeenCalledWith("org-1");
    expect(result).toBe(true);
  });

  it("releases seats through UserOrganizationService rather than deleting mappings directly", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "row-1" });
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        id: "mapping-1",
        roleCode: "MEMBER",
        organizationReference: "Organization/org-1",
      },
    ]);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await UserService.deleteById("user-123");

    // deleteById is what releases the member slot and re-syncs Stripe seats; a raw
    // prisma delete would drop the mapping while leaving both counts overstated.
    expect(mockUserOrganizationDeleteById).toHaveBeenCalledTimes(1);
    expect(mockUserOrganizationDeleteById).toHaveBeenCalledWith("mapping-1");
    expect(mockPrisma.userOrganization.delete).not.toHaveBeenCalled();
  });

  it("returns false when the user is missing during delete", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(UserService.deleteById("missing")).resolves.toBe(false);
  });

  it("throws when an owner mapping has an invalid organization reference", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "row-1" });
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        id: "mapping-1",
        roleCode: "OWNER",
        organizationReference: "Organization",
      },
    ]);

    await expect(UserService.deleteById("user-9")).rejects.toMatchObject({
      message: "Invalid organization reference format.",
      statusCode: 400,
    });
  });
});
