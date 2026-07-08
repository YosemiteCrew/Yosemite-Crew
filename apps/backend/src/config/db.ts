import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import logger from "../utils/logger";

/**
 * Remove any `user:password@` credentials from a MongoDB connection string so
 * the URI can be safely logged. Handles `mongodb://` and `mongodb+srv://`.
 */
export function redactMongoUri(uri: string): string {
  if (!uri) {
    return "(no MONGODB_URI configured)";
  }
  return uri.replace(/\/\/[^@/]+@/, "//****@");
}

export async function connectDB() {
  if (process.env.READ_FROM_POSTGRES === "true") {
    logger.info("Skipping MongoDB connection because READ_FROM_POSTGRES=true");
    return;
  }

  let mongoUri: string;

  if (process.env.USE_INMEMORY_DB === "true") {
    logger.info("Starting in-memory MongoDB...");
    const mongod = await MongoMemoryServer.create({
      instance: { dbName: "yosemitecrew", port: 27017 },
    });
    mongoUri = mongod.getUri();
  } else if (process.env.LOCAL_DEVELOPMENT === "true") {
    mongoUri = "mongodb://localhost:27017/yosemitecrew";
  } else {
    mongoUri = process.env.MONGODB_URI || "";
  }

  await mongoose.connect(mongoUri);
  logger.info(`Connected to MongoDB at ${redactMongoUri(mongoUri)}`);
}
