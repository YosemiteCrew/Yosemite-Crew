import validator from 'validator'
import UserModel, { type UserDocument, type UserMongo } from '../models/user'
import type { User } from '@yosemite-crew/types'

export class UserServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'UserServiceError'
    }
}

type CreateUserPayload = {
    id: unknown
    email: unknown
    isActive?: unknown
}

const requireString = (value: unknown, field: string): string => {
    if (value == null) {
        throw new UserServiceError(`${field} is required.`, 400)
    }

    if (typeof value !== 'string') {
        throw new UserServiceError(`${field} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new UserServiceError(`${field} cannot be empty.`, 400)
    }

    return trimmed
}

const toBoolean = (value: unknown, field: string): boolean => {
    if (value == null) {
        return true
    }

    if (typeof value === 'boolean') {
        return value
    }

    throw new UserServiceError(`${field} must be a boolean.`, 400)
}

const sanitizeUserAttributes = (payload: CreateUserPayload): UserMongo => {
    const userId = requireString(payload.id, 'User id')
    const email = requireString(payload.email, 'Email')

    if (!validator.isEmail(email)) {
        throw new UserServiceError('Invalid email address.', 400)
    }

    const isActive = toBoolean(payload.isActive, 'isActive')

    return {
        userId,
        email: email.toLowerCase(),
        isActive,
    }
}

const toUserDomain = (document: UserDocument): User => {
    const { userId, email, isActive } = document

    return {
        id: userId,
        email,
        isActive,
    }
}

export const UserService = {
    async create(payload: CreateUserPayload): Promise<User> {
        const attributes = sanitizeUserAttributes(payload)

        const existing = await UserModel.findOne({
            $or: [{ userId: attributes.userId }, { email: attributes.email }],
        })

        if (existing) {
            throw new UserServiceError('User with the same id or email already exists.', 409)
        }

        const document = await UserModel.create(attributes)

        return toUserDomain(document)
    },

    async getById(id: unknown): Promise<User | null> {
        const userId = requireString(id, 'User id')

        const document = await UserModel.findOne({ userId })

        if (!document) {
            return null
        }

        return toUserDomain(document)
    },
}
