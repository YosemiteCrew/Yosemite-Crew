import type { RelatedPerson } from '../../../fhirtypes/src/RelatedPerson'
import type { HumanName } from '../../../fhirtypes/src/HumanName'
import type { ContactPoint } from '../../../fhirtypes/src/ContactPoint'
import type { Attachment } from '../../../fhirtypes/src/Attachment'
import type { Extension } from '../../../fhirtypes/src/Extension'
import type { Parent } from '../parent'
import { PARENT_AGE_EXTENSION_URL, toFHIRRelatedPerson } from '../parent'
import type { AddressDTOAttributes, AddressRequestDTO } from './address.dto'
import { fromAddressRequestDTO, toAddressResponseDTO } from './address.dto'

type ExtractedName = {
    firstName?: Parent['firstName']
    lastName?: Parent['lastName']
}

const parseName = (name?: HumanName): ExtractedName => {
    if (!name) {
        return {}
    }

    const firstName = name.given?.[0]
    const lastName = name.family

    if (firstName || lastName) {
        return { firstName, lastName }
    }

    const text = name.text?.trim()

    if (!text) {
        return {}
    }

    const parts = text.split(/\s+/)

    if (!parts.length) {
        return {}
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || undefined,
    }
}

const extractPhoneNumber = (telecom?: ContactPoint[]): Parent['phoneNumber'] =>
    telecom?.find((contact) => contact.system === 'phone' && contact.value)?.value

const extractPhotoUrl = (photo?: Attachment[]): Parent['profileImageUrl'] =>
    photo?.find((item) => item.url)?.url

const extractAge = (extension?: Extension[]): Parent['age'] | undefined => {
    const ageExtension = extension?.find((item) => item.url === PARENT_AGE_EXTENSION_URL)

    const valueInteger = ageExtension && typeof ageExtension.valueInteger === 'number' ? ageExtension.valueInteger : undefined

    if (typeof valueInteger === 'number') {
        return valueInteger
    }

    const valueDecimal = ageExtension && typeof ageExtension.valueDecimal === 'number' ? ageExtension.valueDecimal : undefined

    return typeof valueDecimal === 'number' ? Math.trunc(valueDecimal) : undefined
}

const extractAddress = (addresses?: AddressRequestDTO[]): AddressDTOAttributes | undefined => {
    if (!addresses?.length) {
        return undefined
    }

    return fromAddressRequestDTO(addresses[0])
}

export type ParentRequestDTO = RelatedPerson

export type ParentResponseDTO = RelatedPerson

export type ParentDTOAttributes = {
    _id?: Parent['_id']
    firstName?: Parent['firstName']
    lastName?: Parent['lastName']
    age?: Parent['age']
    address?: AddressDTOAttributes
    phoneNumber?: Parent['phoneNumber']
    profileImageUrl?: Parent['profileImageUrl']
}

export const fromParentRequestDTO = (dto: ParentRequestDTO): ParentDTOAttributes => {
    const { id, name, telecom, photo, extension, address } = dto

    const { firstName, lastName } = parseName(name?.[0])

    return {
        _id: id,
        firstName,
        lastName,
        age: extractAge(extension),
        address: extractAddress(address),
        phoneNumber: extractPhoneNumber(telecom),
        profileImageUrl: extractPhotoUrl(photo),
    }
}

export const toParentResponseDTO = (parent: Parent): ParentResponseDTO => {
    const relatedPerson = toFHIRRelatedPerson(parent)

    const address = parent.address ? toAddressResponseDTO(parent.address) : undefined

    return {
        ...relatedPerson,
        address: address ? [address] : undefined,
    }
}

export type { ParentDTOAttributes as ParentDTOAttributesType }
