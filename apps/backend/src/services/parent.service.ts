import { FilterQuery, Types } from "mongoose";
import {
  type ParentDocument,
  type ParentMongo,
  ParentModel,
} from "../models/parent";

import {
  fromParentRequestDTO,
  toParentResponseDTO,
  type ParentRequestDTO,
  type Parent,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { AuthUserMobileService } from "./authUserMobile.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import logger from "src/utils/logger";
import escapeStringRegexp from "escape-string-regexp";
import { ParentCreatedFrom } from "@prisma/client";

export class ParentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ParentServiceError";
  }
}

const OFFSET_TIMEZONE_REGEX = /^(?:UTC)?[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/;

const isValidTimezone = (value: string): boolean => {
  if (value === "UTC") {
    return true;
  }

  if (OFFSET_TIMEZONE_REGEX.test(value)) {
    return true;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const validateTimezone = (value: string, field: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ParentServiceError(`${field} cannot be empty.`, 400);
  }

  if (!isValidTimezone(trimmed)) {
    throw new ParentServiceError(
      `${field} must be a valid IANA timezone or UTC offset.`,
      400,
    );
  }

  return trimmed;
};

/* ------------------------------ Helpers ------------------------------ */

const ensureMongoId = (id: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ParentServiceError("Invalid identifier.", 400);
  }
  return new Types.ObjectId(id);
};

/** Convert Mongo → Domain → FHIR DTO */
export const toFHIR = (doc: ParentDocument) => {
  const json = doc.toObject();

  const parent: Parent = {
    id: json._id.toString(),
    firstName: json.firstName,
    lastName: json.lastName,
    birthDate: json.birthDate ?? undefined,
    email: json.email,
    phoneNumber: json.phoneNumber,
    currency: json.currency,
    timezone: json.timezone,
    profileImageUrl: json.profileImageUrl,
    isProfileComplete: json.isProfileComplete ?? false,
    linkedUserId: json.linkedUserId?.toString() ?? null,
    createdFrom: json.createdFrom,
    address: json.address ?? undefined,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };

  return toParentResponseDTO(parent);
};

const computeProfileCompletion = (p: ParentMongo | ParentDocument) => {
  return Boolean(
    p.firstName &&
    p.lastName &&
    p.email &&
    p.phoneNumber &&
    p.birthDate &&
    p.address,
  );
};

const toPrismaParentData = (doc: ParentDocument) => {
  const obj = doc.toObject() as ParentMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    firstName: obj.firstName,
    lastName: obj.lastName ?? undefined,
    birthDate: obj.birthDate ?? undefined,
    email: obj.email,
    phoneNumber: obj.phoneNumber ?? undefined,
    currency: obj.currency ?? undefined,
    timezone: obj.timezone ?? undefined,
    profileImageUrl: obj.profileImageUrl ?? undefined,
    isProfileComplete: obj.isProfileComplete ?? false,
    linkedUserId: obj.linkedUserId ? obj.linkedUserId.toString() : undefined,
    createdFrom: obj.createdFrom as ParentCreatedFrom,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncParentAddressToPostgres = async (
  parentId: string,
  address: ParentMongo["address"] | undefined,
) => {
  if (!shouldDualWrite) return;

  if (!address) {
    try {
      await prisma.parentAddress.deleteMany({ where: { parentId } });
    } catch (err) {
      handleDualWriteError("ParentAddress delete", err);
    }
    return;
  }

  try {
    await prisma.parentAddress.upsert({
      where: { parentId },
      create: {
        parentId,
        addressLine: address.addressLine ?? undefined,
        country: address.country ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.postalCode ?? undefined,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      },
      update: {
        addressLine: address.addressLine ?? undefined,
        country: address.country ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.postalCode ?? undefined,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("ParentAddress", err);
  }
};

const syncParentToPostgres = async (doc: ParentDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaParentData(doc);
    await prisma.parent.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    const obj = doc.toObject() as ParentMongo & { _id: Types.ObjectId };
    await syncParentAddressToPostgres(data.id, obj.address);
  } catch (err) {
    handleDualWriteError("Parent", err);
  }
};

/** Convert FHIR DTO → persistable Mongo object */
const toPersistable = (dto: ParentRequestDTO): ParentMongo => {
  const parent = fromParentRequestDTO(dto);

  if (!parent.email) {
    throw new ParentServiceError("Parent email is required.", 400);
  }

  if (parent.timezone) {
    parent.timezone = validateTimezone(parent.timezone, "Timezone");
  }

  return {
    firstName: parent.firstName,
    lastName: parent.lastName,
    birthDate: parent.birthDate,
    email: parent.email.toLowerCase(),
    phoneNumber: parent.phoneNumber,
    currency: parent.currency,
    timezone: parent.timezone,
    profileImageUrl: parent.profileImageUrl,
    createdFrom: parent.createdFrom,
    linkedUserId: parent.linkedUserId
      ? new Types.ObjectId(parent.linkedUserId)
      : null,
    address: parent.address,
  };
};

/* ------------------------------ Context Types ------------------------------ */

export type ParentCreateContext = {
  source: "mobile" | "pms" | "invited";
  authUserId?: string; // only mobile has this
};

/* ---------------------------- Main Service ---------------------------- */

export const ParentService = {
  /* -------------------------- CREATE -------------------------- */
  async create(dto: ParentRequestDTO, ctx: ParentCreateContext) {
    const persistable = toPersistable(dto);
    // Override createdFrom based on who is creating this Parent
    persistable.createdFrom = ctx.source;

    // Only MOBILE parents have AuthUser → linkedUserId is required
    if (ctx.source === "mobile") {
      if (!ctx.authUserId) {
        throw new ParentServiceError("Authenticated user ID required.", 401);
      }
      persistable.linkedUserId =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          ctx.authUserId,
        );
    }

    // PMS or invited parent → no linkedUserId
    if (ctx.source !== "mobile") {
      persistable.linkedUserId = null;
    }

    // Prevent duplicate parent for this AuthUser
    if (persistable.linkedUserId) {
      const exists = await ParentModel.findOne({
        linkedUserId: persistable.linkedUserId,
      });
      if (exists) {
        throw new ParentServiceError(
          "Parent already exists for this user.",
          409,
        );
      }
    }

    const doc = await ParentModel.create(persistable);

    // Calculate profile completion
    doc.isProfileComplete = computeProfileCompletion(doc);

    // Move Image to permenant location
    if (persistable.profileImageUrl) {
      try {
        const finalKey = buildS3Key("parent", doc._id.toString(), "image/jpg");
        const profileUrl = await moveFile(
          persistable.profileImageUrl,
          finalKey,
        );
        doc.profileImageUrl = profileUrl;
      } catch (error) {
        logger.warn("Invalid key has been sent", error);
      }
    }

    await doc.save();

    await syncParentToPostgres(doc);

    const parentId = doc._id.toString();

    if (ctx.source === "mobile" && ctx.authUserId) {
      await AuthUserMobileService.linkParent(ctx.authUserId, parentId);
    }
    return {
      response: toFHIR(doc),
      isProfileComplete: doc.isProfileComplete ?? false,
    };
  },

  /* -------------------------- GET -------------------------- */
  async get(id: string, ctx?: ParentCreateContext) {
    const mongoId = ensureMongoId(id);

    const query: FilterQuery<ParentMongo> = { _id: mongoId };

    // Mobile user may only access their own parent record
    if (ctx?.source === "mobile" && ctx?.authUserId) {
      query.linkedUserId =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          ctx.authUserId,
        );
    }

    const doc = await ParentModel.findOne(query);
    if (!doc) return null;

    return {
      response: toFHIR(doc),
      isProfileComplete: doc.isProfileComplete ?? false,
    };
  },

  /* -------------------------- UPDATE -------------------------- */
  async update(id: string, dto: ParentRequestDTO, ctx?: ParentCreateContext) {
    const mongoId = ensureMongoId(id);
    const persistable = toPersistable(dto);

    const query: FilterQuery<ParentMongo> = { _id: mongoId };

    let linkedUserId: Types.ObjectId | null | undefined =
      persistable.linkedUserId;

    if (ctx?.source === "mobile" && ctx.authUserId) {
      linkedUserId =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          ctx.authUserId,
        );
      query.linkedUserId = linkedUserId ?? undefined;
    }

    persistable.linkedUserId = linkedUserId ?? null;

    const doc = await ParentModel.findOneAndUpdate(
      query,
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!doc) return null;

    // Always recalc profile completion after any update
    doc.isProfileComplete = computeProfileCompletion(doc);
    await doc.save();

    await syncParentToPostgres(doc);

    return {
      response: toFHIR(doc),
      isProfileComplete: doc.isProfileComplete ?? false,
    };
  },

  /* -------------------------- DELETE -------------------------- */
  async delete(id: string, ctx: ParentCreateContext) {
    const mongoId = ensureMongoId(id);

    const query: FilterQuery<ParentMongo> = { _id: mongoId };

    if (ctx.source === "mobile") {
      if (!ctx.authUserId) {
        throw new ParentServiceError("Authenticated user ID required.", 401);
      }
      query.linkedUserId =
        await AuthUserMobileService.getAuthUserMobileIdByProviderId(
          ctx.authUserId,
        );
    }

    const doc = await ParentModel.findOneAndDelete(query);
    if (!doc) return null;

    if (shouldDualWrite) {
      try {
        await prisma.parent.deleteMany({ where: { id: doc._id.toString() } });
        await prisma.parentAddress.deleteMany({
          where: { parentId: doc._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("Parent delete", err);
      }
    }

    return toFHIR(doc);
  },

  /* -------------------- Helpers -------------------- */
  async findByLinkedUserId(authUserId: string) {
    if (!authUserId) {
      throw new ParentServiceError("Invalid AuthUser ID.", 400);
    }
    const authUserMobileId =
      await AuthUserMobileService.getAuthUserMobileIdByProviderId(authUserId);
    return ParentModel.findOne({
      linkedUserId: new Types.ObjectId(authUserMobileId?.toString()),
    });
  },

  async findByMongoId(id: string) {
    const mongoId = ensureMongoId(id);
    return ParentModel.findById(mongoId);
  },

  async getByName(name: string) {
    if (!name || typeof name !== "string") {
      throw new ParentServiceError("Name is required for searching.", 400);
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new ParentServiceError("Name is required for searching.", 400);
    }

    const safe = escapeStringRegexp(name.trim());
    const searchRegex = new RegExp(safe);

    const documents = await ParentModel.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ],
    });

    return {
      responses: documents.map((element) => toFHIR(element)),
    };
  },
};
