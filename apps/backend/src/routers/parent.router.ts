import { Router } from 'express'
import { ParentController } from '../controllers/app/parent.controller'

const router = Router()

router.post('/', ParentController.create)
router.get('/:id', ParentController.getById)
router.put('/:id', ParentController.update)

export default router
