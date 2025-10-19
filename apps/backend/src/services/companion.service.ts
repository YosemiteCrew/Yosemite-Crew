import { Types } from 'mongoose'
import CompanionModel, { CompanionDocument, type CompanionMongo } from '../models/companion'
import {
    fromCompanionRequestDTO,
    toCompanionResponseDTO,
    type Companion,
    type CompanionRequestDTO,
    type CompanionDTOAttributes,
    type CompanionType,
    type Gender,
    type RecordStatus,
    type SourceType,
} from '@yosemite-crew/types'

export class CompanionServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'CompanionServiceError'
    }
}

const COMPANION_TYPES: CompanionType[] = ['dog', 'cat', 'horse', 'other']
const RECORD_STATUSES: RecordStatus[] = ['active', 'archived', 'deleted']
const SOURCE_TYPES: SourceType[] = ['shop', 'breeder', 'foster_shelter', 'friends_family', 'unknown']
const GENDERS: Gender[] = ['male', 'female', 'unknown']

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

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
    if (!isNonEmptyString(value)) {
        throw new CompanionServiceError(`${fieldName} is required.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new CompanionServiceError(`${fieldName} cannot be empty.`, 400)
    }

    if (trimmed.includes('$')) {
        throw new CompanionServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalSafeString = (value: unknown, fieldName: string): string | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new CompanionServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return undefined
    }

    if (trimmed.includes('$')) {
        throw new CompanionServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalNumber = (value: unknown, fieldName: string): number | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new CompanionServiceError(`${fieldName} must be a number.`, 400)
    }

    return value
}

const ensureSafeIdentifier = (value: unknown): string | undefined => {
    const identifier = optionalSafeString(value, 'Identifier')

    if (!identifier) {
        return undefined
    }

    if (!Types.ObjectId.isValid(identifier) && !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        throw new CompanionServiceError('Invalid identifier format.', 400)
    }

    return identifier
}

const ensureAllowedValue = <T extends string>(value: string | undefined, allowed: readonly T[], field: string): T | undefined => {
    if (value == null) {
        return undefined
    }

    if (!allowed.includes(value as T)) {
        throw new CompanionServiceError(`Invalid ${field}.`, 400)
    }

    return value as T
}

const toDateOrThrow = (value: unknown, field: string): Date => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new CompanionServiceError(`${field} is required and must be a valid date.`, 400)
    }

    return value
}

const sanitizeCompanionAttributes = (dto: CompanionDTOAttributes): CompanionMongo => {
    const name = requireSafeString(dto.name, 'Companion name')
    const typeValue = requireSafeString(dto.type, 'Companion type')
    const type = ensureAllowedValue(typeValue as CompanionType, COMPANION_TYPES, 'companion type')!
    const genderValue = requireSafeString(dto.gender, 'Companion gender')
    const gender = ensureAllowedValue(genderValue as Gender, GENDERS, 'companion gender')!

    const statusValue = optionalSafeString(dto.status, 'Companion status')
    const status = ensureAllowedValue(statusValue as RecordStatus | undefined, RECORD_STATUSES, 'companion status')
    const sourceValue = optionalSafeString(dto.source, 'Companion source')
    const source = ensureAllowedValue(sourceValue as SourceType | undefined, SOURCE_TYPES, 'companion source')

    const isNeutered = typeof dto.isneutered === 'boolean' ? dto.isneutered : undefined
    const dateOfBirth = toDateOrThrow(dto.dateOfBirth, 'Companion date of birth')

    const isInsured = typeof dto.isInsured === 'boolean' ? dto.isInsured : false

    return {
        fhirId: ensureSafeIdentifier(dto._id),
        name,
        type,
        breed: optionalSafeString(dto.breed, 'Companion breed'),
        dateOfBirth,
        gender,
        photoUrl: optionalSafeString(dto.photoUrl, 'Companion photo URL'),
        currentWeight: optionalNumber(dto.currentWeight, 'Companion current weight'),
        colour: optionalSafeString(dto.colour, 'Companion colour'),
        allergy: optionalSafeString(dto.allergy, 'Companion allergy'),
        bloodGroup: optionalSafeString(dto.bloodGroup, 'Companion blood group'),
        isNeutered,
        ageWhenNeutered: optionalSafeString(dto.ageWhenNeutered, 'Companion age when neutered'),
        microchipNumber: optionalSafeString(dto.microchipNumber, 'Companion microchip number'),
        passportNumber: optionalSafeString(dto.passportNumber, 'Companion passport number'),
        isInsured,
        insurance: null,
        countryOfOrigin: optionalSafeString(dto.countryOfOrigin, 'Companion country of origin'),
        source,
        status,
    }
}

const buildCompanionDomain = (document: CompanionDocument): Companion => {
    const plain = document.toObject({ virtuals: false }) as CompanionMongo & {
        _id: Types.ObjectId
        createdAt?: Date
        updatedAt?: Date
    }

    if (!plain.createdAt || !plain.updatedAt) {
        throw new Error('Companion document is missing timestamps')
    }

    const { _id, fhirId, createdAt, updatedAt, ...rest } = plain

    return {
        _id: fhirId ?? _id.toString(),
        name: rest.name,
        type: rest.type as CompanionType,
        breed: rest.breed ?? '',
        dateOfBirth: rest.dateOfBirth ?? createdAt,
        gender: rest.gender as Gender,
        photoUrl: rest.photoUrl,
        currentWeight: rest.currentWeight,
        colour: rest.colour,
        allergy: rest.allergy,
        bloodGroup: rest.bloodGroup,
        isneutered: rest.isNeutered,
        ageWhenNeutered: rest.ageWhenNeutered,
        microchipNumber: rest.microchipNumber,
        passportNumber: rest.passportNumber,
        isInsured: rest.isInsured ?? false,
        countryOfOrigin: rest.countryOfOrigin,
        source: rest.source as SourceType | undefined,
        status: rest.status as RecordStatus | undefined,
        createdAt,
        updatedAt,
    }
}

const createPersistableFromFHIR = (payload: CompanionRequestDTO) => {
    if (!payload || payload.resourceType !== 'Patient') {
        throw new CompanionServiceError('Invalid payload. Expected FHIR Patient resource.', 400)
    }

    const attributes = fromCompanionRequestDTO(payload)
    const persistable = pruneUndefined(sanitizeCompanionAttributes(attributes))

    return { persistable }
}

const resolveIdQuery = (id: string) => {
    const safeId = ensureSafeIdentifier(id)

    if (!safeId) {
        throw new CompanionServiceError('Invalid companion identifier.', 400)
    }

    return Types.ObjectId.isValid(safeId) ? { _id: safeId } : { fhirId: safeId }
}

export const CompanionService = {
    async create(payload: CompanionRequestDTO) {
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await CompanionModel.create(persistable)
        const companion = buildCompanionDomain(document)
        const response = toCompanionResponseDTO(companion)

        return {
            response,
        }
    },

    async getById(id: string) {
        const document = await CompanionModel.findOne(resolveIdQuery(id))

        if (!document) {
            return null
        }

        const companion = buildCompanionDomain(document)
        return {
            response: toCompanionResponseDTO(companion),
        }
    },

    async update(id: string, payload: CompanionRequestDTO) {
        const { persistable } = createPersistableFromFHIR(payload)
        const document = await CompanionModel.findOneAndUpdate(resolveIdQuery(id), { $set: persistable }, { new: true, sanitizeFilter: true })

        if (!document) {
            return null
        }

        const companion = buildCompanionDomain(document)
        return {
            response: toCompanionResponseDTO(companion),
        }
    },
}
