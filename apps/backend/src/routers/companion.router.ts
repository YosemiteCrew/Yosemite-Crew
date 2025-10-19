import { Router } from 'express'
import { CompanionController } from '../controllers/app/companion.controller'

const router = Router()

router.post('/', CompanionController.create)
router.get('/:id', CompanionController.getById)
router.put('/:id', CompanionController.update)

export default router
