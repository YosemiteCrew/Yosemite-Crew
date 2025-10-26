import { Schema, model, type HydratedDocument } from 'mongoose'

type PermissionMap = Record<string, string[]>

export interface RoleMongo {
    name: string
    permissions?: PermissionMap
}

const RoleSchema = new Schema<RoleMongo>(
    {
        name: { type: String, required: true, unique: true, trim: true },
        permissions: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
)

RoleSchema.path('permissions').validate((value) => {
    if (!value) {
        return true
    }

    if (typeof value !== 'object') {
        return false
    }

    return Object.values(value as PermissionMap).every(
        (actions) => Array.isArray(actions) && actions.every((action) => typeof action === 'string')
    )
}, 'Invalid permissions map.')

export type RoleDocument = HydratedDocument<RoleMongo>

export const Role = model<RoleMongo>('Role', RoleSchema)

export default Role
