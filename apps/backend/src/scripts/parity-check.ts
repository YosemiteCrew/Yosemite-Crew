import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 50);
const ONLY = process.env.ONLY?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const modelMappings: Array<{ mongoose: string; prisma: string }> = [
  { mongoose: "Appointment", prisma: "Appointment" },
  { mongoose: "Companion", prisma: "Companion" },
  { mongoose: "Parent", prisma: "Parent" },
  { mongoose: "Organization", prisma: "Organization" },
  { mongoose: "Document", prisma: "Document" },
  { mongoose: "Form", prisma: "Form" },
  { mongoose: "Invoice", prisma: "Invoice" },
  { mongoose: "Task", prisma: "Task" },
  { mongoose: "ContactRequest", prisma: "ContactRequest" },
  { mongoose: "User", prisma: "User" },
];

const loadModels = async () => {
  const modelsDir = path.join(process.cwd(), "src/models");
  const files = await fs.readdir(modelsDir);
  const imports = files
    .filter((file) => file.endsWith(".ts"))
    .map((file) => import(path.join(modelsDir, file)));
  await Promise.all(imports);
};

const countMongo = async (modelName: string) => {
  const model = mongoose.model(modelName);
  return model.countDocuments();
};

const countPostgres = async (prismaName: string) => {
  const delegate = (prisma as any)[
    prismaName.charAt(0).toLowerCase() + prismaName.slice(1)
  ];
  if (!delegate) return null;
  return delegate.count();
};

const sampleMongoIds = async (modelName: string, limit: number) => {
  const model = mongoose.model(modelName);
  const docs = await model.find({}, { _id: 1 }).limit(limit).lean();
  return docs.map((d) => String((d as { _id: unknown })._id));
};

const samplePostgresMatch = async (prismaName: string, ids: string[]) => {
  const delegate = (prisma as any)[
    prismaName.charAt(0).toLowerCase() + prismaName.slice(1)
  ];
  if (!delegate) return null;
  if (!ids.length) return 0;
  const rows = await delegate.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return rows.length;
};

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set");

  await loadModels();
  await mongoose.connect(mongoUri);

  const jobs = ONLY?.length
    ? modelMappings.filter(
        (m) => ONLY.includes(m.mongoose) || ONLY.includes(m.prisma),
      )
    : modelMappings;

  for (const job of jobs) {
    const mongoCount = await countMongo(job.mongoose);
    const pgCount = await countPostgres(job.prisma);
    const sampleIds = await sampleMongoIds(job.mongoose, SAMPLE_SIZE);
    const pgSampleMatch = await samplePostgresMatch(job.prisma, sampleIds);

    console.log(`\n${job.mongoose} -> ${job.prisma}`);
    console.log(`Mongo count: ${mongoCount}`);
    console.log(`Postgres count: ${pgCount}`);
    console.log(`Sample match: ${pgSampleMatch}/${sampleIds.length}`);
  }

  console.log("\nParity check complete.");
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
