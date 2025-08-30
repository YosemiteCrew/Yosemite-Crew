import { Router } from 'express';
import authController from '../controllers/auth-controller';
import WebController from '../controllers/WebController';
import AddDepartmentController from '../controllers/add-department-controller';

import { verifyToken, verifyTokenAndRefresh } from'../middlewares/authMiddleware';
const router = Router();

router.post('/signup', authController.signUp);
 router.post('/login', authController.login);
 router.post('/sendOtp', authController.sendOtp);
router.post('/deleteUser', authController.deleteUser);
router.post('/confirmSignup', authController.confirmSignup);
router.post('/logout', authController.logout);
router.post('/resendConfirmationCode', authController.resendConfirmationCode);
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
// router.delete(
//   '/:userId/deleteDocumentsToUpdate/:docId',
//   WebController.deleteDocumentsToUpdate
// );
router.post('/refreshToken', WebController.refreshToken);

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Add Department >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/HealthcareService', verifyToken,AddDepartmentController.addDepartment);
router.get('/getAddDepartment', verifyToken,AddDepartmentController.getAddDepartment);
router.post('/social-login', authController.socialLogin)
// router.get('/getAddDepartment', verifyToken,AddDepartmentController.getAddDepartment);
router.get('/getDepartments',verifyToken,AddDepartmentController.getDepartmets)
router.get('/getDepartmentAllData',verifyToken,AddDepartmentController.getDepartmentById)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Google Map>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getDepartmentsList',WebController.getDepartmentsList); 
router.get('/getDepartmentsOfBusiness',WebController.getDepartmentsOfBusiness); 

//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Profile >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
router.get('/getProfileDetail',verifyTokenAndRefresh, authController.getProfileDetail)
router.put('/updateProfileDetail', verifyTokenAndRefresh, authController.updateProfileDetail)
router.post('/deleteAccountWithToken',verifyTokenAndRefresh, authController.deleteUserAccountUsingToken)
router.post('/app-refreshToken', authController.refreshToken)
router.post('/withdrawRequestForm',verifyTokenAndRefresh, authController.withdrawRequestForm)
export default router;
