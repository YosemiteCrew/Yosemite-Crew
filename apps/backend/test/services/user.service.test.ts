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

jest.mock("src/services/cognito.service", () => ({
  CognitoService: {
    updateUserName: jest.fn(),
  },
}));

jest.mock("src/services/organization.service", () => ({
  OrganizationService: {
    deleteById: jest.fn(),
  },
}));

import { CognitoService } from "src/services/cognito.service";
import { OrganizationService } from "src/services/organization.service";
import { UserService, UserServiceError } from "src/services/user.service";

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a user's name in postgres and cognito", async () => {
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

    const result = await UserService.updateName({
      userId: "user-123",
      firstName: "New",
      lastName: "Name",
    });

    expect(CognitoService.updateUserName).toHaveBeenCalledWith({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      cognitoUserId: "user-123",
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

    const result = await UserService.updateName({
      userId: "user-123",
      firstName: "Same",
      lastName: "Name",
    });

    expect(CognitoService.updateUserName).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "user-123",
      email: "person@example.com",
      firstName: "Same",
      lastName: "Name",
      isActive: true,
    });
  });

  it("throws when the user does not exist", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      UserService.updateName({
        userId: "user-404",
        firstName: "New",
        lastName: "Name",
      }),
    ).rejects.toBeInstanceOf(UserServiceError);

    await expect(
      UserService.updateName({
        userId: "user-404",
        firstName: "New",
        lastName: "Name",
      }),
    ).rejects.toMatchObject({ message: "User not found.", statusCode: 404 });
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
      email: "person@example.com",
      firstName: "First",
      lastName: "Last",
      isActive: true,
    });

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("user-321");
  });

  it("deactivates the user and deletes postgres relations on delete", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "row-1" });
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      {
        id: "mapping-1",
        roleCode: "OWNER",
        organizationReference: "Organization/org-1",
      },
    ]);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await UserService.deleteById("user-123");

    expect(mockPrisma.userOrganization.delete).toHaveBeenCalledWith({
      where: { id: "mapping-1" },
    });
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      data: { isActive: false },
    });
    expect(OrganizationService.deleteById).toHaveBeenCalledWith("org-1");
    expect(result).toBe(true);
  });
});
