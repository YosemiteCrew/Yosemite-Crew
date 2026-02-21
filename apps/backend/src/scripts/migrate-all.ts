import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 500);
const DRY_RUN = process.env.DRY_RUN === "true";
const ONLY = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const RESET = process.env.RESET === "true";

const modelMappings: Array<{ mongoose: string; prisma: string }> = [
  { mongoose: "AccountWithdrawal", prisma: "AccountWithdrawal" },
  { mongoose: "AdverseEventReport", prisma: "AdverseEventReport" },
  { mongoose: "Appointment", prisma: "Appointment" },
  { mongoose: "AuditTrail", prisma: "AuditTrail" },
  { mongoose: "AuthUser", prisma: "AuthUserMobile" },
  { mongoose: "BaseAvailability", prisma: "BaseAvailability" },
  { mongoose: "ChatSession", prisma: "ChatSession" },
  { mongoose: "CoParentInvite", prisma: "CoParentInvite" },
  { mongoose: "Companion", prisma: "Companion" },
  { mongoose: "CompanionOrganisation", prisma: "CompanionOrganisation" },
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
  { mongoose: "ObservationToolDefinition", prisma: "ObservationToolDefinition" },
  { mongoose: "ObservationToolSubmission", prisma: "ObservationToolSubmission" },
  { mongoose: "Occupancy", prisma: "Occupancy" },
  { mongoose: "OrganizationDocument", prisma: "OrganizationDocument" },
  { mongoose: "OrganisationInvite", prisma: "OrganisationInvite" },
  { mongoose: "OrganisationRating", prisma: "OrganisationRating" },
  { mongoose: "OrganisationRoom", prisma: "OrganisationRoom" },
  { mongoose: "OrgBilling", prisma: "OrganizationBilling" },
  { mongoose: "OrgUsageCounters", prisma: "OrganizationUsageCounter" },
  { mongoose: "Parent", prisma: "Parent" },
  { mongoose: "ParentCompanion", prisma: "ParentCompanion" },
  { mongoose: "RegulatoryAuthority", prisma: "RegulatoryAuthority" },
  { mongoose: "ReminderJob", prisma: "ReminderJob" },
  { mongoose: "Service", prisma: "Service" },
  { mongoose: "Speciality", prisma: "Speciality" },
  { mongoose: "Task", prisma: "Task" },
  { mongoose: "TaskCompletion", prisma: "TaskCompletion" },
  { mongoose: "TaskLibraryDefinition", prisma: "TaskLibraryDefinition" },
  { mongoose: "TaskTemplate", prisma: "TaskTemplate" },
  { mongoose: "User", prisma: "User" },
  { mongoose: "UserOrganization", prisma: "UserOrganization" },
  { mongoose: "UserProfile", prisma: "UserProfile" },
  { mongoose: "WeeklyAvailabilityOverride", prisma: "WeeklyAvailabilityOverride" },
  { mongoose: "Organization", prisma: "Organization" },
];

const tableNameOverrides: Record<string, string> = {
  AuthUserMobile: "AuthUser",
  OrganizationBilling: "OrgBilling",
  OrganizationUsageCounter: "OrgUsageCounters",
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
};

const migrateModel = async (
  mongooseName: string,
  prismaName: string,
  fieldsByModel: Map<string, string[]>,
  hasIdByModel: Map<string, boolean>,
) => {
  const model = mongoose.model(mongooseName);
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

  let batch: Record<string, unknown>[] = [];
  let attachmentBatch: Record<string, unknown>[] = [];
  let parentAddressBatch: Record<string, unknown>[] = [];
  let orgAddressBatch: Record<string, unknown>[] = [];
  let userProfileAddressBatch: Record<string, unknown>[] = [];
  let processed = 0;

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

    batch.push(data);

    if (prismaName === "Document" && Array.isArray(obj.attachments) && data.id) {
      const documentId = data.id as string;
      for (const attachment of obj.attachments as Array<Record<string, unknown>>) {
        attachmentBatch.push({
          documentId,
          key: attachment.key,
          mimeType: attachment.mimeType,
          size: attachment.size,
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
      const personal = obj.personalDetails as Record<string, unknown> | undefined;
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
        if (prismaName === "UserProfile" && userProfileAddressBatch.length > 0) {
          await (prisma as any).userProfileAddress.createMany({
            data: userProfileAddressBatch,
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
    }
    processed += batch.length;
  }

  console.log(`\nDone. ${mongooseName}: ${processed}`);
};

const main = async () => {
  const mongoUri = "mongodb://localhost:27017/yosemitecrew";
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set");
  }

  await loadModels();
  await mongoose.connect(mongoUri);

  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaText = await fs.readFile(schemaPath, "utf8");
  const { modelFields, modelHasId } = parseSchema(schemaText);

  const jobs = ONLY?.length
    ? modelMappings.filter((m) => ONLY.includes(m.mongoose) || ONLY.includes(m.prisma))
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
        ].filter(Boolean),
      ),
    );

    const statements = tableNames.map((table) => `TRUNCATE \"${table}\" CASCADE`);
    console.log(`\nResetting tables (${tableNames.length})...`);
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
  }

  for (const job of jobs) {
    console.log(`\n==> Migrating ${job.mongoose} -> ${job.prisma}`);
    await migrateModel(job.mongoose, job.prisma, modelFields, modelHasId);
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
