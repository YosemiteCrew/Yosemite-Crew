import { Router } from 'express';
import authController from '../controllers/auth-controller';
import WebController from '../controllers/WebController';
import AddDepartmentController from '../controllers/AddDepartmentController';

import { verifyTokenAndRefresh } from'../middlewares/authMiddleware';
const router = Router();

// router.post('/signup', authController.signup);
 router.post('/login', authController.login);
 router.post('/sendOtp', authController.sendOtp);
// router.post('/deleteUser', authController.deleteUser);
// router.post('/confirmSignup', authController.confirmSignup);
// router.post('/resendConfirmationCode', authController.resendConfirmationCode);
router.post('/register', WebController.Register);
router.post('/verifyUser', WebController.verifyUser);
router.post('/signin', WebController.signIn);
router.post('/forgotPassword', WebController.forgotPassword);
router.post('/verifyotp', WebController.verifyOtp);
// router.post('/updatepassword', WebController.updatePassword);
router.post('/organization', WebController.setupProfile);
router.get("/organization/", WebController.getHospitalProfileFHIR)
// router.get('/getProfile/:id', WebController.getProfile);
router.post('/signOut', WebController.signOut);
router.delete(
  '/:userId/deleteDocumentsToUpdate/:docId',
  WebController.deleteDocumentsToUpdate
);
router.post('/refreshToken', WebController.refreshToken);
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Add Department >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/HealthcareService', verifyTokenAndRefresh,AddDepartmentController.addDepartment);
router.get('/getAddDepartment', verifyTokenAndRefresh,AddDepartmentController.getAddDepartment);

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Google Map>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// router.get('/getLocationdata',WebController.getLocationdata); 

export default router;
