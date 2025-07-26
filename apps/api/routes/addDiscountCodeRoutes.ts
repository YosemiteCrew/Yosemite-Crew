import express from 'express';
import { createDiscount, deleteDiscount, getAllDiscounts, toggleDiscountStatus, updateDiscount } from '../controllers/discount-controller';
const router = express.Router();


router.post('/addDiscountCoupon', createDiscount);
router.get('/allDiscountCoupon', getAllDiscounts);
router.post('/updateCoupon/:id', updateDiscount);
router.post('/toggle/:id', toggleDiscountStatus);
router.delete('/delete/:id', deleteDiscount);

export default router;