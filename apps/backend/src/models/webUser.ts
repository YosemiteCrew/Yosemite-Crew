import { Schema, model, type HydratedDocument } from 'mongoose'

type PermissionMap = Record<string, string[]>

export interface WebUserMongo {
    cognitoId: string
    role?: string
    extraPermissions?: PermissionMap
}

const WebUserSchema = new Schema<WebUserMongo>(
    {
        cognitoId: { type: String, required: true, unique: true, trim: true },
        role: { type: String, trim: true },
        extraPermissions: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
)

WebUserSchema.path('extraPermissions').validate((value) => {
    if (!value) {
        return true
    }

    if (typeof value !== 'object') {
        return false
    }

    return Object.values(value as PermissionMap).every(
        (permissions) => Array.isArray(permissions) && permissions.every((action) => typeof action === 'string')
    )
}, 'Invalid permission map.')

export type WebUserDocument = HydratedDocument<WebUserMongo>

export const WebUser = model<WebUserMongo>('WebUser', WebUserSchema)

export default WebUser
