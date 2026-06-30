import { Router } from "express";
import { authorizeApiKey, requireScope } from "src/middlewares/api-key-auth";
import { DeveloperDataController } from "../controllers/web/developer-data.controller";

const developerDataRouter = Router();

developerDataRouter.use(authorizeApiKey);

developerDataRouter.get(
  "/appointments",
  requireScope("appointments:read"),
  DeveloperDataController.listAppointments,
);

developerDataRouter.get(
  "/appointments/:id",
  requireScope("appointments:read"),
  DeveloperDataController.getAppointment,
);

developerDataRouter.get(
  "/patients",
  requireScope("patients:read"),
  DeveloperDataController.listPatients,
);

developerDataRouter.get(
  "/patients/:id",
  requireScope("patients:read"),
  DeveloperDataController.getPatient,
);

export default developerDataRouter;
