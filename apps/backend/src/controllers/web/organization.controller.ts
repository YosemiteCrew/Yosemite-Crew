import { Request, Response } from 'express'
import logger from '../../utils/logger'
import {
    OrganizationService,
    OrganizationServiceError,
    type OrganizationFHIRPayload,
} from '../../services/organization.service'
import { AuthenticatedRequest } from '../../middlewares/auth'

const resolveUserIdFromRequest = (req: Request): string | undefined => {
    const authRequest = req as AuthenticatedRequest
    const headerUserId = req.headers['x-user-id']
    if (headerUserId && typeof headerUserId === 'string') {
        return headerUserId
    }
    return authRequest.userId
}

export const OrganizationController = {
    onboardBusiness: async (req: Request, res: Response) => {
        try {
            const payload = req.body as OrganizationFHIRPayload | undefined

            if (!payload || payload.resourceType !== 'Organization') {
                res.status(400).json({ message: 'Invalid payload. Expected FHIR Organization resource.' })
                return
            }
            const userId = resolveUserIdFromRequest(req)
            const { response, created } = await OrganizationService.upsert(payload, userId)
            res.status(created ? 201 : 200).json(response)
        } catch (error) {
            if (error instanceof OrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to onboard business', error)
            res.status(500).json({ message: 'Unable to onboard business.' })
        }
    },

    getBusinessById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Business ID is required.' })
                return
            }

            const resource = await OrganizationService.getById(id)

            if (!resource) {
                res.status(404).json({ message: 'Business not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            if (error instanceof OrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to retrieve business', error)
            res.status(500).json({ message: 'Unable to retrieve business.' })
        }
    },

    getAllBusinesses: async (_req: Request, res: Response) => {
        try {
            const resources = await OrganizationService.listAll()
            res.status(200).json(resources)
        } catch (error) {
            logger.error('Failed to retrieve businesses', error)
            res.status(500).json({ message: 'Unable to retrieve businesses.' })
        }
    },

    deleteBusinessById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Business ID is required.' })
                return
            }

            const deleted = await OrganizationService.deleteById(id)

            if (!deleted) {
                res.status(404).json({ message: 'Business not found.' })
                return
            }

            res.status(200).json({ message: 'Business deleted successfully.' })
        } catch (error) {
            if (error instanceof OrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to delete business', error)
            res.status(500).json({ message: 'Unable to delete business.' })
        }
    },

    updateBusinessById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params
            const payload = req.body as OrganizationFHIRPayload | undefined
            
            if (!id) {
                res.status(400).json({ message: 'Business ID is required.' })
                return
            }
            if (!payload || payload.resourceType !== 'Organization') {
                res.status(400).json({ message: 'Invalid payload. Expected FHIR Organization resource.' })
                return
            }
            
            const resource = await OrganizationService.update(id, payload)

            if (!resource) {
                res.status(404).json({ message: 'Business not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            if (error instanceof OrganizationServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to update business', error)
            res.status(500).json({ message: 'Unable to update business.' })
        }
    }
}
