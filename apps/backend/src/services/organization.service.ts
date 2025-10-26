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
    type Organization,
    type ToFHIROrganizationOptions,
} from '@yosemite-crew/types'

const REGISTRATION_NUMBER_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/registrationNumber'
const IMAGE_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/image'
const ORGANIZATION_TYPES = new Set<NonNullable<Organization["type"]>>([
  "Veterinary Business",
  "Groomer Shop",
  "Breeding Facility",
  "Pet Sitter",
]);

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

const sanitizeTypeCoding = (
    typeCoding: ToFHIROrganizationOptions['typeCoding'] | undefined
): ToFHIROrganizationOptions['typeCoding'] | undefined => {
    if (!typeCoding) {
        return undefined
    }

    const system = optionalSafeString(typeCoding.system, 'Organization type system')
    const code = optionalSafeString(typeCoding.code, 'Organization type code')

    if (!system || !code) {
        return undefined
    }

    return {
        system,
        code,
        display: optionalSafeString(typeCoding.display, 'Organization type display'),
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
    const typeCoding = sanitizeTypeCoding(dto.typeCoding)
    const typeCode = typeCoding?.code

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
    const { typeCoding, fhirId, ...rest } = document.toObject({ virtuals: false }) as OrganizationMongo & {
        _id: Types.ObjectId
    }

    const address = rest.address
        ? {
              addressLine: rest.address.addressLine,
              country: rest.address.country,
              city: rest.address.city,
              state: rest.address.state,
              postalCode: rest.address.postalCode,
              latitude: rest.address.latitude,
              longitude: rest.address.longitude,
          }
        : undefined

    const organizationType = ORGANIZATION_TYPES.has(rest.type as NonNullable<Organization['type']>)
        ? (rest.type as NonNullable<Organization['type']>)
        : undefined

    const businessInput: Organization = {
        id: fhirId ?? document._id.toString(),
        _id: document._id,
        fhirId,
        name: rest.name,
        registrationNo: rest.registrationNo,
        imageURL: rest.imageURL,
        type: organizationType,
        phoneNo: rest.phoneNo,
        website: rest.website,
        country: rest.country,
        address,
        departments: rest.departments,
        isVerified: rest.isVerified,
    }

    return toOrganizationResponseDTO(businessInput, options ?? (typeCoding ? { typeCoding } : undefined))
}

const resolveIdQuery = (id: unknown) => {
    const identifier = ensureSafeIdentifier(id)

    if (!identifier) {
        throw new OrganizationServiceError('Organization identifier is required.', 400)
    }

    return Types.ObjectId.isValid(identifier) ? { _id: identifier } : { fhirId: identifier }
}

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
        let query: { _id?: string; fhirId?: string } | undefined = undefined;

        if (identifier) {
        query = isValidObjectId(identifier)
            ? { _id: identifier }
            : { fhirId: identifier };
        }

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
        const document = await OrganizationModel.findOne(resolveIdQuery(id), null, { sanitizeFilter: true })

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
        const result = await OrganizationModel.findOneAndDelete(resolveIdQuery(id), { sanitizeFilter: true })
        return Boolean(result)
    },

    async update(id: string, payload: OrganizationFHIRPayload) {
        const { persistable, typeCoding } = createPersistableFromFHIR(payload)
        const document = await OrganizationModel.findOneAndUpdate(
            resolveIdQuery(id),
            { $set: persistable },
            { new: true, sanitizeFilter: true }
        )

        if (!document) {
            return null
        }

        return buildFHIRResponse(document, typeCoding ? { typeCoding } : undefined)
    },
}
