import express from "express";
import rateLimit from "express-rate-limit";
import fileUpload from "express-fileupload";
import logger from "./utils/logger";
import mongoose from "mongoose";
import organizationRounter from "./routers/organization.router";
import companionRouter from "./routers/companion.router";
import parentRouter from "./routers/parent.router";
import userOrganizationRouter from "./routers/user-organization.router";
import userRouter from "./routers/user.router";
import userProfileRouter from "./routers/user-profile.router";
import availabilityRouter from "./routers/availability.router";
import { MongoMemoryServer } from "mongodb-memory-server";
import specialtyRouter from "./routers/speciality.router";
import organisationRoomRouter from "./routers/organisation-room.router";
import organisationInviteRouter from "./routers/organisation-invite.router";
import authUserMobileRouter from "./routers/authUserMobile.router";
import coParentInviteRouter from "./routers/coparentInvite.router";
import parentCompanionRouter from "./routers/parent-companion.router";
import companionOrganisationRouter from "./routers/companion-organisation.router";
import docuemntRouter from "./routers/document.router";
import serviceRouter from "./routers/service.router";
import appointmentRouter from "./routers/appointment.router";
import stripeRouter from "./routers/stripe.router";
import { StripeController } from "./controllers/web/stripe.controller";
import ratingRouter from "./routers/organisationRating.router";

const app = express();
const PORT = process.env.PORT || 3000;
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.set("trust proxy", 1);
app.use(limiter);
app.use(fileUpload());

app.post(
  "/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
  StripeController.webhook,
);

app.use(express.json());

app.use(`/fhir/v1/organization`, organizationRounter);
app.use(`/fhir/v1/companion`, companionRouter);
app.use(`/fhir/v1/parent`, parentRouter);
app.use(`/fhir/v1/user-organization`, userOrganizationRouter);
app.use(`/fhir/v1/user`, userRouter);
app.use(`/fhir/v1/user-profile`, userProfileRouter);
app.use(`/fhir/v1/speciality`, specialtyRouter);
app.use(`/fhir/v1/organisation-room`, organisationRoomRouter);
app.use(`/fhir/v1/organisation-invites`, organisationInviteRouter);
app.use(`/fhir/v1/availability`, availabilityRouter);
app.use(`/v1/authUser`, authUserMobileRouter);
app.use(`/v1/coparent-invite`, coParentInviteRouter);
app.use(`/v1/parent-companion`, parentCompanionRouter);
app.use(`/v1/companion-organisation`, companionOrganisationRouter);
app.use(`/v1/document`, docuemntRouter);
app.use(`/fhir/v1/service`, serviceRouter);
app.use(`/fhir/v1/appointment`, appointmentRouter);
app.use(`/v1/stripe`, stripeRouter);
app.use(`v1/oragnisation-rating`, ratingRouter);

let mongoUri: string;

try {
  if (process.env.USE_INMEMORY_DB === "true") {
    logger.info("Starting in-memory MongoDB...");
    const mongod = await MongoMemoryServer.create({
      instance: {
        dbName: "yosemitecrew",
        port: 27017,
      },
    });
    mongoUri = mongod.getUri();
  } else if (process.env.LOCAL_DEVELOPMENT === "true") {
    mongoUri = "mongodb://localhost:27017/yosemitecrew";
  } else {
    mongoUri = process.env.MONGODB_URI || "";
  }

  await mongoose.connect(mongoUri);
  logger.info(`Connected to MongoDB at ${mongoUri}`);

  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
} catch (err) {
  logger.error("Failed to connect to MongoDB", err);
  process.exit(1);
}
