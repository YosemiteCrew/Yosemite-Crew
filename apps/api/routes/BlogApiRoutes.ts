import express from 'express';
import InventoryControllers from '../controllers/InventoryController';
import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
import BlogController from '../controllers/BlogController';
const router = express.Router();

router.post('/addBlog', BlogController.AddBlog);
router.get('/get-blogs', BlogController.GetBlogs); // ← Add this


export default router;
