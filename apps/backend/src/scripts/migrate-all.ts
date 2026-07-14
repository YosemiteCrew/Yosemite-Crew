import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import {
  chooseMongooseSourceModelName,
  deriveOrganisationRoomCode,
  getMissingCoParentInvitePatientIdReason,
  getMissingExternalExpensePatientIdReason,
  getMissingCompanionForeignKeyReason,
  getMissingMongooseModelReason,
  normalizePatientGender,
  normalizePatientSource,
  normalizePatientStatus,
  normalizePatientType,
  resolveLegacyPatientId,
} from "./migrate-all.helpers";
import { normalizeRoomType } from "../services/room-management.helpers";

dotenv.config();

const prisma = new PrismaClient();

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 500);
const DRY_RUN = process.env.DRY_RUN === "true";
const ONLY = process.env.ONLY?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RESET = process.env.RESET === "true";

const modelMappings: Array<{
  mongoose: string;
  prisma: string;
  sourceMongooseNames?: string[];
}> = [
  { mongoose: "AccountWithdrawal", prisma: "AccountWithdrawal" },
  { mongoose: "AdverseEventReport", prisma: "AdverseEventReport" },
  { mongoose: "Appointment", prisma: "Appointment" },
  { mongoose: "AuditTrail", prisma: "AuditTrail" },
  { mongoose: "AuthUser", prisma: "AuthUserMobile" },
  { mongoose: "BaseAvailability", prisma: "BaseAvailability" },
  { mongoose: "ChatSession", prisma: "ChatSession" },
  { mongoose: "CoParentInvite", prisma: "CoParentInvite" },
  { mongoose: "Companion", prisma: "Patient" },
  { mongoose: "ContactRequest", prisma: "ContactRequest" },
  { mongoose: "DeviceToken", prisma: "DeviceToken" },
  { mongoose: "Document", prisma: "Document" },
  { mongoose: "ExternalExpense", prisma: "ExternalExpense" },
  { mongoose: "Form", prisma: "Form" },
  { mongoose: "FormField", prisma: "FormField" },
  { mongoose: "FormSubmission", prisma: "FormSubmission" },
  { mongoose: "FormVersion", prisma: "FormVersion" },
  { mongoose: "InventoryBatch", prisma: "InventoryBatch" },
  { mongoose: "InventoryItem", prisma: "InventoryItem" },
  { mongoose: "InventoryMetaField", prisma: "InventoryMetaField" },
  { mongoose: "InventoryStockMovement", prisma: "InventoryStockMovement" },
  { mongoose: "InventoryVendor", prisma: "InventoryVendor" },
  { mongoose: "Invoice", prisma: "Invoice" },
  { mongoose: "Notification", prisma: "Notification" },
  {
    mongoose: "ObservationToolDefinition",
    prisma: "ObservationToolDefinition",
  },
  {
    mongoose: "ObservationToolSubmission",
    prisma: "ObservationToolSubmission",
  },
  { mongoose: "Occupancy", prisma: "Occupancy" },
  { mongoose: "OrganizationDocument", prisma: "OrganizationDocument" },
  { mongoose: "OrganisationInvite", prisma: "OrganisationInvite" },
  { mongoose: "OrganisationRating", prisma: "OrganisationRating" },
  { mongoose: "OrgBilling", prisma: "OrganizationBilling" },
  { mongoose: "OrgUsageCounters", prisma: "OrganizationUsageCounter" },
  { mongoose: "Parent", prisma: "Parent" },
  {
    mongoose: "PatientOrganisation",
    prisma: "PatientOrganisation",
    sourceMongooseNames: ["CompanionOrganisation", "PatientOrganisation"],
  },
  {
    mongoose: "ParentPatient",
    prisma: "ParentPatient",
    sourceMongooseNames: ["ParentCompanion", "ParentPatient"],
  },
  { mongoose: "RegulatoryAuthority", prisma: "RegulatoryAuthority" },
  { mongoose: "ReminderJob", prisma: "ReminderJob" },
  { mongoose: "Service", prisma: "Service" },
  { mongoose: "Speciality", prisma: "Speciality" },
  { mongoose: "Task", prisma: "Task" },
  { mongoose: "TaskCompletion", prisma: "TaskCompletion" },
  { mongoose: "TaskLibraryDefinition", prisma: "TaskLibraryDefinition" },
  { mongoose: "TaskTemplate", prisma: "TaskTemplate" },
  { mongoose: "User", prisma: "User" },
  { mongoose: "OrganisationRoom", prisma: "OrganisationRoom" },
  { mongoose: "UserOrganization", prisma: "UserOrganization" },
  { mongoose: "UserProfile", prisma: "UserProfile" },
  {
    mongoose: "WeeklyAvailabilityOverride",
    prisma: "WeeklyAvailabilityOverride",
  },
  { mongoose: "Organization", prisma: "Organization" },
];

const tableNameOverrides: Record<string, string> = {
  AuthUserMobile: "AuthUser",
  OrganizationBilling: "OrgBilling",
  OrganizationUsageCounter: "OrgUsageCounters",
};

const legacyMongooseModelAliases: Array<{
  alias: string;
  current: string;
  collection: string;
}> = [
  {
    alias: "CompanionOrganisation",
    current: "PatientOrganisation",
    collection: "companionorganisations",
  },
  {
    alias: "ParentCompanion",
    current: "ParentPatient",
    collection: "parentcompanions",
  },
];

const modelNameAliases: Record<string, string> = {
  CompanionOrganisation: "PatientOrganisation",
  ParentCompanion: "ParentPatient",
};

const fieldAliases: Record<string, Record<string, string>> = {
  Organization: {
    dunsNumber: "DUNSNumber",
    imageUrl: "imageURL",
    address: "__skip__",
  },
  FormField: {
    fieldId: "id",
  },
  Appointment: {
    patient: "companion",
  },
  Parent: {
    address: "__skip__",
  },
  Document: {
    attachments: "__skip__",
  },
};

const toIdString = (value: unknown): unknown => {
  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => toIdString(item));
    }
    const anyValue = value as { toString?: () => string };
    if (typeof anyValue.toString === "function") {
      const str = anyValue.toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = toIdString(v);
    }
    return obj;
  }
  return value;
};

const extractAddress = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const addr = value as Record<string, unknown>;
  return {
    addressLine: addr.addressLine,
    country: addr.country,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    latitude: addr.latitude,
    longitude: addr.longitude,
    location: addr.location,
  };
};

const parseSchema = (schemaText: string) => {
  const enumNames = new Set<string>();
  const modelNames = new Set<string>();
  const modelFields = new Map<string, string[]>();
  const modelHasId = new Map<string, boolean>();

  const lines = schemaText.split("\n");
  let currentEnum: string | null = null;
  let currentModel: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;

    if (line.startsWith("enum ")) {
      currentEnum = line.split(/\s+/)[1];
      enumNames.add(currentEnum);
      currentModel = null;
      continue;
    }

    if (line.startsWith("model ")) {
      currentModel = line.split(/\s+/)[1];
      modelNames.add(currentModel);
      modelFields.set(currentModel, []);
      modelHasId.set(currentModel, false);
      currentEnum = null;
      continue;
    }

    if (line.startsWith("}")) {
      currentEnum = null;
      currentModel = null;
      continue;
    }

    if (currentModel) {
      if (line.startsWith("@@")) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const fieldName = parts[0];
      const fieldTypeRaw = parts[1];
      const fieldType = fieldTypeRaw.replaceAll(/\?|\[\]/g, "");
      if (fieldName === "id") {
        modelHasId.set(currentModel, true);
        continue;
      }
      if (line.includes("@relation")) continue;
      if (modelNames.has(fieldType)) continue;
      // enums are fine, scalars are fine.
      modelFields.get(currentModel)?.push(fieldName);
    }
  }

  return { enumNames, modelNames, modelFields, modelHasId };
};

const loadModels = async () => {
  const modelsDir = path.join(process.cwd(), "src/models");
  const files = await fs.readdir(modelsDir);
  const imports = files
    .filter((file) => file.endsWith(".ts"))
    .map((file) => import(path.join(modelsDir, file)));
  await Promise.all(imports);

  for (const alias of legacyMongooseModelAliases) {
    if (mongoose.models[alias.alias]) continue;
    const currentModel = mongoose.models[alias.current];
    if (!currentModel) continue;
    mongoose.model(alias.alias, currentModel.schema, alias.collection);
  }
};

const migrateModel = async (
  mongooseName: string,
  prismaName: string,
  fieldsByModel: Map<string, string[]>,
  hasIdByModel: Map<string, boolean>,
  sourceMongooseNames: string[] = [],
) => {
  const sourceModelNames = [mongooseName, ...sourceMongooseNames];
  const sourceModelName = chooseMongooseSourceModelName({
    preferredNames: sourceModelNames,
    registeredModelNames: mongoose.modelNames(),
    documentCounts: new Map(
      await Promise.all(
        sourceModelNames.map(async (name) => {
          if (!mongoose.modelNames().includes(name)) {
            return [name, 0] as const;
          }
          const count = await mongoose.model(name).estimatedDocumentCount();
          return [name, count] as const;
        }),
      ),
    ),
  });
  const missingModelReason = sourceModelName
    ? null
    : getMissingMongooseModelReason(mongooseName, mongoose.modelNames());
  if (missingModelReason) {
    console.warn(`Skipping ${mongooseName}: ${missingModelReason}.`);
    return;
  }

  const model = mongoose.model(sourceModelName ?? mongooseName);
  const prismaDelegate = (prisma as any)[
    prismaName.charAt(0).toLowerCase() + prismaName.slice(1)
  ];

  if (!prismaDelegate) {
    throw new Error(`Prisma delegate not found for ${prismaName}`);
  }

  const fields = fieldsByModel.get(prismaName);
  if (!fields) {
    throw new Error(`No Prisma fields found for ${prismaName}`);
  }
  const hasId = hasIdByModel.get(prismaName) ?? false;

  const aliases = fieldAliases[prismaName] ?? {};
  const legacyPatientIdFields =
    prismaName === "Document" ||
    prismaName === "PatientOrganisation" ||
    prismaName === "ParentPatient" ||
    prismaName === "CoParentInvite" ||
    prismaName === "ExternalExpense"
      ? ["patientId", "companionId", "patient", "companion"]
      : [];

  let batch: Record<string, unknown>[] = [];
  let attachmentBatch: Record<string, unknown>[] = [];
  let parentAddressBatch: Record<string, unknown>[] = [];
  let orgAddressBatch: Record<string, unknown>[] = [];
  let userProfileAddressBatch: Record<string, unknown>[] = [];
  let roomSpecialityBatch: Record<string, unknown>[] = [];
  let roomStaffBatch: Record<string, unknown>[] = [];
  let processed = 0;
  let skipped = 0;
  let skippedMissingForm = 0;
  let skippedMissingPatientFk = 0;
  let skippedMissingRoomSpecialityFk = 0;
  let skippedMissingRoomStaffFk = 0;
  let skippedMissingCoParentInvitePatientId = 0;

  let existingFormIds: Set<string> | null = null;
  let existingPatientIds: Set<string> | null = null;
  let existingSpecialityIds: Set<string> | null = null;
  let existingUserIds: Set<string> | null = null;
  if (
    prismaName === "FormField" ||
    prismaName === "FormVersion" ||
    prismaName === "FormSubmission"
  ) {
    const forms = await prisma.form.findMany({ select: { id: true } });
    existingFormIds = new Set(forms.map((form) => form.id));
  }
  if (
    prismaName === "Document" ||
    prismaName === "PatientOrganisation" ||
    prismaName === "ParentPatient"
  ) {
    const patients = await prisma.patient.findMany({
      select: { id: true },
    });
    existingPatientIds = new Set(patients.map((patient) => patient.id));
  }
  if (prismaName === "OrganisationRoom") {
    const specialities = await prisma.speciality.findMany({
      select: { id: true },
    });
    const users = await prisma.user.findMany({
      select: { userId: true },
    });
    existingSpecialityIds = new Set(
      specialities.map((speciality) => speciality.id),
    );
    existingUserIds = new Set(users.map((user) => user.userId));
  }

  const cursor = model.find().sort({ _id: 1 }).cursor();
  for await (const doc of cursor) {
    const obj = doc.toObject({ virtuals: false }) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (hasId && obj._id) {
      data.id = toIdString(obj._id);
    }
    for (const field of fields) {
      const sourceField: string = aliases[field] ?? field;
      if (sourceField === "__skip__") continue;
      if (!(sourceField in obj)) continue;
      const value = obj[sourceField];
      if (value === undefined) continue;
      data[field] = toIdString(value);
    }

    if (
      legacyPatientIdFields.length > 0 &&
      typeof data.patientId !== "string"
    ) {
      const resolvedPatientId = resolveLegacyPatientId(
        obj,
        legacyPatientIdFields,
      );
      if (resolvedPatientId) {
        data.patientId = resolvedPatientId;
      }
    }

    if (
      prismaName === "FormField" ||
      prismaName === "FormVersion" ||
      prismaName === "FormSubmission"
    ) {
      const formId = data.formId;
      if (typeof formId !== "string" || !existingFormIds?.has(formId)) {
        skipped += 1;
        skippedMissingForm += 1;
        continue;
      }
    }

    if (prismaName === "Patient") {
      const normalizedType = normalizePatientType(data.type);
      const normalizedGender = normalizePatientGender(data.gender);
      if (!normalizedType || !normalizedGender) {
        skipped += 1;
        console.warn(
          `Skipping ${mongooseName} ${String(data.id ?? obj._id ?? "")} because a patient enum value could not be normalized.`,
        );
        continue;
      }
      data.type = normalizedType;
      data.gender = normalizedGender;

      const normalizedSource = normalizePatientSource(data.source);
      if (normalizedSource) {
        data.source = normalizedSource;
      } else {
        delete data.source;
      }

      const normalizedStatus = normalizePatientStatus(data.status);
      if (normalizedStatus) {
        data.status = normalizedStatus;
      } else {
        delete data.status;
      }
    }

    if (prismaName === "CoParentInvite") {
      const missingPatientIdReason =
        getMissingCoParentInvitePatientIdReason(data);
      if (missingPatientIdReason) {
        skipped += 1;
        skippedMissingCoParentInvitePatientId += 1;
        console.warn(
          `Skipping ${mongooseName} ${String(data.id ?? obj._id ?? "")} because ${missingPatientIdReason}.`,
        );
        continue;
      }
    }

    if (prismaName === "ExternalExpense") {
      const missingPatientIdReason =
        getMissingExternalExpensePatientIdReason(data);
      if (missingPatientIdReason) {
        skipped += 1;
        console.warn(
          `Skipping ${mongooseName} ${String(data.id ?? obj._id ?? "")} because ${missingPatientIdReason}.`,
        );
        continue;
      }
    }

    if (prismaName === "OrganisationRoom" && typeof data.code !== "string") {
      const derivedCode = deriveOrganisationRoomCode({
        data: { ...obj, ...data },
      });
      if (!derivedCode) {
        skipped += 1;
        console.warn(
          `Skipping ${mongooseName} ${String(data.id ?? obj._id ?? "")} because a room code could not be derived.`,
        );
        continue;
      }
      data.code = derivedCode;
    }

    if (prismaName === "OrganisationRoom") {
      try {
        data.type = normalizeRoomType(data.type);
      } catch {
        skipped += 1;
        console.warn(
          `Skipping ${mongooseName} ${String(data.id ?? obj._id ?? "")} because room type could not be normalized.`,
        );
        continue;
      }
    }

    const missingCompanionFkReason = getMissingCompanionForeignKeyReason(
      prismaName,
      data,
      existingPatientIds ?? new Set(),
    );
    if (missingCompanionFkReason) {
      skipped += 1;
      skippedMissingPatientFk += 1;
      continue;
    }

    batch.push(data);

    if (
      prismaName === "Document" &&
      Array.isArray(obj.attachments) &&
      data.id
    ) {
      const documentId = data.id as string;
      for (const attachment of obj.attachments as Array<
        Record<string, unknown>
      >) {
        attachmentBatch.push({
          documentId,
          key: attachment.key,
          mimeType: attachment.mimeType,
          size: attachment.size,
        });
      }
    }

    if (prismaName === "OrganisationRoom" && data.id) {
      const roomId = data.id as string;
      const organisationId = toIdString(obj.organisationId);
      const safeOrganisationId =
        typeof organisationId === "string" ? organisationId : null;
      const assignedSpecialiteis = Array.isArray(obj.assignedSpecialiteis)
        ? (obj.assignedSpecialiteis as Array<unknown>)
        : [];
      const assignedStaffs = Array.isArray(obj.assignedStaffs)
        ? (obj.assignedStaffs as Array<unknown>)
        : [];

      for (const speciality of assignedSpecialiteis) {
        const specialityId = toIdString(speciality);
        if (
          typeof specialityId !== "string" ||
          !(existingSpecialityIds?.has(specialityId) ?? false)
        ) {
          skipped += 1;
          skippedMissingRoomSpecialityFk += 1;
          continue;
        }
        if (!safeOrganisationId) {
          skipped += 1;
          skippedMissingRoomSpecialityFk += 1;
          continue;
        }

        roomSpecialityBatch.push({
          organisationId: safeOrganisationId,
          roomId,
          specialityId,
        });
      }

      for (const staff of assignedStaffs) {
        const staffUserId = toIdString(staff);
        if (
          typeof staffUserId !== "string" ||
          !(existingUserIds?.has(staffUserId) ?? false)
        ) {
          skipped += 1;
          skippedMissingRoomStaffFk += 1;
          continue;
        }
        if (!safeOrganisationId) {
          skipped += 1;
          skippedMissingRoomStaffFk += 1;
          continue;
        }

        roomStaffBatch.push({
          organisationId: safeOrganisationId,
          roomId,
          staffUserId,
        });
      }
    }

    if (prismaName === "Parent" && data.id) {
      const addr = extractAddress(obj.address);
      if (addr) {
        const addrData = toIdString(addr);
        if (addrData && typeof addrData === "object") {
          parentAddressBatch.push({
            parentId: data.id,
            ...(addrData as Record<string, unknown>),
          });
        }
      }
    }

    if (prismaName === "Organization" && data.id) {
      const addr = extractAddress(obj.address);
      if (addr) {
        const addrData = toIdString(addr);
        if (addrData && typeof addrData === "object") {
          orgAddressBatch.push({
            organizationId: data.id,
            ...(addrData as Record<string, unknown>),
          });
        }
      }
    }

    if (prismaName === "UserProfile" && data.id) {
      const personal = obj.personalDetails as
        | Record<string, unknown>
        | undefined;
      const addr = extractAddress(personal?.address);
      if (addr) {
        const addrData = toIdString(addr);
        if (addrData && typeof addrData === "object") {
          userProfileAddressBatch.push({
            userProfileId: data.id,
            ...(addrData as Record<string, unknown>),
          });
        }
      }
    }

    if (batch.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        await prismaDelegate.createMany({ data: batch, skipDuplicates: true });
        if (prismaName === "Document" && attachmentBatch.length > 0) {
          await (prisma as any).documentAttachment.createMany({
            data: attachmentBatch,
            skipDuplicates: true,
          });
        }
        if (prismaName === "Parent" && parentAddressBatch.length > 0) {
          await (prisma as any).parentAddress.createMany({
            data: parentAddressBatch,
            skipDuplicates: true,
          });
        }
        if (prismaName === "Organization" && orgAddressBatch.length > 0) {
          await (prisma as any).organizationAddress.createMany({
            data: orgAddressBatch,
            skipDuplicates: true,
          });
        }
        if (
          prismaName === "UserProfile" &&
          userProfileAddressBatch.length > 0
        ) {
          await (prisma as any).userProfileAddress.createMany({
            data: userProfileAddressBatch,
            skipDuplicates: true,
          });
        }
        if (
          prismaName === "OrganisationRoom" &&
          roomSpecialityBatch.length > 0
        ) {
          await (prisma as any).organisationRoomSpeciality.createMany({
            data: roomSpecialityBatch,
            skipDuplicates: true,
          });
        }
        if (prismaName === "OrganisationRoom" && roomStaffBatch.length > 0) {
          await (prisma as any).organisationRoomStaff.createMany({
            data: roomStaffBatch,
            skipDuplicates: true,
          });
        }
      }
      processed += batch.length;
      batch = [];
      attachmentBatch = [];
      parentAddressBatch = [];
      orgAddressBatch = [];
      userProfileAddressBatch = [];
      roomSpecialityBatch = [];
      roomStaffBatch = [];
      process.stdout.write(`\rProcessed ${processed} ${mongooseName}`);
    }
  }

  if (batch.length > 0) {
    if (!DRY_RUN) {
      await prismaDelegate.createMany({ data: batch, skipDuplicates: true });
      if (prismaName === "Document" && attachmentBatch.length > 0) {
        await (prisma as any).documentAttachment.createMany({
          data: attachmentBatch,
          skipDuplicates: true,
        });
      }
      if (prismaName === "Parent" && parentAddressBatch.length > 0) {
        await (prisma as any).parentAddress.createMany({
          data: parentAddressBatch,
          skipDuplicates: true,
        });
      }
      if (prismaName === "Organization" && orgAddressBatch.length > 0) {
        await (prisma as any).organizationAddress.createMany({
          data: orgAddressBatch,
          skipDuplicates: true,
        });
      }
      if (prismaName === "UserProfile" && userProfileAddressBatch.length > 0) {
        await (prisma as any).userProfileAddress.createMany({
          data: userProfileAddressBatch,
          skipDuplicates: true,
        });
      }
      if (prismaName === "OrganisationRoom" && roomSpecialityBatch.length > 0) {
        await (prisma as any).organisationRoomSpeciality.createMany({
          data: roomSpecialityBatch,
          skipDuplicates: true,
        });
      }
      if (prismaName === "OrganisationRoom" && roomStaffBatch.length > 0) {
        await (prisma as any).organisationRoomStaff.createMany({
          data: roomStaffBatch,
          skipDuplicates: true,
        });
      }
    }
    processed += batch.length;
  }

  if (skipped > 0) {
    if (skippedMissingPatientFk > 0) {
      console.log(
        `\nSkipped ${skippedMissingPatientFk} ${mongooseName} rows due to missing Patient references.`,
      );
    }
    if (skippedMissingRoomSpecialityFk > 0) {
      console.log(
        `\nSkipped ${skippedMissingRoomSpecialityFk} ${mongooseName} room-speciality links due to missing Speciality rows.`,
      );
    }
    if (skippedMissingRoomStaffFk > 0) {
      console.log(
        `\nSkipped ${skippedMissingRoomStaffFk} ${mongooseName} room-staff links due to missing User rows.`,
      );
    }
    if (skippedMissingCoParentInvitePatientId > 0) {
      console.log(
        `\nSkipped ${skippedMissingCoParentInvitePatientId} ${mongooseName} rows due to missing patientId.`,
      );
    }
    if (skippedMissingForm > 0) {
      console.log(
        `\nSkipped ${skippedMissingForm} ${mongooseName} rows due to missing Form.`,
      );
    }
  }
  console.log(`\nDone. ${mongooseName}: ${processed}`);
};

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set");
  }

  await loadModels();
  await mongoose.connect(mongoUri);

  const schemaPath = path.resolve(
    process.cwd(),
    "../../packages/database/prisma/schema.prisma",
  );
  const schemaText = await fs.readFile(schemaPath, "utf8");
  const { modelFields, modelHasId } = parseSchema(schemaText);

  const normalizedOnly = ONLY?.length
    ? ONLY.map((name) => modelNameAliases[name] ?? name)
    : null;

  const jobs = normalizedOnly?.length
    ? modelMappings.filter(
        (m) =>
          normalizedOnly.includes(m.mongoose) ||
          normalizedOnly.includes(m.prisma),
      )
    : modelMappings;

  if (RESET && !DRY_RUN) {
    const tableNames = Array.from(
      new Set(
        [
          ...jobs.map((job) => tableNameOverrides[job.prisma] ?? job.prisma),
          "DocumentAttachment",
          "ParentAddress",
          "OrganizationAddress",
          "UserProfileAddress",
          "OrganisationRoomSpeciality",
          "OrganisationRoomStaff",
        ].filter(Boolean),
      ),
    );

    const statements = tableNames.map((table) => `TRUNCATE "${table}" CASCADE`);
    console.log(`\nResetting tables (${tableNames.length})...`);
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
  }

  for (const job of jobs) {
    console.log(`\n==> Migrating ${job.mongoose} -> ${job.prisma}`);
    await migrateModel(
      job.mongoose,
      job.prisma,
      modelFields,
      modelHasId,
      job.sourceMongooseNames,
    );
  }

  console.log("\nAll migrations finished.");
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
