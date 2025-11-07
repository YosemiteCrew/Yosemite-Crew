import { Router } from 'express'
import { OrganisationRoomController } from '../controllers/web/organisation-room.controller'

const router = Router()

router.post('/', OrganisationRoomController.create)
router.put('/:id', OrganisationRoomController.update)
router.get('/organization/:organizationId', OrganisationRoomController.getAllByOrganizationId)

export default router
