import validator from "validator";
import { User } from "@yosemite-crew/types";
import { CognitoService } from "./cognito.service";
import { OrganizationService } from "./organization.service";
import { prisma } from "src/config/prisma";

export class UserServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

const forbidQueryOperators = (input: string, field: string) => {
  if (input.includes("$")) {
    throw new UserServiceError(`Invalid character in ${field}.`, 400);
  }
};

const requireString = (value: unknown, field: string): string => {
  if (value == null) {
    throw new UserServiceError(`${field} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new UserServiceError(`${field} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new UserServiceError(`${field} cannot be empty.`, 400);
  }

  forbidQueryOperators(trimmed, field);

  return trimmed;
};

const requireSafeIdentifier = (value: unknown, field: string): string => {
  const identifier = requireString(value, field);

  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(identifier)) {
    throw new UserServiceError(`Invalid ${field} format.`, 400);
  }

  return identifier;
};

const extractOrganizationIdentifier = (reference: unknown): string => {
  const trimmed = requireString(reference, "Organization reference");
  const segments = trimmed.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (!lastSegment || lastSegment.toLowerCase() === "organization") {
    throw new UserServiceError("Invalid organization reference format.", 400);
  }

  return lastSegment;
};

const toBoolean = (value: unknown, field: string): boolean => {
  if (value == null) {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new UserServiceError(`${field} must be a boolean.`, 400);
};

const sanitizeUserAttributes = (payload: User) => {
  const userId = requireSafeIdentifier(payload.id, "User id");
  const email = requireString(payload.email, "Email");
  const firstName = requireString(payload.firstName, "First name");
  const lastName = requireString(payload.lastName, "Last name");

  if (!validator.isEmail(email)) {
    throw new UserServiceError("Invalid email address.", 400);
  }

  const isActive = toBoolean(payload.isActive, "isActive");

  return {
    userId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    isActive,
  };
};

type UserDomain = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
};

const toUserDomain = (user: {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}): UserDomain => {
  const { userId, email, firstName, lastName, isActive } = user;

  return {
    id: userId,
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    email,
    isActive,
  };
};

const collectOwnerOrganizationIds = (
  mappings: Array<{
    _id: { toString(): string };
    roleCode?: string | null;
    organizationReference: unknown;
  }>,
) => {
  const ownerOrganizationIds = new Set<string>();

  for (const mapping of mappings) {
    if (mapping.roleCode?.toUpperCase() === "OWNER") {
      ownerOrganizationIds.add(
        extractOrganizationIdentifier(mapping.organizationReference),
      );
    }
  }

  return ownerOrganizationIds;
};

export const UserService = {
  async create(payload: User): Promise<UserDomain> {
    const attributes = sanitizeUserAttributes(payload);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ userId: attributes.userId }, { email: attributes.email }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new UserServiceError(
        "User with the same id or email already exists.",
        409,
      );
    }

    const user = await prisma.user.create({
      data: {
        userId: attributes.userId,
        email: attributes.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        isActive: attributes.isActive,
      },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    return toUserDomain(user);
  },

  async getById(id: unknown): Promise<UserDomain | null> {
    const userId = requireSafeIdentifier(id, "User id");

    const user = await prisma.user.findFirst({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    return user ? toUserDomain(user) : null;
  },

  async deleteById(id: unknown): Promise<boolean> {
    const userId = requireSafeIdentifier(id, "User id");

    const existing = await prisma.user.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    const mappings = await prisma.userOrganization.findMany({
      where: {
        OR: [
          { practitionerReference: userId },
          { practitionerReference: `Practitioner/${userId}` },
        ],
      },
      select: { id: true, roleCode: true, organizationReference: true },
    });

    const ownerOrganizationIds = collectOwnerOrganizationIds(
      mappings.map((mapping) => ({
        _id: { toString: () => mapping.id },
        roleCode: mapping.roleCode,
        organizationReference: mapping.organizationReference,
      })),
    );

    await Promise.all(
      mappings.map((mapping) =>
        prisma.userOrganization.delete({ where: { id: mapping.id } }),
      ),
    );

    await Promise.all([
      prisma.userProfile.deleteMany({ where: { userId } }),
      prisma.baseAvailability.deleteMany({ where: { userId } }),
      prisma.weeklyAvailabilityOverride.deleteMany({ where: { userId } }),
      prisma.occupancy.deleteMany({ where: { userId } }),
    ]);

    const updated = await prisma.user.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    if (updated.count === 0) {
      return false;
    }

    for (const organizationId of ownerOrganizationIds) {
      await OrganizationService.deleteById(organizationId);
    }

    return true;
  },

  async updateName(payload: {
    userId: string;
    firstName: string;
    lastName: string;
  }): Promise<UserDomain> {
    const userId = requireSafeIdentifier(payload.userId, "User id");
    const firstName = requireString(payload.firstName, "First name");
    const lastName = requireString(payload.lastName, "Last name");

    const user = await prisma.user.findFirst({
      where: { userId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UserServiceError("User not found.", 404);
    }

    if (user.firstName === firstName && user.lastName === lastName) {
      return toUserDomain(user);
    }

    await CognitoService.updateUserName({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      cognitoUserId: userId,
      firstName,
      lastName,
    });

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        firstName,
        lastName,
      },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    return toUserDomain(updatedUser);
  },
};

export type { UserDomain as User };
