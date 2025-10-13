import { Request, Response } from 'express'
import logger from '../../utils/logger'
import { UserService, UserServiceError } from '../../services/user.service'

export const UserController = {
    create: async (req: Request, res: Response) => {
        try {
            const user = await UserService.create(req.body)
            res.status(201).json(user)
        } catch (error) {
            if (error instanceof UserServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }

            logger.error('Failed to create user', error)
            res.status(500).json({ message: 'Unable to create user.' })
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const user = await UserService.getById(req.params?.id)

            if (!user) {
                res.status(404).json({ message: 'User not found.' })
                return
            }

            res.status(200).json(user)
        } catch (error) {
            if (error instanceof UserServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }

            logger.error('Failed to retrieve user', error)
            res.status(500).json({ message: 'Unable to retrieve user.' })
        }
    },
}
