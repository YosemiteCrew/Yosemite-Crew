import { Types } from 'mongoose'
import ParentModel, { ParentDocument, type ParentMongo } from '../models/parent'
import {
    fromParentRequestDTO,
    toParentResponseDTO,
    type ParentRequestDTO,
    type ParentDTOAttributesType,
} from '../../../../packages/types/src/dto/parent.dto'
import type { Parent, Address } from '../../../../packages/types/src/parent'

export class ParentServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'ParentServiceError'
    }
}

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

const sanitizeParentAttributes = (dto: ParentDTOAttributesType): ParentMongo => {
    if (!dto.firstName) {
        throw new ParentServiceError('Parent first name is required.', 400)
    }

    if (typeof dto.age !== 'number') {
        throw new ParentServiceError('Parent age is required.', 400)
    }

    const address: ParentMongo['address'] | undefined = dto.address
        ? {
              addressLine: dto.address.addressLine,
              country: dto.address.country,
              city: dto.address.city,
              state: dto.address.state,
              postalCode: dto.address.postalCode,
              latitude: dto.address.latitude,
              longitude: dto.address.longitude,
          }
        : undefined

    if (!address) {
        throw new ParentServiceError('Parent address is required.', 400)
    }

    return {
        fhirId: dto._id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        age: dto.age,
        address,
        phoneNumber: dto.phoneNumber,
        profileImageUrl: dto.profileImageUrl,
    }
}

const buildParentDomain = (document: ParentDocument): Parent => {
    const { _id, __v, fhirId, ...rest } = document.toObject({ virtuals: false }) as ParentMongo & {
        _id: Types.ObjectId
        __v?: number
    }

    const address: Address = {
        addressLine: rest.address?.addressLine,
        country: rest.address?.country,
        city: rest.address?.city,
        state: rest.address?.state,
        postalCode: rest.address?.postalCode,
        latitude: rest.address?.latitude,
        longitude: rest.address?.longitude,
    }

    return {
        _id: fhirId ?? _id.toString(),
        firstName: rest.firstName,
        lastName: rest.lastName,
        age: rest.age,
        address,
        phoneNumber: rest.phoneNumber,
        profileImageUrl: rest.profileImageUrl,
    }
}

const createPersistableFromFHIR = (payload: ParentRequestDTO) => {
    if (!payload || payload.resourceType !== 'RelatedPerson') {
        throw new ParentServiceError('Invalid payload. Expected FHIR RelatedPerson resource.', 400)
    }

    const attributes = fromParentRequestDTO(payload)
    const persistable = pruneUndefined(sanitizeParentAttributes(attributes))

    return { persistable }
}

const resolveIdQuery = (id: string) => (Types.ObjectId.isValid(id) ? { _id: id } : { fhirId: id })

export const ParentService = {
    async create(payload: ParentRequestDTO) {
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await ParentModel.create(persistable)
        const parent = buildParentDomain(document)

        return toParentResponseDTO(parent)
    },

    async getById(id: string) {
        const document = await ParentModel.findOne(resolveIdQuery(id))

        if (!document) {
            return null
        }

        const parent = buildParentDomain(document)
        return toParentResponseDTO(parent)
    },

    async update(id: string, payload: ParentRequestDTO) {
        const { persistable } = createPersistableFromFHIR(payload)

        const document = await ParentModel.findOneAndUpdate(resolveIdQuery(id), { $set: persistable }, { new: true })

        if (!document) {
            return null
        }

        const parent = buildParentDomain(document)
        return toParentResponseDTO(parent)
    },
}
