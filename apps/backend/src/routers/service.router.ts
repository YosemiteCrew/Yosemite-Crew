import { Router } from "express";
import { ServiceController } from "../controllers/web/service.controller";

const router = Router();

router.post("/", ServiceController.createService);
router.get(
  "/organisation/search",
  ServiceController.listOrganisationByServiceName,
);
router.get("/bookable-slots", ServiceController.getBookableSlotsForService);
router.get("/:id", ServiceController.getServiceById);
router.patch("/:id", ServiceController.updateService);
router.delete("/:id", ServiceController.deleteService);

export default router;
