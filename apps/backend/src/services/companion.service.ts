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
  Gender as PrismaGender,
  PatientType as PrismaPatientType,
  Prisma,
  RecordStatus as PrismaRecordStatus,
  SourceType as PrismaSourceType,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "./parent-companion.service";
import { ParentService } from "./parent.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import escapeStringRegexp from "escape-string-regexp";
import logger from "src/utils/logger";
import { TaskLibraryService } from "./taskLibrary.service";
import { CreateFromLibraryInput, TaskService } from "./task.service";

export class CompanionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionServiceError";
  }
}

type CompanionRecord = {
  id: string;
  name: string;
  type: PrismaPatientType;
  breed: string;
  speciesCode: string | null;
  breedCode: string | null;
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
  alerts?: Prisma.JsonValue | null;
  isProfileComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CompanionToFHIRSource = {
  toObject?: () => CompanionToFHIRSource;
  id?: string;
  _id?: { toString(): string };
  name?: string;
  type?: string;
  breed?: string;
  speciesCode?: string | null;
  breedCode?: string | null;
  dateOfBirth?: Date;
  gender?: string;
  photoUrl?: string | null;
  currentWeight?: number | null;
  colour?: string | null;
  allergy?: string | null;
  bloodGroup?: string | null;
  isNeutered?: boolean | null;
  ageWhenNeutered?: string | null;
  microchipNumber?: string | null;
  passportNumber?: string | null;
  isInsured?: boolean;
  insurance?: unknown;
  countryOfOrigin?: string | null;
  source?: string | null;
  status?: string | null;
  physicalAttribute?: unknown;
  breedingInfo?: unknown;
  medicalRecords?: unknown;
  alerts?: unknown;
  isProfileComplete?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type CompanionCreateContext = {
  authUserId?: string;
  parentId?: string;
  organisationId?: string;
};

type CompanionPersistable = Omit<
  Companion,
  | "insurance"
  | "physicalAttribute"
  | "breedingInfo"
  | "medicalRecords"
  | "alerts"
> & {
  insurance?: Prisma.JsonValue | null;
  physicalAttribute?: Prisma.JsonValue | null;
  breedingInfo?: Prisma.JsonValue | null;
  medicalRecords?: Prisma.JsonValue | null;
  alerts?: Prisma.JsonValue | null;
  isProfileComplete?: boolean;
};

const toPersistable = (payload: CompanionRequestDTO): CompanionPersistable => {
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
    isneutered: companion.isneutered,
    ageWhenNeutered: companion.ageWhenNeutered,
    microchipNumber: companion.microchipNumber,
    passportNumber: companion.passportNumber,
    isInsured: companion.isInsured ?? false,
    insurance: (companion.insurance ??
      null) as unknown as Prisma.JsonValue | null,
    countryOfOrigin: companion.countryOfOrigin,
    source: companion.source,
    status: companion.status,
    physicalAttribute:
      companion.physicalAttribute as unknown as Prisma.JsonValue | null,
    breedingInfo: companion.breedingInfo as unknown as Prisma.JsonValue | null,
    medicalRecords:
      companion.medicalRecords as unknown as Prisma.JsonValue | null,
    alerts: companion.alerts as unknown as Prisma.JsonValue | null,
  } as CompanionPersistable;
};

const REQUIRED_PROFILE_FIELDS = [
  "name",
  "type",
  "breed",
  "dateOfBirth",
  "gender",
  "status",
] as const;

const computeIsProfileComplete = (
  companion: Partial<Record<(typeof REQUIRED_PROFILE_FIELDS)[number], unknown>>,
): boolean =>
  REQUIRED_PROFILE_FIELDS.every((field) => {
    const value = companion[field];
    return value !== undefined && value !== null && value !== "";
  });

const ensureCodeExists = async (code: string, type: "SPECIES" | "BREED") => {
  const entry = await prisma.codeEntry.findFirst({
    where: {
      system: "YOSEMITECODE",
      code,
      type,
      active: true,
    },
    select: { id: true },
  });

  if (!entry) {
    logger.warn(`Invalid ${type} code provided: ${code}`);
    throw new CompanionServiceError(`Invalid ${type.toLowerCase()} code.`, 400);
  }
};

const validateCompanionCodes = async (
  companion: Partial<CompanionPersistable>,
) => {
  if (companion.speciesCode) {
    await ensureCodeExists(companion.speciesCode, "SPECIES");
  }
  if (companion.breedCode) {
    await ensureCodeExists(companion.breedCode, "BREED");
  }
};

const mapCompanion = (doc: CompanionRecord): Companion => ({
  id: doc.id,
  name: doc.name,
  type: doc.type as CompanionType,
  breed: doc.breed ?? "",
  speciesCode: doc.speciesCode ?? undefined,
  breedCode: doc.breedCode ?? undefined,
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
  medicalRecords: doc.medicalRecords as unknown as Companion["medicalRecords"],
  alerts: Array.isArray(doc.alerts)
    ? (doc.alerts as unknown as Companion["alerts"])
    : undefined,
  isProfileComplete: doc.isProfileComplete,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const toFHIR = (doc: CompanionToFHIRSource) =>
  toCompanionResponseDTO(
    mapCompanion({
      id: String(doc.id ?? doc._id?.toString() ?? ""),
      name: doc.name ?? "",
      type: (doc.type ?? "other") as PrismaPatientType,
      breed: doc.breed ?? "",
      speciesCode: doc.speciesCode ?? null,
      breedCode: doc.breedCode ?? null,
      dateOfBirth: doc.dateOfBirth ?? new Date(),
      gender: (doc.gender ?? "unknown") as PrismaGender,
      photoUrl: doc.photoUrl ?? null,
      currentWeight: doc.currentWeight ?? null,
      colour: doc.colour ?? null,
      allergy: doc.allergy ?? null,
      bloodGroup: doc.bloodGroup ?? null,
      isNeutered: doc.isNeutered ?? null,
      ageWhenNeutered: doc.ageWhenNeutered ?? null,
      microchipNumber: doc.microchipNumber ?? null,
      passportNumber: doc.passportNumber ?? null,
      isInsured: Boolean(doc.isInsured),
      insurance: doc.insurance ?? null,
      countryOfOrigin: doc.countryOfOrigin ?? null,
      source: (doc.source ?? null) as PrismaSourceType | null,
      status: (doc.status ?? null) as PrismaRecordStatus | null,
      physicalAttribute: doc.physicalAttribute ?? null,
      breedingInfo: doc.breedingInfo ?? null,
      medicalRecords: doc.medicalRecords ?? null,
      alerts: doc.alerts ?? null,
      isProfileComplete: Boolean(doc.isProfileComplete),
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
    }),
  );

export const toFHIRFromPrisma = (doc: CompanionRecord) =>
  toCompanionResponseDTO(mapCompanion(doc));

const createDefaultTasks = async (input: {
  organisationId?: string;
  patientId: string;
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
      let recurrence: CreateFromLibraryInput["recurrence"] | undefined;

      const schema = lib.schema as {
        recurrence?: {
          default?: {
            type?: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
            cronExpression?: string;
            endAfterDays?: number;
          };
        };
      } | null;
      const libRecurrence = schema?.recurrence?.default;
      if (libRecurrence?.type) {
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

      await TaskService.createFromLibrary({
        organisationId: input.organisationId,
        patientId: input.patientId,
        createdBy: input.parentId,
        assignedTo: input.parentId,
        audience: "PARENT_TASK",
        libraryTaskId: lib.id,
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

    let parentId = context.parentId ?? null;

    if (context.authUserId) {
      const parent = await ParentService.findByLinkedUserId(context.authUserId);
      if (!parent) {
        throw new CompanionServiceError(
          "Parent record not found for authenticated user.",
          403,
        );
      }
      parentId = parent.id ?? null;
    }

    if (!parentId) {
      throw new CompanionServiceError(
        "Unable to determine parent for companion creation.",
        400,
      );
    }

    const persistable = toPersistable(payload);
    await validateCompanionCodes(persistable);
    persistable.isProfileComplete = computeIsProfileComplete(persistable);

    const created = await prisma.patient.create({
      data: {
        name: persistable.name,
        type: persistable.type as PrismaPatientType,
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
        isNeutered: persistable.isneutered ?? undefined,
        ageWhenNeutered: persistable.ageWhenNeutered ?? undefined,
        microchipNumber: persistable.microchipNumber ?? undefined,
        passportNumber: persistable.passportNumber ?? undefined,
        isInsured: persistable.isInsured ?? false,
        insurance: persistable.insurance
          ? (persistable.insurance as unknown as Prisma.InputJsonValue)
          : undefined,
        countryOfOrigin: persistable.countryOfOrigin ?? undefined,
        source: persistable.source as PrismaSourceType,
        status: persistable.status as PrismaRecordStatus,
        physicalAttribute: persistable.physicalAttribute
          ? (persistable.physicalAttribute as unknown as Prisma.InputJsonValue)
          : undefined,
        breedingInfo: persistable.breedingInfo
          ? (persistable.breedingInfo as unknown as Prisma.InputJsonValue)
          : undefined,
        medicalRecords: persistable.medicalRecords
          ? (persistable.medicalRecords as unknown as Prisma.InputJsonValue)
          : undefined,
        alerts: persistable.alerts
          ? (persistable.alerts as unknown as Prisma.InputJsonValue)
          : undefined,
        isProfileComplete: persistable.isProfileComplete ?? false,
      },
    });

    try {
      await ParentCompanionService.linkParent({
        parentId,
        patientId: created.id,
        role: "PRIMARY",
      });
    } catch (error) {
      await prisma.patient.deleteMany({ where: { id: created.id } });
      if (error instanceof ParentCompanionServiceError) {
        throw new CompanionServiceError(error.message, error.statusCode);
      }
      throw error;
    }

    let updated = created;
    if (persistable.photoUrl) {
      try {
        const finalKey = buildS3Key("companion", created.id, "image/jpg");
        const profileUrl = await moveFile(persistable.photoUrl, finalKey);
        updated = await prisma.patient.update({
          where: { id: created.id },
          data: { photoUrl: profileUrl },
        });
      } catch (error) {
        logger.warn("Invalid key has been sent", error);
      }
    }

    void createDefaultTasks({
      organisationId: context.organisationId,
      patientId: created.id,
      parentId,
      species: persistable.type,
    });

    return { response: toFHIRFromPrisma(updated as CompanionRecord) };
  },

  async listByParent(parentId: string) {
    if (!parentId || typeof parentId !== "string") {
      throw new CompanionServiceError("Invalid Parent Document Id", 400);
    }

    const companionIds =
      await ParentCompanionService.getActiveCompanionIdsForParent(parentId);

    if (!companionIds.length) return { responses: [] };

    const documents = await prisma.patient.findMany({
      where: { id: { in: companionIds } },
    });

    return {
      responses: documents.map((doc) =>
        toFHIRFromPrisma(doc as CompanionRecord),
      ),
    };
  },

  async listByParentNotInOrganisation(
    parentId: string,
    organisationId: string,
  ) {
    if (!parentId || typeof parentId !== "string") {
      throw new CompanionServiceError("Invalid Parent Document Id", 400);
    }

    if (!organisationId || typeof organisationId !== "string") {
      throw new CompanionServiceError("Invalid Organisation Document Id", 400);
    }

    const parentCompanionIds =
      await ParentCompanionService.getActiveCompanionIdsForParent(parentId);

    if (!parentCompanionIds.length) {
      return { responses: [] };
    }

    const linkedCompanions = await prisma.patientOrganisation.findMany({
      where: {
        organisationId,
        patientId: { in: parentCompanionIds },
      },
      select: { patientId: true },
    });

    const linkedCompanionIdSet = new Set(
      linkedCompanions.map((entry) => entry.patientId),
    );

    const unlinkedCompanionIds = parentCompanionIds.filter(
      (id) => !linkedCompanionIdSet.has(id),
    );

    if (!unlinkedCompanionIds.length) {
      return { responses: [] };
    }

    const documents = await prisma.patient.findMany({
      where: { id: { in: unlinkedCompanionIds } },
    });

    return {
      responses: documents.map((doc) =>
        toFHIRFromPrisma(doc as CompanionRecord),
      ),
    };
  },

  async getById(id: string) {
    if (!id || typeof id !== "string") return null;

    const doc = await prisma.patient.findUnique({ where: { id } });
    if (!doc) return null;

    return { response: toFHIRFromPrisma(doc as CompanionRecord) };
  },

  async getByName(name: string) {
    if (!name || typeof name !== "string") {
      throw new CompanionServiceError("Name is required for searching.", 400);
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new CompanionServiceError("Name is required for searching.", 400);
    }

    const safe = escapeStringRegexp(trimmed);
    const documents = await prisma.patient.findMany({
      where: { name: { contains: safe, mode: "insensitive" } },
    });

    return {
      responses: documents.map((doc) =>
        toFHIRFromPrisma(doc as CompanionRecord),
      ),
    };
  },

  async update(id: string, payload: CompanionRequestDTO) {
    const persistable = toPersistable(payload);
    await validateCompanionCodes(persistable);
    persistable.isProfileComplete = computeIsProfileComplete(persistable);

    const doc = await prisma.patient.update({
      where: { id },
      data: {
        name: persistable.name,
        type: persistable.type as PrismaPatientType,
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
        isNeutered: persistable.isneutered ?? undefined,
        ageWhenNeutered: persistable.ageWhenNeutered ?? undefined,
        microchipNumber: persistable.microchipNumber ?? undefined,
        passportNumber: persistable.passportNumber ?? undefined,
        isInsured: persistable.isInsured ?? false,
        insurance: persistable.insurance
          ? (persistable.insurance as unknown as Prisma.InputJsonValue)
          : undefined,
        countryOfOrigin: persistable.countryOfOrigin ?? undefined,
        source: persistable.source as PrismaSourceType,
        status: persistable.status as PrismaRecordStatus,
        physicalAttribute: persistable.physicalAttribute
          ? (persistable.physicalAttribute as unknown as Prisma.InputJsonValue)
          : undefined,
        breedingInfo: persistable.breedingInfo
          ? (persistable.breedingInfo as unknown as Prisma.InputJsonValue)
          : undefined,
        medicalRecords: persistable.medicalRecords
          ? (persistable.medicalRecords as unknown as Prisma.InputJsonValue)
          : undefined,
        alerts: persistable.alerts
          ? (persistable.alerts as unknown as Prisma.InputJsonValue)
          : undefined,
        isProfileComplete: persistable.isProfileComplete ?? false,
      },
    });

    return { response: toFHIRFromPrisma(doc as CompanionRecord) };
  },

  async delete(id: string, context?: CompanionCreateContext) {
    if (!context?.authUserId) {
      throw new CompanionServiceError(
        "Authenticated user is required to delete a companion.",
        401,
      );
    }

    const parent = await ParentService.findByLinkedUserId(context.authUserId);
    if (!parent?.id) {
      throw new CompanionServiceError(
        "Parent record not found for authenticated user.",
        403,
      );
    }

    await ParentCompanionService.ensurePrimaryOwnership(parent.id, id);
    await ParentCompanionService.deleteLinksForCompanion(id);
    await prisma.patient.deleteMany({ where: { id } });
  },
};
