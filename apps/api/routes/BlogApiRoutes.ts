import express from 'express';
import BlogController from '../controllers/BlogController';
const router = express.Router();

router.post('/addBlog', BlogController.AddBlog);
router.get('/get-blogs', BlogController.GetBlogs); // ← Add this
router.post('/uploadDescriptionImg', BlogController.uploadDescriptionImg); // ← Add this


export default router;
