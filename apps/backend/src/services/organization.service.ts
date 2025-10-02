import { Types } from 'mongoose'
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

const sanitizeBusinessAttributes = (
    dto: OrganizationDTOAttributes,
    extras: {
        registrationNo?: string
        imageURL?: string
    }
): OrganizationMongo => {
    const departments = dto.departments?.length
        ? dto.departments.map((department) => ({
              name: department?.name,
              services: department?.services?.map((service) => ({
                  name: service?.name,
                  description: service?.description,
                  estimatedCost: service?.estimatedCost,
                  availability: service?.availability,
                  respnonseTime: service?.respnonseTime,
              })),
          }))
        : undefined

    return {
        fhirId: dto.id,
        name: dto.name ?? '',
        registrationNo: extras.registrationNo,
        imageURL: extras.imageURL,
        type: dto.typeCoding?.code,
        phoneNo: dto.phoneNo,
        website: dto.website,
        country: dto.address?.country,
        address: dto.address
            ? {
                  addressLine: dto.address.addressLine,
                  country: dto.address.country,
                  city: dto.address.city,
                  state: dto.address.state,
                  postalCode: dto.address.postalCode,
                  latitude: dto.address.latitude,
                  longitude: dto.address.longitude,
              }
            : undefined,
        departments,
        isVerified: dto.isVerified,
        typeCoding: dto.typeCoding,
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

    if (!attributes.name) {
        throw new OrganizationServiceError('Organization name is required.', 400)
    }

    const registrationNo = extractRegistrationNumber(payload)
    const imageURL = extractImageUrl(payload)
    const sanitized = sanitizeBusinessAttributes(attributes, { registrationNo, imageURL })
    const persistable = pruneUndefined(sanitized)

    return { persistable, typeCoding: sanitized.typeCoding, attributes }
}

export const OrganizationService = {
    async upsert(payload: OrganizationFHIRPayload) {
        const { persistable, typeCoding, attributes } = createPersistableFromFHIR(payload)

        const query = attributes.id
            ? Types.ObjectId.isValid(attributes.id)
                ? { _id: attributes.id }
                : { fhirId: attributes.id }
            : undefined

        let document: OrganizationDocument | null = null
        let created = false

        if (query) {
            document = await OrganizationModel.findOneAndUpdate(query, { $set: persistable }, { new: true })
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

