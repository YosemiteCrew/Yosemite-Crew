import express from 'express';
import multer from 'multer';
import { verifyTokenAndRefresh } from '../middlewares/authMiddleware';
import NewsletterController from '../controllers/NewsletterController';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') cb(null, true);
    else cb(null, false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

router.get('/check-email', NewsletterController.checkEmail);
router.post('/check-email', verifyTokenAndRefresh, NewsletterController.checkEmailAuth);
router.post('/subscribe', NewsletterController.subscribe);
router.post('/unsubscribe', NewsletterController.unsubscribe)
router.post('/upload-batch', upload.single('file'), NewsletterController.batchUpload);

module.exports = router;