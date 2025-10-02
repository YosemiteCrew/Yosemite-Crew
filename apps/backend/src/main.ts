import express, { Request, Response } from "express";
import logger from "./utils/logger";
import mongoose from "mongoose";
import organizationRounter from "./routers/organization.router";
import parentRouter from "./routers/parent.router";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(`/fhir/v1/organization`, organizationRounter);
app.use(`/fhir/v1/parent`, parentRouter);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yosemitecrew')
.then(() => {
  logger.info('Connected to MongoDB');
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}).catch((err) => {
  logger.error('Failed to connect to MongoDB', err);
});
