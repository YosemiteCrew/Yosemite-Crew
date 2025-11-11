import { isValidObjectId, Types } from 'mongoose'
import OrganisationRoomModel, {
    type OrganisationRoomDocument,
    type OrganisationRoomMongo,
} from '../models/organisation-room'
import {
    fromOrganisationRoomRequestDTO,
    toOrganisationRoomResponseDTO,
    type OrganisationRoomDTOAttributes,
    type OrganisationRoomRequestDTO,
    type OrganisationRoomResponseDTO,
    type OrganisationRoom as OrganisationRoomDomain,
} from '@yosemite-crew/types'

export type OrganisationRoomFHIRPayload = OrganisationRoomRequestDTO

export class OrganisationRoomServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'OrganisationRoomServiceError'
    }
}

const ROOM_TYPES = new Set<OrganisationRoomDomain['type']>([
    'CONSULTATION',
    'WAITING_AREA',
    'SURGERY',
    'ICU',
])

const pruneUndefined = <T>(value: T): T => {
    if (Array.isArray(value)) {
        const cleaned = (value as unknown[])
            .map((item) => pruneUndefined(item))
            .filter((item) => item !== undefined)
        return cleaned as unknown as T
    }

    if (value && typeof value === 'object') {
        if (value instanceof Date) {
            return value
        }

        const record = value as Record<string, unknown>
        const cleanedRecord: Record<string, unknown> = {}

        for (const [key, entryValue] of Object.entries(record)) {
            const next = pruneUndefined(entryValue)

            if (next !== undefined) {
                cleanedRecord[key] = next
            }
        }

        return cleanedRecord as unknown as T
    }

    return value
}

const requireSafeString = (value: unknown, fieldName: string): string => {
    if (value == null) {
        throw new OrganisationRoomServiceError(`${fieldName} is required.`, 400)
    }

    if (typeof value !== 'string') {
        throw new OrganisationRoomServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new OrganisationRoomServiceError(`${fieldName} cannot be empty.`, 400)
    }

    if (trimmed.includes('$')) {
        throw new OrganisationRoomServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalSafeString = (value: unknown, fieldName: string): string | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new OrganisationRoomServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return undefined
    }

    if (trimmed.includes('$')) {
        throw new OrganisationRoomServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const ensureSafeIdentifier = (value: unknown): string | undefined => {
    const identifier = optionalSafeString(value, 'Identifier')

    if (!identifier) {
        return undefined
    }

    if (!isValidObjectId(identifier) && !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        throw new OrganisationRoomServiceError('Invalid identifier format.', 400)
    }

    return identifier
}

const requireOrganizationId = (value: unknown): string => {
    const identifier = requireSafeString(value, 'Organisation identifier')

    if (!isValidObjectId(identifier) && !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        throw new OrganisationRoomServiceError('Invalid organisation identifier format.', 400)
    }

    return identifier
}

const requireRoomType = (value: unknown): OrganisationRoomDomain['type'] => {
    if (typeof value !== 'string') {
        throw new OrganisationRoomServiceError('Room type must be a string.', 400)
    }

    const upper = value.toUpperCase() as OrganisationRoomDomain['type']

    if (!ROOM_TYPES.has(upper)) {
        throw new OrganisationRoomServiceError(
            `Room type must be one of: ${Array.from(ROOM_TYPES).join(', ')}.`,
            400
        )
    }

    return upper
}

const sanitizeIdList = (values: unknown, fieldName: string): string[] | undefined => {
    if (!Array.isArray(values)) {
        return undefined
    }

    const cleaned = values
        .map((value, index) => optionalSafeString(value, `${fieldName} at index ${index}`))
        .filter((value): value is string => Boolean(value))

    return cleaned.length ? cleaned : undefined
}

const sanitizeRoomAttributes = (dto: OrganisationRoomDTOAttributes): OrganisationRoomMongo => {
    const organisationId = requireOrganizationId(dto.organisationId)
    const name = requireSafeString(dto.name, 'Room name')
    const type = requireRoomType(dto.type)

    return {
        fhirId: ensureSafeIdentifier(dto.id),
        organisationId,
        name,
        type,
        assignedSpecialiteis: sanitizeIdList(dto.assignedSpecialiteis, 'Assigned speciality'),
        assignedStaffs: sanitizeIdList(dto.assignedStaffs, 'Assigned staff'),
    }
}

const buildDomainRoom = (document: OrganisationRoomDocument): OrganisationRoomDomain => {
    const { _id, ...rest } = document.toObject({ virtuals: false }) as OrganisationRoomMongo & {
        _id: Types.ObjectId
    }

    return {
        id: rest.fhirId ?? _id.toString(),
        name: rest.name,
        organisationId: rest.organisationId,
        type: rest.type,
        assignedSpecialiteis: rest.assignedSpecialiteis,
        assignedStaffs: rest.assignedStaffs,
    }
}

const buildFHIRResponse = (document: OrganisationRoomDocument): OrganisationRoomResponseDTO =>
    toOrganisationRoomResponseDTO(buildDomainRoom(document))

const createPersistableFromFHIR = (payload: OrganisationRoomFHIRPayload) => {
    if (payload?.resourceType !== 'Location') {
        throw new OrganisationRoomServiceError('Invalid payload. Expected FHIR Location resource.', 400)
    }

    const attributes = fromOrganisationRoomRequestDTO(payload)
    const persistable = pruneUndefined(sanitizeRoomAttributes(attributes))

    return { attributes, persistable }
}

const resolveIdQuery = (id: unknown): { _id?: string; fhirId?: string } => {
    const identifier = optionalSafeString(id, 'Room identifier')

    if (!identifier) {
        throw new OrganisationRoomServiceError('Room identifier is required.', 400)
    }

    if (isValidObjectId(identifier)) {
        return { _id: identifier }
    }

    if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        return { fhirId: identifier }
    }

    throw new OrganisationRoomServiceError('Invalid room identifier format.', 400)
}

export const OrganisationRoomService = {
    async create(payload: OrganisationRoomFHIRPayload) {
        const { persistable, attributes } = createPersistableFromFHIR(payload)

        const identifier = ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id)

        let document: OrganisationRoomDocument | null = null
        let created = false

        if (identifier) {
            document = await OrganisationRoomModel.findOneAndUpdate(
                { fhirId: identifier },
                { $set: persistable },
                { new: true, sanitizeFilter: true }
            )
        }

        if (!document) {
            document = await OrganisationRoomModel.create(persistable)
            created = true
        }

        const response = buildFHIRResponse(document)
        return { response, created }
    },

    async update(id: string, payload: OrganisationRoomFHIRPayload) {
        const query = resolveIdQuery(id)
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await OrganisationRoomModel.findOneAndUpdate(
            query,
            { $set: persistable },
            { new: true, sanitizeFilter: true }
        )

        if (!document) {
            return null
        }

        return buildFHIRResponse(document)
    },

    async getAllByOrganizationId(organisationId: string) {
        const orgId = requireOrganizationId(organisationId)

        const documents = await OrganisationRoomModel.find({ organisationId: orgId }).exec()

        return documents.map(buildFHIRResponse)
    },

    async deleteAllByOrganizationId(organisationId: string) {
        const orgId = requireOrganizationId(organisationId)

        const result = await OrganisationRoomModel.deleteMany({ organisationId: orgId }).exec()
        if (result.acknowledged !== true) {
            throw new OrganisationRoomServiceError('Failed to delete organisation rooms.', 500)
        }
    }
}
