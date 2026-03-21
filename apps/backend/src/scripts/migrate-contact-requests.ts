import dotenv from "dotenv";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import ContactRequestModel from "../models/contect-us";

dotenv.config();

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 500);
const DRY_RUN = process.env.DRY_RUN === "true";

const mapContact = (doc: typeof ContactRequestModel.prototype) => {
  const obj = doc.toObject({ virtuals: false });
  return {
    type: obj.type,
    source: obj.source,
    subject: obj.subject,
    message: obj.message,
    userId: obj.userId ?? undefined,
    email: obj.email ?? undefined,
    organisationId: obj.organisationId ?? undefined,
    companionId: obj.companionId ?? undefined,
    parentId: obj.parentId ?? undefined,
    dsarDetails: obj.dsarDetails ?? undefined,
    complaintContext: obj.complaintContext ?? undefined,
    attachments: obj.attachments ?? undefined,
    status: obj.status ?? undefined,
    internalNotes: obj.internalNotes ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

export const migrateContactRequests = async (prisma?: PrismaClient) => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set");
  }

  const localPrisma = prisma ?? new PrismaClient();

  await mongoose.connect(mongoUri);

  let batch: any[] = [];
  let processed = 0;

  const cursor = ContactRequestModel.find().sort({ _id: 1 }).cursor();

  for await (const doc of cursor) {
    batch.push(mapContact(doc));

    if (batch.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        await localPrisma.contactRequest.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
      processed += batch.length;
      batch = [];
      process.stdout.write(`\rProcessed ${processed} contact requests`);
    }
  }

  if (batch.length > 0) {
    if (!DRY_RUN) {
      await localPrisma.contactRequest.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }
    processed += batch.length;
  }

  console.log(`\nDone. Total processed: ${processed}`);

  await mongoose.disconnect();

  if (!prisma) {
    await localPrisma.$disconnect();
  }
};

const shouldRunDirectly =
  import.meta.url === new URL(process.argv[1] ?? "", "file:").href;

if (shouldRunDirectly) {
  const prisma = new PrismaClient();
  migrateContactRequests(prisma)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
