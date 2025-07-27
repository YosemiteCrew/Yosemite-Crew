import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware';
import AdminController from "../controllers/api-admin-controller";
import {verifyTokenAndRefresh} from '../middlewares/authMiddleware';

const router = express.Router();

router.post("/addCategory", AdminController.AddInventoryCategory);
router.post("/addManufacturer", AdminController.AddInventoryManufacturer);
router.post("/addItemCategory", AdminController.AddInventoryItemCategory);
router.get("/GetAddInventoryCategory",verifyToken,AdminController.GetAddInventoryCategory)
router.post("/addProcedurePackage",AdminController.CreateProcedurepackageCategory)
router.get("/procedureCategory",verifyTokenAndRefresh,AdminController.ProcedurePacakageCategorys)
router.post("/breeds",AdminController.Breeds)
router.get("/breeds",AdminController.Breed)
router.post("/visits",AdminController.PurposeOfVisit)
router.get("/visits",AdminController.PurposeOfVisitList)
router.post("/AppointmentType",AdminController.AppointmentType)
router.get("/AppointmentType",AdminController.Appointments)

export default router;

