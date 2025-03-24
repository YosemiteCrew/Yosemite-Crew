const express = require('express');
const authController = require('../controllers/authController');
const WebController = require('../controllers/WebController');
const AddDepartmentController = require('../controllers/addDepartmentController');

const { verifyTokenAndRefresh } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/sendOtp', authController.sendOtp);
router.post('/deleteUser', authController.deleteUser);
router.post('/confirmSignup', authController.confirmSignup);
router.post('/resendConfirmationCode', authController.resendConfirmationCode);
router.post('/register', WebController.Register);
router.post('/verifyUser', WebController.verifyUser);
router.post('/signin', WebController.signIn);
router.post('/forgotPassword', WebController.forgotPassword);
router.post('/verifyotp', WebController.verifyOtp);
router.post('/updatepassword', WebController.updatePassword);
router.post('/organization', WebController.setupProfile);
router.get("/organization/:userId", WebController.getHospitalProfileFHIR)
router.get('/getProfile/:id', WebController.getProfile);
router.post('/signOut', WebController.signOut);
router.delete(
  '/:userId/deleteDocumentsToUpdate/:docId',
  WebController.deleteDocumentsToUpdate
);

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Add Department >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/addDepartment', verifyTokenAndRefresh,AddDepartmentController.addDepartment);
router.get('/getAddDepartment', verifyTokenAndRefresh,AddDepartmentController.getAddDepartment);

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Google Map>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getLocationdata',WebController.getLocationdata); 

module.exports = router;
