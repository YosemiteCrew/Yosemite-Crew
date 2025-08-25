import express from "express";
const router = express.Router();
import createTaskController from "../controllers/create-task";
import { verifyToken } from "../middlewares/authMiddleware";
// Route to create a task
router.post("/createtask",verifyToken, createTaskController.createTask);
router.get("/PractistionarToCreateTask",verifyToken, createTaskController.getDoctorsByDepartmentIdToCreateTask);

export default router;