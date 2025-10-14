import { Request, Response } from 'express'
import logger from '../../utils/logger'
import { UserService, UserServiceError, type CreateUserPayload } from '../../services/user.service'

type CreateUserRequest = Request<Record<string, string | undefined>, unknown, unknown>
type GetUserRequest = Request<{ id: string }>

export const UserController = {
    create: async (req: CreateUserRequest, res: Response) => {
        try {
            const requestBody: unknown = req.body

            if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
                res.status(400).json({ message: 'Invalid request body.' })
                return
            }

            const user = await UserService.create(requestBody as CreateUserPayload)
            res.status(201).json(user)
        } catch (error: unknown) {
            if (error instanceof UserServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }

            logger.error('Failed to create user', error)
            res.status(500).json({ message: 'Unable to create user.' })
        }
    },

    getById: async (req: GetUserRequest, res: Response) => {
        try {
            const user = await UserService.getById(req.params?.id)

            if (!user) {
                res.status(404).json({ message: 'User not found.' })
                return
            }

            res.status(200).json(user)
        } catch (error: unknown) {
            if (error instanceof UserServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }

            logger.error('Failed to retrieve user', error)
            res.status(500).json({ message: 'Unable to retrieve user.' })
        }
    },
}
