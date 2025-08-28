import express from 'express';  
import SupportController from '../controllers/support-controller';

const router = express.Router(); 
 
 
router.post('/request-support', SupportController.requestSupport); 
export default router;