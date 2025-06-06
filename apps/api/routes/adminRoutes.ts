import express from 'express';
import AdminController from '../controllers/AdminController';
import  { verifyTokenAndRefresh }  from '../middlewares/authMiddleware';
const router = express.Router();


router.get('/planTypes', verifyTokenAndRefresh, AdminController.planTypes);
router.get('/exerciseTypes', verifyTokenAndRefresh, AdminController.exerciseTypes);
router.get('/getExercise', verifyTokenAndRefresh, AdminController.getExercise);

export default router;