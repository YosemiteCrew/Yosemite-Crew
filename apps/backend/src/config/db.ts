import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import logger from "../utils/logger";

export async function connectDB() {
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
  logger.info(`Connected to MongoDB at ${mongoUri}`);
}
