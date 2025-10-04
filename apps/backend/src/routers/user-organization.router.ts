import { Router } from 'express'
import { UserOrganizationController } from '../controllers/web/user-organization.controller'

const router = Router()

router.post('/', UserOrganizationController.upsertMapping)
router.get('/:id', UserOrganizationController.getMappingById)
router.get('/', UserOrganizationController.listMappings)
router.delete('/:id', UserOrganizationController.deleteMappingById)
router.put('/:id', UserOrganizationController.updateMappingById)

export default router
