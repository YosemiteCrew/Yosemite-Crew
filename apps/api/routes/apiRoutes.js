const express = require('express');
const assessmentsController = require('../controllers/assessmentsController');
const router = express.Router();

const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');

router.get('/get-assessments', assessmentsController.getAssessments);





module.exports = router;