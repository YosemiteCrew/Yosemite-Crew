import express from 'express';
const assessmentsController = require('../controllers/assessmentsController');
const router = express.Router();

const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');

router.get('/assessments', verifyTokenAndRefresh, assessmentsController.getAssessments);
router.put('/assessments', verifyTokenAndRefresh, assessmentsController.getAssessments);




module.exports = router;