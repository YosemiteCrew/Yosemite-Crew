import { Types } from 'mongoose'
import UserOrganizationModel, {
    type UserOrganizationDocument,
    type UserOrganizationMongo,
} from '../models/user-organization'
import {
    fromUserOrganizationRequestDTO,
    toUserOrganizationResponseDTO,
    type UserOrganizationRequestDTO,
    type UserOrganizationDTOAttributes,
    type UserOrganizationResponseDTO,
    type UserOrganization,
} from '@yosemite-crew/types'

export type UserOrganizationFHIRPayload = UserOrganizationRequestDTO

export class UserOrganizationServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'UserOrganizationServiceError'
    }
}

const pruneUndefined = <T>(value: T): T => {
    if (Array.isArray(value)) {
        const arrayValue = value as unknown[]
        const cleaned: unknown[] = arrayValue
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
        throw new UserOrganizationServiceError(`${fieldName} is required.`, 400)
    }

    if (typeof value !== 'string') {
        throw new UserOrganizationServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new UserOrganizationServiceError(`${fieldName} cannot be empty.`, 400)
    }

    if (trimmed.includes('$')) {
        throw new UserOrganizationServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalSafeString = (value: unknown, fieldName: string): string | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new UserOrganizationServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return undefined
    }

    if (trimmed.includes('$')) {
        throw new UserOrganizationServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const ensureSafeIdentifier = (value: unknown): string | undefined => {
    const identifier = optionalSafeString(value, 'Identifier')

    if (!identifier) {
        return undefined
    }

    if (
        !Types.ObjectId.isValid(identifier) &&
        !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)
    ) {
        throw new UserOrganizationServiceError('Invalid identifier format.', 400)
    }

    return identifier
}

const sanitizeUserOrganizationAttributes = (
    dto: UserOrganizationDTOAttributes
): UserOrganizationMongo => {
    const practitionerReference = requireSafeString(dto.practitionerReference, 'Practitioner reference')
    const organizationReference = requireSafeString(dto.organizationReference, 'Organization reference')
    const roleCode = requireSafeString(dto.roleCode, 'Role code')
    const roleDisplay = optionalSafeString(dto.roleDisplay, 'Role display')

    return {
        fhirId: ensureSafeIdentifier(dto.id),
        practitionerReference,
        organizationReference,
        roleCode,
        roleDisplay,
        active: typeof dto.active === 'boolean' ? dto.active : true,
    }
}

const buildUserOrganizationDomain = (document: UserOrganizationDocument): UserOrganization => {
    const { _id, ...rest } = document.toObject({ virtuals: false }) as UserOrganizationMongo & {
        _id: Types.ObjectId
    }

    return {
        _id,
        fhirId: rest.fhirId,
        practitionerReference: rest.practitionerReference,
        organizationReference: rest.organizationReference,
        roleCode: rest.roleCode,
        roleDisplay: rest.roleDisplay,
        active: rest.active,
    }
}

const createPersistableFromFHIR = (payload: UserOrganizationFHIRPayload) => {
    if (!payload || payload.resourceType !== 'PractitionerRole') {
        throw new UserOrganizationServiceError(
            'Invalid payload. Expected FHIR PractitionerRole resource.',
            400
        )
    }

    const attributes = fromUserOrganizationRequestDTO(payload)
    const persistable = pruneUndefined(sanitizeUserOrganizationAttributes(attributes))

    return { persistable }
}

const resolveIdQuery = (id: string) => (Types.ObjectId.isValid(id) ? { _id: id } : { fhirId: id })

const buildReferenceLookups = (
    id: string
): Array<Record<'practitionerReference' | 'organizationReference', string>> => {
    const trimmed = id.trim()

    if (!trimmed) {
        return []
    }

    const lookups: Array<Record<'practitionerReference' | 'organizationReference', string>> = []
    const seen = new Set<string>()
    const pushLookup = (
        field: 'practitionerReference' | 'organizationReference',
        reference: string
    ) => {
        const key = `${field}:${reference}`
        if (seen.has(key)) {
            return
        }
        seen.add(key)
        lookups.push({ [field]: reference })
    }

    if (trimmed.includes('/')) {
        if (trimmed.startsWith('Practitioner/')) {
            pushLookup('practitionerReference', trimmed)
        } else if (trimmed.startsWith('Organization/')) {
            pushLookup('organizationReference', trimmed)
        } else {
            pushLookup('practitionerReference', trimmed)
            pushLookup('organizationReference', trimmed)
        }
    } else {
        pushLookup('practitionerReference', trimmed)
        pushLookup('organizationReference', trimmed)
        pushLookup('practitionerReference', `Practitioner/${trimmed}`)
        pushLookup('organizationReference', `Organization/${trimmed}`)
    }

    return lookups
}

export const UserOrganizationService = {
    async upsert(payload: UserOrganizationFHIRPayload) {
        const { persistable } = createPersistableFromFHIR(payload)

        const id = ensureSafeIdentifier(payload.id ?? persistable.fhirId)
        let document: UserOrganizationDocument | null = null
        let created = false

        if (id) {
            document = await UserOrganizationModel.findOneAndUpdate(
                resolveIdQuery(id),
                { $set: persistable },
                { new: true, sanitizeFilter: true }
            )
        }

        if (!document) {
            const existing = await UserOrganizationModel.findOne({
                practitionerReference: persistable.practitionerReference,
                organizationReference: persistable.organizationReference,
                roleCode: persistable.roleCode,
            }).setOptions({ sanitizeFilter: true })

            if (existing) {
                document = await UserOrganizationModel.findOneAndUpdate(
                    { _id: existing._id },
                    { $set: persistable },
                    { new: true, sanitizeFilter: true }
                )
            } else {
                document = await UserOrganizationModel.create(persistable)
                created = true
            }
        }

        if (!document) {
            throw new UserOrganizationServiceError('Unable to persist user-organization mapping.', 500)
        }

        const mapping = buildUserOrganizationDomain(document)
        return {
            response: toUserOrganizationResponseDTO(mapping),
            created,
        }
    },

    async create(payload: UserOrganizationFHIRPayload) {
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await UserOrganizationModel.create(persistable)
        const mapping = buildUserOrganizationDomain(document)

        return toUserOrganizationResponseDTO(mapping)
    },

    async getById(id: string): Promise<UserOrganizationResponseDTO | UserOrganizationResponseDTO[] | null> {
        const document = await UserOrganizationModel.findOne(resolveIdQuery(id))

        if (!document) {
            const referenceQueries = buildReferenceLookups(id)

            if (referenceQueries.length) {
                const documents = await UserOrganizationModel.find({ $or: referenceQueries })

                if (!documents.length) {
                    return null
                }

                if (documents.length === 1) {
                    const mapping = buildUserOrganizationDomain(documents[0])
                    return toUserOrganizationResponseDTO(mapping)
                }

                const mappings = documents.map((doc) => buildUserOrganizationDomain(doc))
                return mappings.map((mapping) => toUserOrganizationResponseDTO(mapping))
            }
        }

        if (!document) {
            return null
        }

        const mapping = buildUserOrganizationDomain(document)
        return toUserOrganizationResponseDTO(mapping)
    },

    async listAll() {
        const documents = await UserOrganizationModel.find()
        const mappings = documents.map((document) => buildUserOrganizationDomain(document))

        return mappings.map((mapping) => toUserOrganizationResponseDTO(mapping))
    },

    async deleteById(id: string) {
        const result = await UserOrganizationModel.findOneAndDelete(resolveIdQuery(id))
        return Boolean(result)
    },

    async update(id: string, payload: UserOrganizationFHIRPayload) {
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await UserOrganizationModel.findOneAndUpdate(
            resolveIdQuery(id),
            { $set: persistable },
            { new: true }
        )

        if (!document) {
            return null
        }

        const mapping = buildUserOrganizationDomain(document)
        return toUserOrganizationResponseDTO(mapping)
    },
}
