const express = require('express');
const AdminController = require('../controllers/AdminController');
const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const router = express.Router();


router.get('/planTypes', verifyTokenAndRefresh, AdminController.planTypes);
router.get('/exerciseTypes', verifyTokenAndRefresh, AdminController.exerciseTypes);
router.get('/getExercise', verifyTokenAndRefresh, AdminController.getExercise);

module.exports = router;