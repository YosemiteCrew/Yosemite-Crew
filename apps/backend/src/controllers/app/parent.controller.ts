import { Request, Response } from 'express'
import logger from '../../utils/logger'
import { ParentService, ParentServiceError } from '../../services/parent.service'
import type { ParentRequestDTO } from '../../../../../packages/types/src/dto/parent.dto'

export const ParentController = {
    create: async (req: Request, res: Response) => {
        try {
            const payload = req.body as ParentRequestDTO | undefined

            if (!payload) {
                res.status(400).json({ message: 'Request body is required.' })
                return
            }

            const resource = await ParentService.create(payload)
            res.status(201).json(resource)
        } catch (error) {
            if (error instanceof ParentServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to create parent', error)
            res.status(500).json({ message: 'Unable to create parent.' })
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Parent ID is required.' })
                return
            }

            const resource = await ParentService.getById(id)

            if (!resource) {
                res.status(404).json({ message: 'Parent not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            logger.error('Failed to retrieve parent', error)
            res.status(500).json({ message: 'Unable to retrieve parent.' })
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params
            const payload = req.body as ParentRequestDTO | undefined

            if (!id) {
                res.status(400).json({ message: 'Parent ID is required.' })
                return
            }

            if (!payload) {
                res.status(400).json({ message: 'Request body is required.' })
                return
            }

            const resource = await ParentService.update(id, payload)

            if (!resource) {
                res.status(404).json({ message: 'Parent not found.' })
                return
            }

            res.status(200).json(resource)
        } catch (error) {
            if (error instanceof ParentServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to update parent', error)
            res.status(500).json({ message: 'Unable to update parent.' })
        }
    },
}
