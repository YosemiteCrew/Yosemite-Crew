import dotenv from 'dotenv'
dotenv.config()
import { type NextFunction, type Request, type Response } from 'express'
import jwt, {
    JsonWebTokenError,
    type JwtPayload,
    TokenExpiredError,
    type Secret,
    type SignOptions,
} from 'jsonwebtoken'
import type { StringValue } from 'ms'

type PermissionMap = Record<string, string[]>

export interface AuthenticatedUserPayload extends JwtPayload {
    permissions?: PermissionMap
}

export type AuthenticatedRequest = Request & {
    user?: AuthenticatedUserPayload
}

const EXPIRY_PATTERN = /^\d+(?:\s*[a-zA-Z]+)?$/

const resolveExpiry = (value: string | undefined, fallback: string, label: string): StringValue => {
    const resolved = value ?? fallback

    if (!EXPIRY_PATTERN.test(resolved.trim())) {
        throw new Error(`Invalid ${label} format.`)
    }

    return resolved.trim() as StringValue
}

const ACCESS_SECRET = process.env.JWT_SECRET
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const ACCESS_EXPIRY = resolveExpiry(process.env.EXPIRE_IN, '15m', 'access token expiry')
const REFRESH_EXPIRY = resolveExpiry(process.env.EXPIRE_IN_REFRESH, '7d', 'refresh token expiry')
const IS_SECURE_ENV = process.env.NODE_ENV === 'development'

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0

const extractBearerToken = (authorizationHeader: string | undefined): string | undefined => {
    if (!authorizationHeader) {
        return undefined
    }

    const parts = authorizationHeader.split(' ')

    if (parts.length !== 2) {
        return undefined
    }

    const token = parts[1]
    return isNonEmptyString(token) ? token : undefined
}

const getCookieValue = (req: Request, name: string): string | undefined => {
    const cookies: unknown = req.cookies

    if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) {
        return undefined
    }

    const rawValue = (cookies as Record<string, unknown>)[name]
    return isNonEmptyString(rawValue) ? rawValue : undefined
}

const resolveSecret = (secret: string | undefined, name: string): Secret => {
    if (!secret) {
        throw new Error(`${name} is not configured.`)
    }

    return secret
}

const ACCESS_SIGN_OPTIONS: SignOptions = {
    expiresIn: ACCESS_EXPIRY,
}

const REFRESH_SIGN_OPTIONS: SignOptions = {
    expiresIn: REFRESH_EXPIRY,
}

const verifyTokenPayload = (token: string, secret: string | undefined, name: string): JwtPayload => {
    const resolvedSecret = resolveSecret(secret, name)
    const decoded = jwt.verify(token, resolvedSecret)

    if (!decoded || typeof decoded === 'string') {
        throw new JsonWebTokenError('Invalid token payload')
    }

    return decoded
}

const extractStringClaim = (payload: JwtPayload, key: string): string | undefined => {
    const payloadRecord = payload as Record<string, unknown>
    const value = payloadRecord[key]
    return isNonEmptyString(value) ? value : undefined
}

export const verifyTokenAndRefresh = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
        res.status(401).json({ message: 'No token provided' })
        return
    }

    try {
        const decoded = verifyTokenPayload(token, ACCESS_SECRET, 'JWT_SECRET')
        req.user = decoded
        next()
    } catch (error) {
        if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
            res.status(401).json({ message: 'Unauthorized', error: error.message })
            return
        }

        res.status(500).json({ message: 'Token verification failed' })
    }
}

export const getCognitoUserId = (req: Request): string => {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
        throw new Error('Missing token')
    }

    const decoded = verifyTokenPayload(token, ACCESS_SECRET, 'JWT_SECRET')
    const username = extractStringClaim(decoded, 'username')

    if (!username) {
        throw new Error('Missing username in token')
    }

    return username
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const accessToken = getCookieValue(req, 'accessToken')
    const refreshToken = getCookieValue(req, 'refreshToken')

    if (!accessToken && !refreshToken) {
        res.status(401).json({ message: 'No tokens provided' })
        return
    }

    if (accessToken) {
        try {
            const decoded = verifyTokenPayload(accessToken, ACCESS_SECRET, 'JWT_SECRET')
            req.user = decoded
            next()
            return
        } catch (error) {
            if (!(error instanceof TokenExpiredError)) {
                res.status(403).json({ message: 'Invalid access token' })
                return
            }
        }
    }

    if (!refreshToken) {
        res.status(401).json({ message: 'Authentication failed' })
        return
    }

    try {
        const decodedRefresh = verifyTokenPayload(refreshToken, REFRESH_SECRET, 'JWT_REFRESH_SECRET')
        const refreshedPayload: AuthenticatedUserPayload = {
            ...decodedRefresh,
            userId: extractStringClaim(decodedRefresh, 'userId'),
            email: extractStringClaim(decodedRefresh, 'email'),
            userType: extractStringClaim(decodedRefresh, 'userType'),
        }

        const newAccessToken = jwt.sign(refreshedPayload, resolveSecret(ACCESS_SECRET, 'JWT_SECRET'), ACCESS_SIGN_OPTIONS)

        const newRefreshToken = jwt.sign(
            refreshedPayload,
            resolveSecret(REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
            REFRESH_SIGN_OPTIONS
        )

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: IS_SECURE_ENV,
            sameSite: 'strict',
            maxAge: 1000 * 60 * 15,
        })

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: IS_SECURE_ENV,
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60 * 24 * 7,
        })

        req.user = refreshedPayload
        next()
    } catch {
        res.status(403).json({ message: 'Invalid or expired refresh token' })
    }
}
