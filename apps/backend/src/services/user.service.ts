import validator from "validator";
import UserModel, { type UserDocument, type UserMongo } from "../models/user";
import UserOrganizationModel from "../models/user-organization";
import UserProfileModel from "../models/user-profile";
import BaseAvailabilityModel from "../models/base-availability";
import WeeklyAvailabilityOverrideModel from "../models/weekly-availablity-override";
import { OccupancyModel } from "../models/occupancy";
import { UserOrganizationService } from "./user-organization.service";
import { User } from "@yosemite-crew/types";
import { CognitoService } from "./cognito.service";
import { OrganizationService } from "./organization.service";

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
    throw new UserServiceError(
      "Invalid organization reference format.",
      400,
    );
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

const sanitizeUserAttributes = (payload: User): UserMongo => {
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

const toUserDomain = (document: UserDocument): UserDomain => {
  const { userId, email, firstName, lastName, isActive } = document;

  return {
    id: userId,
    firstName,
    lastName,
    email,
    isActive,
  };
};

export const UserService = {
  async create(payload: User): Promise<UserDomain> {
    const attributes = sanitizeUserAttributes(payload);

    const existingById = await UserModel.findOne(
      { userId: attributes.userId },
      null,
      { sanitizeFilter: true },
    );

    if (existingById) {
      throw new UserServiceError(
        "User with the same id or email already exists.",
        409,
      );
    }

    const existingByEmail = await UserModel.findOne(
      { email: attributes.email },
      null,
      { sanitizeFilter: true },
    );

    if (existingByEmail) {
      throw new UserServiceError(
        "User with the same id or email already exists.",
        409,
      );
    }

    const document = await UserModel.create({
      userId: attributes.userId,
      email: attributes.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      isActive: attributes.isActive,
    });

    return toUserDomain(document);
  },

  async getById(id: unknown): Promise<UserDomain | null> {
    const userId = requireSafeIdentifier(id, "User id");

    const document = await UserModel.findOne({ userId }, null, {
      sanitizeFilter: true,
    });

    if (!document) {
      return null;
    }

    return toUserDomain(document);
  },

  async deleteById(id: unknown): Promise<boolean> {
    const userId = requireSafeIdentifier(id, "User id");

    const existing = await UserModel.findOne({ userId }, null, {
      sanitizeFilter: true,
    }).lean();

    if (!existing) {
      return false;
    }

    const mappings = await UserOrganizationModel.find(
      {
        $or: [
          { practitionerReference: userId },
          { practitionerReference: `Practitioner/${userId}` },
        ],
      },
      { roleCode: 1, organizationReference: 1 },
      { sanitizeFilter: true },
    ).lean();

    const ownerOrganizationIds = new Set<string>();

    for (const mapping of mappings) {
      if (mapping.roleCode?.toUpperCase() === "OWNER") {
        ownerOrganizationIds.add(
          extractOrganizationIdentifier(mapping.organizationReference),
        );
      }
    }

    for (const mapping of mappings) {
      await UserOrganizationService.deleteById(mapping._id.toString());
    }

    await Promise.all([
      UserProfileModel.deleteMany({ userId }).setOptions({
        sanitizeFilter: true,
      }),
      BaseAvailabilityModel.deleteMany({ userId }).setOptions({
        sanitizeFilter: true,
      }),
      WeeklyAvailabilityOverrideModel.deleteMany({ userId }).setOptions({
        sanitizeFilter: true,
      }),
      OccupancyModel.deleteMany({ userId }).setOptions({
        sanitizeFilter: true,
      }),
    ]);

    const updated = await UserModel.findOneAndUpdate(
      { userId },
      { $set: { isActive: false } },
      { sanitizeFilter: true },
    );

    for (const organizationId of ownerOrganizationIds) {
      await OrganizationService.deleteById(organizationId);
    }

    return Boolean(updated);
  },

  async updateName(payload: {
    userId : string,
    firstName : string,
    lastName : string
  }): Promise<UserDomain> {
    const userId = requireSafeIdentifier(payload.userId, "User id");
    const firstName = requireString(payload.firstName, "First name");
    const lastName = requireString(payload.lastName, "Last name");

    const user = await UserModel.findOne({ userId }, null, {
      sanitizeFilter: true,
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

    user.firstName = firstName;
    user.lastName = lastName;

    await user.save();

    return toUserDomain(user);
  },
};

export type { UserDomain as User };
