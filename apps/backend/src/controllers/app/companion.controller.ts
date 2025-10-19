import { Request, Response } from 'express'
import logger from '../../utils/logger'
import { CompanionService, CompanionServiceError } from '../../services/companion.service'
import type { CompanionRequestDTO } from '@yosemite-crew/types'

const parseCompanionPayload = (payload: unknown): CompanionRequestDTO | undefined => {
    if (!payload) {
        return undefined
    }

    if (typeof payload === 'string') {
        const trimmed = payload.trim()

        if (!trimmed) {
            return undefined
        }

        try {
            return JSON.parse(trimmed) as CompanionRequestDTO
        } catch {
            throw new CompanionServiceError('Invalid JSON payload for companion.', 400)
        }
    }

    if (typeof payload === 'object') {
        return payload as CompanionRequestDTO
    }

    return undefined
}

const extractCompanionPayload = (req: Request): CompanionRequestDTO => {
    const body = req.body as Record<string, unknown> | undefined

    if (!body) {
        throw new CompanionServiceError('Request body is required.', 400)
    }

    const candidate = 'payload' in body ? body.payload : body
    const payload = parseCompanionPayload(candidate)

    if (!payload) {
        throw new CompanionServiceError('Companion payload is required.', 400)
    }

    return payload
}

export const CompanionController = {
    create: async (req: Request, res: Response) => {
        try {
            const payload = extractCompanionPayload(req)
            const { response } = await CompanionService.create(payload)
            res.status(201).json(response)
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to create companion', error)
            res.status(500).json({ message: 'Unable to create companion.' })
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Companion ID is required.' })
                return
            }

            const result = await CompanionService.getById(id)

            if (!result) {
                res.status(404).json({ message: 'Companion not found.' })
                return
            }

            res.status(200).json(result.response)
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to fetch companion', error)
            res.status(500).json({ message: 'Unable to fetch companion.' })
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Companion ID is required.' })
                return
            }

            const payload = extractCompanionPayload(req)
            const result = await CompanionService.update(id, payload)

            if (!result) {
                res.status(404).json({ message: 'Companion not found.' })
                return
            }

            res.status(200).json(result.response)
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to update companion', error)
            res.status(500).json({ message: 'Unable to update companion.' })
        }
    },
}
