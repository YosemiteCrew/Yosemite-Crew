import express from "express";
import fileUpload from "express-fileupload";
import logger from "./utils/logger";
import mongoose from "mongoose";
import organizationRounter from "./routers/organization.router";
import parentRouter from "./routers/parent.router";
import userOrganizationRouter from "./routers/user-organization.router";
import userRouter from "./routers/user.router";
import { MongoMemoryServer } from "mongodb-memory-server";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(fileUpload());

app.use(`/fhir/v1/organization`, organizationRounter);
app.use(`/fhir/v1/parent`, parentRouter);
app.use(`/fhir/v1/user-organization`, userOrganizationRouter);
app.use(`/fhir/v1/user`, userRouter);

async function startServer() {
  try {
    let mongoUri: string;

    if (process.env.USE_INMEMORY_DB === "true") {
      logger.info("Starting in-memory MongoDB...");
      const mongod = await MongoMemoryServer.create(
        {
          instance: { 
            dbName: "yosemitecrew",
            port: 27017  // You can specify a port if needed
          },
        }
      );
      mongoUri = mongod.getUri();
    } else {
      mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/yosemitecrew";
    }

    await mongoose.connect(mongoUri);
    logger.info(`connected to MongoDB at ${mongoUri}`);

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}

startServer();
