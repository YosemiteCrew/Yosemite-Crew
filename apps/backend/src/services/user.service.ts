import isEmail from "validator/lib/isEmail.js";
import { Prisma } from "@prisma/client";
import { User } from "@yosemite-crew/types";
import { getAuthService } from "@yosemite-crew/auth";
import { OrganizationService } from "./organization.service";
import { UserOrganizationService } from "./user-organization.service";
import { prisma } from "src/config/prisma";

const SUPERTOKENS_PROVIDER = "supertokens";

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

  if (!isEmail(email)) {
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

const resolveCanonicalUserId = async (
  userId: string,
): Promise<string | null> => {
  const existing = await prisma.user.findFirst({
    where: { userId },
    select: { userId: true },
  });
  if (existing) {
    return existing.userId ?? userId;
  }

  const identity = await prisma.authIdentity.findFirst({
    where: {
      provider: SUPERTOKENS_PROVIDER,
      providerUserId: userId,
    },
    select: { appUserId: true },
  });

  return identity?.appUserId ?? null;
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

    try {
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
    } catch (error) {
      /*
       * The check above is a read, so two first-time provisioning calls can
       * both pass it before either insert lands - two verification tabs, or
       * the client's own retry. `userId` and `email` are both unique, so the
       * loser gets a raw P2002 here rather than the 409 the caller expects,
       * and provisioning fails with a 500 on an account that now exists.
       * Same conflict, same answer.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new UserServiceError(
          "User with the same id or email already exists.",
          409,
        );
      }
      throw error;
    }
  },

  async getById(id: unknown): Promise<UserDomain | null> {
    const userId = requireSafeIdentifier(id, "User id");
    const resolvedUserId = await resolveCanonicalUserId(userId);

    if (!resolvedUserId) {
      return null;
    }

    const user = await prisma.user.findFirst({
      where: { userId: resolvedUserId },
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
    const resolvedUserId = await resolveCanonicalUserId(userId);

    if (!resolvedUserId) {
      return false;
    }

    const existing = await prisma.user.findFirst({
      where: { userId: resolvedUserId },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    // Match BOTH the id that was supplied and the canonical one it resolved to.
    // A migrated account has two: the provider alias the client calls with, and
    // the legacy app user id its `userOrganization` rows are stored under.
    // Querying only the supplied alias found no mappings, so deletion removed no
    // organisation roles and reported success while the still-authenticated
    // session kept every permission those mappings grant.
    const practitionerIds = [
      ...new Set([userId, resolvedUserId].filter(Boolean)),
    ];
    const mappings = await prisma.userOrganization.findMany({
      where: {
        OR: practitionerIds.flatMap((practitionerId) => [
          { practitionerReference: practitionerId },
          { practitionerReference: `Practitioner/${practitionerId}` },
        ]),
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

    // Sequential, and via the service rather than a raw delete: deleteById releases the
    // organisation's member slot and re-syncs Stripe seats, so a direct delete here would
    // leave usersActiveCount and the billed seat count overstated.
    for (const mapping of mappings) {
      await UserOrganizationService.deleteById(mapping.id);
    }

    await Promise.all([
      prisma.userProfile.deleteMany({ where: { userId: resolvedUserId } }),
      prisma.baseAvailability.deleteMany({ where: { userId: resolvedUserId } }),
      prisma.weeklyAvailabilityOverride.deleteMany({
        where: { userId: resolvedUserId },
      }),
      prisma.occupancy.deleteMany({ where: { userId: resolvedUserId } }),
    ]);

    const updated = await prisma.user.updateMany({
      where: { userId: resolvedUserId },
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
    const resolvedUserId = await resolveCanonicalUserId(userId);
    if (!resolvedUserId) {
      throw new UserServiceError("User not found.", 404);
    }
    const firstName = requireString(payload.firstName, "First name");
    const lastName = requireString(payload.lastName, "Last name");

    const user = await prisma.user.findFirst({
      where: { userId: resolvedUserId },
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

    // Sync the display name to the auth provider through the neutral
    // boundary; a no-op when no provider is configured (the database stays
    // the source of truth for names).
    const authService = getAuthService();
    if (authService) {
      await authService.updateUserName(resolvedUserId, { firstName, lastName });
    }

    const updatedUser = await prisma.user.update({
      where: { userId: resolvedUserId },
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

export { resolveCanonicalUserId };
export type { UserDomain as User };
