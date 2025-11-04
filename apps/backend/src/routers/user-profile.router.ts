import { Router } from 'express'
import { UserProfileController } from '../controllers/web/user-profile.controller'

const router = Router()

router.post('/', UserProfileController.create)
router.put('/:userId', UserProfileController.update)
router.get('/:userId', UserProfileController.getByUserId)

export default router
