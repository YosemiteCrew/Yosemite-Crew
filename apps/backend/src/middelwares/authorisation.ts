import { type NextFunction, type Response } from 'express'
import { WebUser as User } from '../models/webUser'
import { Role } from '../models/role'
import type { AuthenticatedRequest, AuthenticatedUserPayload } from './authMiddleware'

type PermissionMap = Record<string, string[]>

type WebUserRecord = {
    role?: unknown
    extraPermissions?: unknown
}

type RoleRecord = {
    permissions?: unknown
}

type WebUserModelType = {
    findOne(filter: Record<string, unknown>): Promise<unknown>
}

type RoleModelType = {
    findOne(filter: Record<string, unknown>): Promise<unknown>
}

const WebUserModel = User as unknown as WebUserModelType
const RoleModel = Role as unknown as RoleModelType

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')

const isPermissionMap = (value: unknown): value is PermissionMap => {
    if (!value || typeof value !== 'object') {
        return false
    }

    return Object.values(value as Record<string, unknown>).every((actions) => isStringArray(actions))
}

const isWebUserRecord = (value: unknown): value is WebUserRecord =>
    Boolean(value && typeof value === 'object')

const isRoleRecord = (value: unknown): value is RoleRecord =>
    Boolean(value && typeof value === 'object')

const extractSub = (user: AuthenticatedUserPayload | undefined): string | undefined => {
    if (!user) {
        return undefined
    }

    if (isNonEmptyString(user.sub)) {
        return user.sub
    }

    const extendedClaims = user as Record<string, unknown>
    const cognitoUsername = extendedClaims['cognito:username']
    return isNonEmptyString(cognitoUsername) ? cognitoUsername : undefined
}

const mergePermissions = (target: PermissionMap, source: PermissionMap) => {
    for (const [resource, actions] of Object.entries(source)) {
        const existing = target[resource] ?? []
        const nextActions = new Set(existing)
        for (const action of actions) {
            nextActions.add(action)
        }
        target[resource] = Array.from(nextActions)
    }
}

export async function loadPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userPayload = req.user

    if (!userPayload) {
        res.status(401).json({ message: 'Unauthorized' })
        return
    }

    const cognitoId = extractSub(userPayload)

    if (!cognitoId) {
        res.status(401).json({ message: 'User identifier missing from token' })
        return
    }

    const userResult: unknown = await WebUserModel.findOne({ cognitoId })

    if (!isWebUserRecord(userResult) || !isNonEmptyString(userResult.role)) {
        res.status(403).json({ message: 'User not found' })
        return
    }

    const roleResult: unknown = await RoleModel.findOne({ name: userResult.role })

    if (!isRoleRecord(roleResult) || !isPermissionMap(roleResult.permissions)) {
        res.status(403).json({ message: 'Role not found' })
        return
    }

    const mergedPermissions: PermissionMap = {}

    mergePermissions(mergedPermissions, roleResult.permissions)

    if (isPermissionMap(userResult.extraPermissions)) {
        mergePermissions(mergedPermissions, userResult.extraPermissions)
    }

    req.user = {
        ...userPayload,
        permissions: mergedPermissions,
    }

    next()
}

export function authorize(resource: string, action: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const permissions = req.user?.permissions?.[resource]

        if (!Array.isArray(permissions) || !permissions.includes(action)) {
            res.status(403).json({ message: 'Forbidden' })
            return
        }

        next()
    }
}
