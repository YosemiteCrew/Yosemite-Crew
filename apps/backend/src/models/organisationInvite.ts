import { randomBytes } from 'node:crypto'

import { Schema, model, type HydratedDocument, type Model, type UpdateQuery } from 'mongoose'
import type { InviteStatus, OrganisationInvite } from '@yosemite-crew/types'

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const INVITE_TOKEN_BYTES = 32

export type OrganisationInviteMongo = OrganisationInvite

export type OrganisationInviteDocument = HydratedDocument<OrganisationInviteMongo>

export interface CreateOrganisationInviteInput {
    organisationId: string
    invitedByUserId: string
    departmentId: string
    inviteeEmail: string
    inviteeName?: string
    role: string
    employmentType?: OrganisationInvite['employmentType']
}

export interface OrganisationInviteModel extends Model<OrganisationInviteMongo> {
    createOrReplaceInvite(input: CreateOrganisationInviteInput): Promise<OrganisationInviteDocument>
    findValidInviteByToken(token: string, referenceDate?: Date): Promise<OrganisationInviteDocument | null>
    expireStaleInvites(referenceDate?: Date): Promise<number>
    generateToken(byteLength?: number): string
}

const OrganisationInviteSchema = new Schema<OrganisationInviteMongo, OrganisationInviteModel>(
    {
        organisationId: { type: String, required: true, index: true },
        invitedByUserId: { type: String, required: true },
        departmentId: { type: String, required: true },
        inviteeEmail: { type: String, required: true, trim: true, lowercase: true },
        inviteeName: { type: String, trim: true },
        role: { type: String, required: true },
        employmentType: {
            type: String,
            enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'],
        },
        token: { type: String, required: true, unique: true, index: true },
        status: {
            type: String,
            enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
            required: true,
            default: 'PENDING',
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + INVITE_TTL_MS),
            index: true,
        },
        acceptedAt: { type: Date },
    },
    {
        timestamps: true,
    }
)

OrganisationInviteSchema.index(
    { organisationId: 1, inviteeEmail: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'PENDING' },
    }
)

OrganisationInviteSchema.statics.generateToken = function generateToken(byteLength: number = INVITE_TOKEN_BYTES) {
    return randomBytes(byteLength).toString('hex')
}

OrganisationInviteSchema.statics.createOrReplaceInvite = async function createOrReplaceInvite(
    input: CreateOrganisationInviteInput
) {
    const token = this.generateToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
    const normalizedEmail = input.inviteeEmail.trim().toLowerCase()

    const updateFields: OrganisationInviteMongo = {
        ...input,
        inviteeEmail: normalizedEmail,
        token,
        status: 'PENDING',
        expiresAt,
        acceptedAt: undefined,
    }
    const updatePayload: UpdateQuery<OrganisationInviteMongo> = {
        $set: updateFields,
    }
    const invite = await this.findOneAndUpdate(
        { organisationId: input.organisationId, inviteeEmail: normalizedEmail },
        updatePayload,
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    )

    return invite
}

OrganisationInviteSchema.statics.findValidInviteByToken = function findValidInviteByToken(
    token: string,
    referenceDate: Date = new Date()
) {
    return this.findOne({
        token,
        status: 'PENDING',
        expiresAt: { $gt: referenceDate },
    })
}

OrganisationInviteSchema.statics.expireStaleInvites = async function expireStaleInvites(referenceDate: Date = new Date()) {
    const result = await this.updateMany(
        {
            status: 'PENDING',
            expiresAt: { $lte: referenceDate },
        },
        {
            $set: { status: 'EXPIRED' as InviteStatus },
        }
    )

    if (typeof result.modifiedCount === 'number') {
        return result.modifiedCount
    }

    const legacyResult = result as { nModified?: number }
    if (typeof legacyResult.nModified === 'number') {
        return legacyResult.nModified
    }

    return 0
}

const OrganisationInviteModel = model<OrganisationInviteMongo, OrganisationInviteModel>(
    'OrganisationInvite',
    OrganisationInviteSchema
)

export default OrganisationInviteModel
