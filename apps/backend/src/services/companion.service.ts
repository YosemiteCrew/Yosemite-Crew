import { Types } from "mongoose";
import CompanionModel, {
  type CompanionDocument,
  type CompanionMongo,
} from "../models/companion";

import {
  fromCompanionRequestDTO,
  toCompanionResponseDTO,
  type CompanionRequestDTO,
  type Companion,
  type CompanionType,
  type Gender,
  type RecordStatus,
  type SourceType,
} from "@yosemite-crew/types";
import {
  Prisma,
  CompanionType as PrismaCompanionType,
  Gender as PrismaGender,
  SourceType as PrismaSourceType,
  RecordStatus as PrismaRecordStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "./parent-companion.service";
import { ParentService } from "./parent.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import escapeStringRegexp from "escape-string-regexp";
import CompanionOrganisationModel from "src/models/companion-organisation";
import logger from "src/utils/logger";
import { TaskLibraryService } from "./taskLibrary.service";
import { CreateFromLibraryInput, TaskService } from "./task.service";
import CodeEntryModel from "src/models/code-entry";

export class CompanionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionServiceError";
  }
}

/**
 * FHIR DTO → persistable Mongo object
 */
const toPersistable = (payload: CompanionRequestDTO): CompanionMongo => {
  const companion = fromCompanionRequestDTO(payload);

  return {
    name: companion.name,
    type: companion.type,
    breed: companion.breed ?? "",
    speciesCode: companion.speciesCode,
    breedCode: companion.breedCode,
    dateOfBirth: companion.dateOfBirth,
    gender: companion.gender,
    photoUrl: companion.photoUrl,
    currentWeight: companion.currentWeight,
    colour: companion.colour,
    allergy: companion.allergy,
    bloodGroup: companion.bloodGroup,
    isNeutered: companion.isneutered,
    ageWhenNeutered: companion.ageWhenNeutered,
    microchipNumber: companion.microchipNumber,
    passportNumber: companion.passportNumber,
    isInsured: companion.isInsured ?? false,
    insurance: companion.insurance ?? null,
    countryOfOrigin: companion.countryOfOrigin,
    source: companion.source,
    status: companion.status,
    physicalAttribute: companion.physicalAttribute,
    breedingInfo: companion.breedingInfo,
    medicalRecords: companion.medicalRecords,
    // isProfileComplete is set in service logic below
  };
};

const shouldDualWriteCompanions = process.env.DUAL_WRITE_ENABLED === "true";

const toPrismaCompanionData = (doc: CompanionDocument) => {
  const plain = doc.toObject() as CompanionMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: plain._id.toString(),
    name: plain.name,
    type: plain.type as PrismaCompanionType,
    breed: plain.breed ?? "",
    speciesCode: plain.speciesCode ?? undefined,
    breedCode: plain.breedCode ?? undefined,
    dateOfBirth: plain.dateOfBirth,
    gender: plain.gender as PrismaGender,
    photoUrl: plain.photoUrl ?? undefined,
    currentWeight: plain.currentWeight ?? undefined,
    colour: plain.colour ?? undefined,
    allergy: plain.allergy ?? undefined,
    bloodGroup: plain.bloodGroup ?? undefined,
    isNeutered: plain.isNeutered ?? undefined,
    ageWhenNeutered: plain.ageWhenNeutered ?? undefined,
    microchipNumber: plain.microchipNumber ?? undefined,
    passportNumber: plain.passportNumber ?? undefined,
    isInsured: plain.isInsured ?? false,
    insurance: (plain.insurance ??
      undefined) as unknown as Prisma.InputJsonValue,
    countryOfOrigin: plain.countryOfOrigin ?? undefined,
    source: plain.source as PrismaSourceType,
    status: plain.status as PrismaRecordStatus,
    physicalAttribute: (plain.physicalAttribute ??
      undefined) as unknown as Prisma.InputJsonValue,
    breedingInfo: (plain.breedingInfo ??
      undefined) as unknown as Prisma.InputJsonValue,
    medicalRecords: (plain.medicalRecords ??
      undefined) as unknown as Prisma.InputJsonValue,
    isProfileComplete: plain.isProfileComplete ?? false,
    createdAt: plain.createdAt ?? undefined,
    updatedAt: plain.updatedAt ?? undefined,
  };
};

const syncCompanionToPostgres = async (doc: CompanionDocument) => {
  if (!shouldDualWriteCompanions) return;
  try {
    const data = toPrismaCompanionData(doc);
    await prisma.companion.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    logger.error(`Companion dual-write failed: ${String(err)}`);
    if (process.env.DUAL_WRITE_STRICT === "true") {
      throw err;
    }
  }
};

/**
 * Mongo → Companion → FHIR DTO
 */
export const toFHIR = (doc: CompanionDocument) => {
  const plain = doc.toObject() as CompanionMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  const companion: Companion = {
    id: plain._id.toString(),
    name: plain.name,
    type: plain.type as CompanionType,
    breed: plain.breed ?? "",
    speciesCode: plain.speciesCode,
    breedCode: plain.breedCode,
    dateOfBirth: plain.dateOfBirth,
    gender: plain.gender as Gender,
    photoUrl: plain.photoUrl,
    currentWeight: plain.currentWeight,
    colour: plain.colour,
    allergy: plain.allergy,
    bloodGroup: plain.bloodGroup,
    isneutered: plain.isNeutered,
    ageWhenNeutered: plain.ageWhenNeutered,
    microchipNumber: plain.microchipNumber,
    passportNumber: plain.passportNumber,
    isInsured: plain.isInsured ?? false,
    insurance: plain.insurance ?? undefined,
    countryOfOrigin: plain.countryOfOrigin,
    source: plain.source as SourceType | undefined,
    status: plain.status as RecordStatus | undefined,
    physicalAttribute: plain.physicalAttribute,
    breedingInfo: plain.breedingInfo,
    medicalRecords: plain.medicalRecords,
    isProfileComplete: plain.isProfileComplete,
    createdAt: plain.createdAt!,
    updatedAt: plain.updatedAt!,
  };

  return toCompanionResponseDTO(companion);
};

export const toFHIRFromPrisma = (doc: {
  id: string;
  name: string;
  type: PrismaCompanionType;
  breed: string;
  dateOfBirth: Date;
  gender: PrismaGender;
  photoUrl: string | null;
  currentWeight: number | null;
  colour: string | null;
  allergy: string | null;
  bloodGroup: string | null;
  isNeutered: boolean | null;
  ageWhenNeutered: string | null;
  microchipNumber: string | null;
  passportNumber: string | null;
  isInsured: boolean;
  insurance: Prisma.JsonValue | null;
  countryOfOrigin: string | null;
  source: PrismaSourceType | null;
  status: PrismaRecordStatus | null;
  physicalAttribute: Prisma.JsonValue | null;
  breedingInfo: Prisma.JsonValue | null;
  medicalRecords: Prisma.JsonValue | null;
  isProfileComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const companion: Companion = {
    id: doc.id,
    name: doc.name,
    type: doc.type as CompanionType,
    breed: doc.breed ?? "",
    dateOfBirth: doc.dateOfBirth,
    gender: doc.gender as Gender,
    photoUrl: doc.photoUrl ?? undefined,
    currentWeight: doc.currentWeight ?? undefined,
    colour: doc.colour ?? undefined,
    allergy: doc.allergy ?? undefined,
    bloodGroup: doc.bloodGroup ?? undefined,
    isneutered: doc.isNeutered ?? undefined,
    ageWhenNeutered: doc.ageWhenNeutered ?? undefined,
    microchipNumber: doc.microchipNumber ?? undefined,
    passportNumber: doc.passportNumber ?? undefined,
    isInsured: doc.isInsured ?? false,
    insurance: doc.insurance as unknown as Companion["insurance"],
    countryOfOrigin: doc.countryOfOrigin ?? undefined,
    source: doc.source as SourceType | undefined,
    status: doc.status as RecordStatus | undefined,
    physicalAttribute:
      doc.physicalAttribute as unknown as Companion["physicalAttribute"],
    breedingInfo: doc.breedingInfo as unknown as Companion["breedingInfo"],
    medicalRecords:
      doc.medicalRecords as unknown as Companion["medicalRecords"],
    isProfileComplete: doc.isProfileComplete ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  return toCompanionResponseDTO(companion);
};

/**
 * Required fields for profile completion
 */
const REQUIRED_PROFILE_FIELDS: (keyof CompanionMongo)[] = [
  "name",
  "type",
  "breed",
  "dateOfBirth",
  "gender",
  "status",
];

/**
 * Backend-only logic for determining if profile is complete
 */
const computeIsProfileComplete = (
  companion: Partial<CompanionMongo>,
): boolean => {
  return REQUIRED_PROFILE_FIELDS.every((field) => {
    const value = companion[field];
    return value !== undefined && value !== null && value !== "";
  });
};

const ensureCodeExists = async (code: string, type: "SPECIES" | "BREED") => {
  const entry = await CodeEntryModel.findOne(
    {
      system: "YOSEMITECODE",
      code,
      type,
      active: true,
    },
    { _id: 1 },
  ).lean();

  if (!entry) {
    logger.warn(`Invalid ${type} code provided: ${code}`);
    throw new CompanionServiceError(`Invalid ${type.toLowerCase()} code.`, 400);
  }
};

const validateCompanionCodes = async (companion: Partial<CompanionMongo>) => {
  if (companion.speciesCode) {
    await ensureCodeExists(companion.speciesCode, "SPECIES");
  }
  if (companion.breedCode) {
    await ensureCodeExists(companion.breedCode, "BREED");
  }
};

const resolveParentMongoId = (parent: {
  _id?: Types.ObjectId;
  id?: string;
}): Types.ObjectId => {
  if (parent._id) return parent._id;
  if (parent.id && Types.ObjectId.isValid(parent.id)) {
    return new Types.ObjectId(parent.id);
  }
  throw new CompanionServiceError("Parent identifier is invalid.", 400);
};

type CompanionCreateContext = {
  authUserId?: string;
  parentMongoId?: Types.ObjectId;
};

const createDefaultTasks = async (input: {
  organisationId?: string;
  companionId: string;
  parentId: string;
  species: string;
}) => {
  try {
    const libraryTasks = await TaskLibraryService.listForSpecies({
      species: input.species,
    });

    if (!libraryTasks.length) return;

    const now = new Date();

    for (const lib of libraryTasks) {
      // 2️⃣ Build recurrence from library definition
      let recurrence: CreateFromLibraryInput["recurrence"] | undefined;

      const libRecurrence = lib.schema.recurrence?.default;
      if (libRecurrence) {
        recurrence = {
          type: libRecurrence.type,
          cronExpression: libRecurrence.cronExpression,
          endDate: libRecurrence.endAfterDays
            ? new Date(
                now.getTime() +
                  libRecurrence.endAfterDays * 24 * 60 * 60 * 1000,
              )
            : undefined,
        };
      }

      // 3️⃣ Create task using EXISTING METHOD
      await TaskService.createFromLibrary({
        organisationId: input.organisationId,
        companionId: input.companionId,
        createdBy: input.parentId,
        assignedTo: input.parentId,
        audience: "PARENT_TASK",
        libraryTaskId: lib._id.toString(),
        dueAt: now,
        recurrence,
      });
    }
  } catch (error) {
    logger.error(
      "Error creating default tasks for companion type:",
      input.species,
      error,
    );
  }
};

export const CompanionService = {
  async create(payload: CompanionRequestDTO, context?: CompanionCreateContext) {
    if (!context) {
      throw new CompanionServiceError(
        "Parent context is required to create a companion.",
        400,
      );
    }

    let parentMongoId: Types.ObjectId | null = null;

    // Mobile flow → use linkedUserId to get parent
    if (context.authUserId) {
      const parent = await ParentService.findByLinkedUserId(context.authUserId);

      if (!parent) {
        throw new CompanionServiceError(
          "Parent record not found for authenticated user.",
          403,
        );
      }
      parentMongoId = resolveParentMongoId(parent);
    }

    // PMS flow → provided directly by PMS backend
    if (!parentMongoId && context.parentMongoId) {
      parentMongoId = context.parentMongoId;
    }

    // If still missing → invalid request
    if (!parentMongoId) {
      throw new CompanionServiceError(
        "Unable to determine parent for companion creation.",
        400,
      );
    }
    const persistable = toPersistable(payload);
    await validateCompanionCodes(persistable);
    persistable.isProfileComplete = computeIsProfileComplete(persistable);

    let document: CompanionDocument | null = null;

    try {
      document = await CompanionModel.create(persistable);

      await ParentCompanionService.linkParent({
        parentId: parentMongoId,
        companionId: document._id,
        role: "PRIMARY",
      });

      if (persistable.photoUrl) {
        const finalKey = buildS3Key(
          "companion",
          document._id.toString(),
          "image/jpg",
        );
        const profileUrl = await moveFile(persistable.photoUrl, finalKey);
        document.photoUrl = profileUrl;
        await document.save();
      }
      await syncCompanionToPostgres(document);
      // Create default tasks based on companion type
      void createDefaultTasks({
        organisationId: context.parentMongoId?.toString(),
        companionId: document._id.toString(),
        parentId: parentMongoId.toString(),
        species: persistable.type,
      });

      return { response: toFHIR(document) };
    } catch (error) {
      // rollback if linking fails
      if (document) {
        await CompanionModel.deleteOne({ _id: document._id });
      }

      if (error instanceof ParentCompanionServiceError) {
        throw new CompanionServiceError(error.message, error.statusCode);
      }

      throw error;
    }
  },

  async listByParent(parentId: string) {
    if (isReadFromPostgres()) {
      const links = await prisma.parentCompanion.findMany({
        where: { parentId, status: { in: ["ACTIVE", "PENDING"] } },
        select: { companionId: true },
      });
      const ids = links.map((link) => link.companionId);
      if (!ids.length) return { responses: [] };
      const docs = await prisma.companion.findMany({
        where: { id: { in: ids } },
      });
      return { responses: docs.map(toFHIRFromPrisma) };
    }

    if (!Types.ObjectId.isValid(parentId))
      throw new CompanionServiceError("Invalid Parent Document Id", 400);

    const parentDocId = new Types.ObjectId(parentId);

    const companionIds =
      await ParentCompanionService.getActiveCompanionIdsForParent(parentDocId);

    if (!companionIds.length) return { responses: [] };

    const documents = await CompanionModel.find({ _id: { $in: companionIds } });

    return { responses: documents.map(toFHIR) };
  },

  async listByParentNotInOrganisation(
    parentId: string,
    organisationId: string,
  ) {
    if (isReadFromPostgres()) {
      const parentLinks = await prisma.parentCompanion.findMany({
        where: { parentId, status: { in: ["ACTIVE", "PENDING"] } },
        select: { companionId: true },
      });
      const companionIds = parentLinks.map((link) => link.companionId);
      if (!companionIds.length) return { responses: [] };

      const linked = await prisma.companionOrganisation.findMany({
        where: {
          organisationId,
          companionId: { in: companionIds },
        },
        select: { companionId: true },
      });
      const linkedIds = new Set(linked.map((entry) => entry.companionId));
      const unlinkedIds = companionIds.filter((id) => !linkedIds.has(id));
      if (!unlinkedIds.length) return { responses: [] };

      const documents = await prisma.companion.findMany({
        where: { id: { in: unlinkedIds } },
      });
      return { responses: documents.map(toFHIRFromPrisma) };
    }

    if (!Types.ObjectId.isValid(parentId)) {
      throw new CompanionServiceError("Invalid Parent Document Id", 400);
    }

    if (!Types.ObjectId.isValid(organisationId)) {
      throw new CompanionServiceError("Invalid Organisation Document Id", 400);
    }

    const parentDocId = new Types.ObjectId(parentId);
    const organisationDocId = new Types.ObjectId(organisationId);

    // 1️⃣ Get all active companions for parent
    const parentCompanionIds =
      await ParentCompanionService.getActiveCompanionIdsForParent(parentDocId);

    if (!parentCompanionIds.length) {
      return { responses: [] };
    }

    // 2️⃣ Get companion IDs already linked to this organisation
    const linkedCompanions = await CompanionOrganisationModel.find(
      {
        organisationId: organisationDocId,
        companionId: { $in: parentCompanionIds },
      },
      { companionId: 1 },
    ).lean();

    const linkedCompanionIdSet = new Set(
      linkedCompanions.map((c) => c.companionId.toString()),
    );

    // 3️⃣ Filter out linked companions
    const unlinkedCompanionIds = parentCompanionIds.filter(
      (id) => !linkedCompanionIdSet.has(id.toString()),
    );

    if (!unlinkedCompanionIds.length) {
      return { responses: [] };
    }

    // 4️⃣ Fetch companion documents
    if (isReadFromPostgres()) {
      const ids = unlinkedCompanionIds.map((id) => id.toString());
      const documents = await prisma.companion.findMany({
        where: { id: { in: ids } },
      });
      return { responses: documents.map(toFHIRFromPrisma) };
    }

    const documents = await CompanionModel.find({
      _id: { $in: unlinkedCompanionIds },
    });

    return { responses: documents.map(toFHIR) };
  },

  async getById(id: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.companion.findUnique({ where: { id } });
      if (!doc) return null;
      return { response: toFHIRFromPrisma(doc) };
    }

    if (!Types.ObjectId.isValid(id)) return null;

    const document = await CompanionModel.findById(id);

    if (!document) return null;

    await syncCompanionToPostgres(document);

    return { response: toFHIR(document) };
  },

  async getByName(name: string) {
    if (!name || typeof name !== "string") {
      throw new CompanionServiceError("Name is required for searching.", 400);
    }

    const safe = escapeStringRegexp(name.trim());
    const searchRegex = new RegExp(safe);

    if (isReadFromPostgres()) {
      const documents = await prisma.companion.findMany({
        where: { name: { contains: name.trim(), mode: "insensitive" } },
      });
      return { responses: documents.map(toFHIRFromPrisma) };
    }

    const documents = await CompanionModel.find({
      name: searchRegex,
    });

    return { responses: documents.map(toFHIR) };
  },

  /**
   * UPDATE companion (partial FHIR update)
   */
  async update(id: string, payload: CompanionRequestDTO) {
    const persistable = toPersistable(payload);
    await validateCompanionCodes(persistable);

    // Backend-only recomputation
    persistable.isProfileComplete = computeIsProfileComplete(persistable);

    if (isReadFromPostgres()) {
      const doc = await prisma.companion.update({
        where: { id },
        data: {
          name: persistable.name,
          type: persistable.type as PrismaCompanionType,
          breed: persistable.breed ?? "",
          speciesCode: persistable.speciesCode ?? undefined,
          breedCode: persistable.breedCode ?? undefined,
          dateOfBirth: persistable.dateOfBirth,
          gender: persistable.gender as PrismaGender,
          photoUrl: persistable.photoUrl ?? undefined,
          currentWeight: persistable.currentWeight ?? undefined,
          colour: persistable.colour ?? undefined,
          allergy: persistable.allergy ?? undefined,
          bloodGroup: persistable.bloodGroup ?? undefined,
          isNeutered: persistable.isNeutered ?? undefined,
          ageWhenNeutered: persistable.ageWhenNeutered ?? undefined,
          microchipNumber: persistable.microchipNumber ?? undefined,
          passportNumber: persistable.passportNumber ?? undefined,
          isInsured: persistable.isInsured ?? false,
          insurance: (persistable.insurance ??
            undefined) as unknown as Prisma.InputJsonValue,
          countryOfOrigin: persistable.countryOfOrigin ?? undefined,
          source: persistable.source as PrismaSourceType,
          status: persistable.status as PrismaRecordStatus,
          physicalAttribute: (persistable.physicalAttribute ??
            undefined) as unknown as Prisma.InputJsonValue,
          breedingInfo: (persistable.breedingInfo ??
            undefined) as unknown as Prisma.InputJsonValue,
          medicalRecords: (persistable.medicalRecords ??
            undefined) as unknown as Prisma.InputJsonValue,
          isProfileComplete: persistable.isProfileComplete ?? false,
        },
      });

      return { response: toFHIRFromPrisma(doc) };
    }

    if (!Types.ObjectId.isValid(id)) return null;

    const document = await CompanionModel.findByIdAndUpdate(
      id,
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!document) return null;

    await syncCompanionToPostgres(document);

    return { response: toFHIR(document) };
  },

  /**
   * DELETE companion
   */
  async delete(id: string, context?: CompanionCreateContext) {
    // MUST come from mobile → require authUserId
    if (!context?.authUserId) {
      throw new CompanionServiceError(
        "Authenticated user is required to delete a companion.",
        401,
      );
    }

    // Resolve parent from authUserId
    const parent = await ParentService.findByLinkedUserId(context.authUserId);
    if (!parent) {
      throw new CompanionServiceError(
        "Parent record not found for authenticated user.",
        403,
      );
    }

    if (isReadFromPostgres()) {
      const parentId =
        "id" in parent && typeof parent.id === "string" ? parent.id : undefined;
      if (!parentId) {
        throw new CompanionServiceError("Parent identifier is invalid.", 400);
      }
      const link = await prisma.parentCompanion.findFirst({
        where: {
          parentId,
          companionId: id,
          role: "PRIMARY",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!link) {
        throw new CompanionServiceError(
          "You are not authorized to modify this companion.",
          403,
        );
      }

      await prisma.parentCompanion.deleteMany({
        where: { companionId: id },
      });
      await prisma.companion.deleteMany({ where: { id } });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new CompanionServiceError("Invalid companion identifier.", 400);
    }

    const parentMongoId = resolveParentMongoId(parent);

    try {
      const document = await CompanionModel.findById(id);
      if (!document) {
        throw new CompanionServiceError("Companion not found.", 404);
      }

      // Ensure parent has permission
      await ParentCompanionService.ensurePrimaryOwnership(
        parentMongoId,
        document._id,
      );

      // Remove links
      await ParentCompanionService.deleteLinksForCompanion(document._id);

      // Remove resource
      await CompanionModel.deleteOne({ _id: document._id });

      if (shouldDualWriteCompanions) {
        try {
          await prisma.companion.deleteMany({ where: { id } });
        } catch (err) {
          logger.error(`Companion dual-write delete failed: ${String(err)}`);
          if (process.env.DUAL_WRITE_STRICT === "true") {
            throw err;
          }
        }
      }
    } catch (error) {
      if (error instanceof ParentCompanionServiceError) {
        throw new CompanionServiceError(error.message, error.statusCode);
      }
      throw error;
    }
  },
};
