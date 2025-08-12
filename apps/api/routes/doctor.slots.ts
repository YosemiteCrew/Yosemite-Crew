import  express  from "express";
import { DoctorSlots } from "../controllers/doctor-slots";
import { verifyToken } from "../middlewares/authMiddleware";

const router = express.Router();

// Route to add doctor's slots
router.post("/addDoctorsSlots",verifyToken, DoctorSlots.AddDoctorsSlote);
router.get("/doctorslottocompare", verifyToken, DoctorSlots.getDoctorSloteToCompare);
router.get("/getDoctorSlots", verifyToken, DoctorSlots.getDoctoSlots);
router.get("/getDoctoSlotsToBookAppointment",verifyToken, DoctorSlots.getDoctoSlotsToBookAppointment)


export default router;