import { Router } from 'express'
import { UserController } from '../controllers/web/user.controller'

const router = Router()

router.post('/', UserController.create)
router.get('/:id', UserController.getById)

export default router
