import { isValidObjectId, Types } from 'mongoose'
import OrganizationModel, {
    type OrganizationDocument,
    type OrganizationMongo,
} from '../models/organization'
import {
    fromOrganizationRequestDTO,
    toOrganizationResponseDTO,
    type OrganizationRequestDTO,
    type OrganizationDTOAttributes,
} from '../../../../packages/types/src/dto/organization.dto'
import { type ToFHIROrganizationOptions } from '../../../../packages/types/src/organization'

const REGISTRATION_NUMBER_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/registrationNumber'
const IMAGE_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/image'

type ExtensionLike = {
    url?: string
    valueString?: string
}

type ExtensionContainer = {
    extension?: ExtensionLike[]
}

export type OrganizationFHIRPayload = OrganizationRequestDTO &
    ExtensionContainer & {
        identifier?: Array<{ value?: string }>
    }

export class OrganizationServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'OrganizationServiceError'
    }
}

const findExtensionValue = (extensions: ExtensionLike[] | undefined, url: string): string | undefined =>
    extensions?.find((item) => item.url === url)?.valueString

const extractRegistrationNumber = (organization: OrganizationFHIRPayload): string | undefined => {
    const fromExtension = findExtensionValue(organization.extension, REGISTRATION_NUMBER_EXTENSION_URL)

    if (fromExtension) {
        return fromExtension
    }

    return organization.identifier?.find((item) => typeof item?.value === 'string')?.value
}

const extractImageUrl = (organization: OrganizationFHIRPayload): string | undefined =>
    findExtensionValue(organization.extension, IMAGE_EXTENSION_URL)

const pruneUndefined = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value
            .map((item) => pruneUndefined(item))
            .filter((item) => item !== undefined) as unknown as T
    }

    if (value && typeof value === 'object') {
        if (value instanceof Date) {
            return value
        }

        return Object.entries(value as Record<string, unknown>).reduce((acc, [key, entryValue]) => {
            const next = pruneUndefined(entryValue)

            if (next !== undefined) {
                acc[key] = next
            }

            return acc
        }, {} as Record<string, unknown>) as T
    }

    return value
}

const requireSafeString = (value: unknown, fieldName: string): string => {
    if (value == null) {
        throw new OrganizationServiceError(`${fieldName} is required.`, 400)
    }

    if (typeof value !== 'string') {
        throw new OrganizationServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        throw new OrganizationServiceError(`${fieldName} cannot be empty.`, 400)
    }

    if (trimmed.includes('$')) {
        throw new OrganizationServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const optionalSafeString = (value: unknown, fieldName: string): string | undefined => {
    if (value == null) {
        return undefined
    }

    if (typeof value !== 'string') {
        throw new OrganizationServiceError(`${fieldName} must be a string.`, 400)
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return undefined
    }

    if (trimmed.includes('$')) {
        throw new OrganizationServiceError(`Invalid character in ${fieldName}.`, 400)
    }

    return trimmed
}

const ensureSafeIdentifier = (value: unknown): string | undefined => {
    const identifier = optionalSafeString(value, 'Identifier')

    if (!identifier) {
        return undefined
    }

    if (!isValidObjectId(identifier) && !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
        throw new OrganizationServiceError('Invalid identifier format.', 400)
    }

    return identifier
}

const sanitizeBusinessAttributes = (
    dto: OrganizationDTOAttributes,
    extras: {
        registrationNo?: string
        imageURL?: string
    }
): OrganizationMongo => {
    const name = requireSafeString(dto.name, 'Organization name')
    const registrationNo = optionalSafeString(extras.registrationNo, 'Registration number')
    const imageURL = optionalSafeString(extras.imageURL, 'Image URL')
    const typeCode = optionalSafeString(dto.typeCoding?.code, 'Organization type code')
    const typeCoding = dto.typeCoding
        ? {
              ...dto.typeCoding,
              code: typeCode,
          }
        : undefined

    const departments = dto.departments?.length
        ? dto.departments.map((department) => ({
              name: optionalSafeString(department?.name, 'Department name'),
              services: department?.services?.map((service) => ({
                  name: optionalSafeString(service?.name, 'Service name'),
                  description: optionalSafeString(service?.description, 'Service description'),
                  estimatedCost: service?.estimatedCost,
                  availability: service?.availability,
                  respnonseTime: service?.respnonseTime,
              })),
          }))
        : undefined

    return {
        fhirId: ensureSafeIdentifier(dto.id),
        name,
        registrationNo,
        imageURL,
        type: typeCode,
        phoneNo: optionalSafeString(dto.phoneNo, 'Phone number'),
        website: optionalSafeString(dto.website, 'Website'),
        country: optionalSafeString(dto.address?.country, 'Country'),
        address: dto.address
            ? {
                  addressLine: optionalSafeString(dto.address.addressLine, 'Address line'),
                  country: optionalSafeString(dto.address.country, 'Address country'),
                  city: optionalSafeString(dto.address.city, 'Address city'),
                  state: optionalSafeString(dto.address.state, 'Address state'),
                  postalCode: optionalSafeString(dto.address.postalCode, 'Postal code'),
                  latitude: dto.address.latitude,
                  longitude: dto.address.longitude,
              }
            : undefined,
        departments,
        isVerified: dto.isVerified,
        typeCoding,
    }
}

const buildFHIRResponse = (
    document: OrganizationDocument,
    options?: ToFHIROrganizationOptions
): ReturnType<typeof toOrganizationResponseDTO> => {
    const { typeCoding, fhirId, __v, ...rest } = document.toObject({ virtuals: false }) as OrganizationMongo & {
        _id: Types.ObjectId
        __v?: number
    }

    const businessInput = {
        ...rest,
        id: fhirId ?? rest?.id ?? document._id.toString(),
        _id: document._id,
    }

    return toOrganizationResponseDTO(businessInput as any, options ?? (typeCoding ? { typeCoding } : undefined))
}

const resolveIdQuery = (id: string) => (Types.ObjectId.isValid(id) ? { _id: id } : { fhirId: id })

const createPersistableFromFHIR = (payload: OrganizationFHIRPayload) => {
    const attributes = fromOrganizationRequestDTO(payload)

    const registrationNo = extractRegistrationNumber(payload)
    const imageURL = extractImageUrl(payload)
    const sanitized = sanitizeBusinessAttributes(attributes, { registrationNo, imageURL })
    const persistable = pruneUndefined(sanitized)

    return { persistable, typeCoding: sanitized.typeCoding, attributes }
}

export const OrganizationService = {
    async upsert(payload: OrganizationFHIRPayload) {
        const { persistable, typeCoding, attributes } = createPersistableFromFHIR(payload)

        const identifier = ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id)
        const query = identifier
            ? isValidObjectId(identifier)
                ? { _id: identifier }
                : { fhirId: identifier }
            : undefined

        let document: OrganizationDocument | null = null
        let created = false

        if (query) {
            document = await OrganizationModel.findOneAndUpdate(
                query,
                { $set: persistable },
                { new: true, sanitizeFilter: true }
            )
        }

        if (!document) {
            document = await OrganizationModel.create(persistable)
            created = true
        }

        const response = buildFHIRResponse(document, typeCoding ? { typeCoding } : undefined)

        return { response, created }
    },

    async getById(id: string) {
        const document = await OrganizationModel.findOne(resolveIdQuery(id))

        if (!document) {
            return null
        }

        return buildFHIRResponse(document)
    },

    async listAll() {
        const documents = await OrganizationModel.find()
        return documents.map((doc) => buildFHIRResponse(doc))
    },

    async deleteById(id: string) {
        const result = await OrganizationModel.findOneAndDelete(resolveIdQuery(id))
        return Boolean(result)
    },

    async update(id: string, payload: OrganizationFHIRPayload) {
        const { persistable, typeCoding } = createPersistableFromFHIR(payload)
        const document = await OrganizationModel.findOneAndUpdate(
            resolveIdQuery(id),
            { $set: persistable },
            { new: true }
        )

        if (!document) {
            return null
        }

        return buildFHIRResponse(document, typeCoding ? { typeCoding } : undefined)
    },
}
