import { Request, Response } from 'express'
import logger from '../../utils/logger'
import {
    UserOrganizationService,
    UserOrganizationServiceError,
    type UserOrganizationFHIRPayload,
} from '../../services/user-organization.service'

export const UserOrganizationController = {
    upsertMapping: async (req: Request, res: Response) => {
        try {
            const payload = req.body as UserOrganizationFHIRPayload | undefined

            if (!payload || payload.resourceType !== 'PractitionerRole') {
                res.status(400).json({ message: 'Invalid payload. Expected FHIR PractitionerRole resource.' })
                return
            }

            const { response, created } = await UserOrganizationService.upsert(payload)
            res.status(created ? 201 : 200).json(response)
        } catch (error) {
            if (error instanceof UserOrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to persist user-organization mapping', error)
            res.status(500).json({ message: 'Unable to persist user-organization mapping.' })
        }
    },

    getMappingById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Mapping ID is required.' })
                return
            }

            const resource = await UserOrganizationService.getById(id)

            if (!resource || (Array.isArray(resource) && resource.length === 0)) {
                res.status(404).json({ message: 'Mapping not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            logger.error('Failed to retrieve user-organization mapping', error)
            res.status(500).json({ message: 'Unable to retrieve user-organization mapping.' })
        }
    },

    listMappings: async (_req: Request, res: Response) => {
        try {
            const resources = await UserOrganizationService.listAll()
            res.status(200).json(resources)
        } catch (error) {
            logger.error('Failed to list user-organization mappings', error)
            res.status(500).json({ message: 'Unable to list user-organization mappings.' })
        }
    },

    deleteMappingById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Mapping ID is required.' })
                return
            }

            const deleted = await UserOrganizationService.deleteById(id)

            if (!deleted) {
                res.status(404).json({ message: 'Mapping not found.' })
                return
            }

            res.status(200).json({ message: 'Mapping deleted successfully.' })
        } catch (error) {
            logger.error('Failed to delete user-organization mapping', error)
            res.status(500).json({ message: 'Unable to delete user-organization mapping.' })
        }
    },

    updateMappingById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params
            const payload = req.body as UserOrganizationFHIRPayload | undefined

            if (!id) {
                res.status(400).json({ message: 'Mapping ID is required.' })
                return
            }

            if (!payload || payload.resourceType !== 'PractitionerRole') {
                res.status(400).json({ message: 'Invalid payload. Expected FHIR PractitionerRole resource.' })
                return
            }

            const resource = await UserOrganizationService.update(id, payload)

            if (!resource) {
                res.status(404).json({ message: 'Mapping not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            if (error instanceof UserOrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to update user-organization mapping', error)
            res.status(500).json({ message: 'Unable to update user-organization mapping.' })
        }
    },
}
