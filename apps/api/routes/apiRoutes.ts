import express from 'express';
import assessmentsController from '../controllers/assessmentsController';
const router = express.Router();

import { verifyTokenAndRefresh }  from '../middlewares/authMiddleware';

router.get('/assessments',verifyTokenAndRefresh, assessmentsController.getAssessments);
router.put('/assessments',verifyTokenAndRefresh, assessmentsController.getAssessments);

export default router;