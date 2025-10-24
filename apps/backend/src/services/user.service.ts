import validator from 'validator'
import UserModel, { type UserDocument, type UserMongo } from '../models/user'

export class UserServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'UserServiceError'
    }
}

export type CreateUserPayload = {
    id: unknown
    email: unknown
    isActive?: unknown
}

const forbidQueryOperators = (input: string, field: string) => {
    if (input.includes('$')) {
        throw new UserServiceError(`Invalid character in ${field}.`, 400)
    }
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

    forbidQueryOperators(trimmed, field)

    return trimmed
}

const requireSafeIdentifier = (value: unknown, field: string): string => {
    const identifier = requireString(value, field)

    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(identifier)) {
        throw new UserServiceError(`Invalid ${field} format.`, 400)
    }

    return identifier
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
    const userId = requireSafeIdentifier(payload.id, 'User id')
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

type UserDomain = {
    id: string
    email: string
    isActive: boolean
}

const toUserDomain = (document: UserDocument): UserDomain => {
    const { userId, email, isActive } = document

    return {
        id: userId,
        email,
        isActive,
    }
}

export const UserService = {
    async create(payload: CreateUserPayload): Promise<UserDomain> {
        const attributes = sanitizeUserAttributes(payload)

        const existingById = await UserModel.findOne()
            .where('userId')
            .equals(attributes.userId)
            .setOptions({ sanitizeFilter: true })

        if (existingById) {
            throw new UserServiceError('User with the same id or email already exists.', 409)
        }

        const existingByEmail = await UserModel.findOne()
            .where('email')
            .equals(attributes.email)
            .setOptions({ sanitizeFilter: true })

        if (existingByEmail) {
            throw new UserServiceError('User with the same id or email already exists.', 409)
        }

        const document = await UserModel.create({
            userId: attributes.userId,
            email: attributes.email,
            isActive: attributes.isActive,
        })

        return toUserDomain(document)
    },

    async getById(id: unknown): Promise<UserDomain | null> {
        const userId = requireSafeIdentifier(id, 'User id')

        const document = await UserModel.findOne()
            .where('userId')
            .equals(userId)
            .setOptions({ sanitizeFilter: true })

        if (!document) {
            return null
        }

        return toUserDomain(document)
    },
}

export type { UserDomain as User }
