import { Address, toFHIRAddress } from '../address.model'
import type { Address as FHIRAddress, Extension } from "@yosemite-crew/fhirtypes"


const GEOLOCATION_URL = 'http://hl7.org/fhir/StructureDefinition/geolocation'

type AddressAttributes = {
    addressLine?: Address['addressLine']
    country?: Address['country']
    city?: Address['city']
    state?: Address['state']
    postalCode?: Address['postalCode']
    latitude?: Address['latitude']
    longitude?: Address['longitude']
}

type GeolocationChildExtension = Extension & {
    url: 'latitude' | 'longitude'
    valueDecimal: number
}

type GeolocationExtension = Extension & {
    url: typeof GEOLOCATION_URL
    extension: GeolocationChildExtension[]
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value)

const isGeolocationExtension = (extension?: Extension): extension is GeolocationExtension => {
    if (!extension || extension.url !== GEOLOCATION_URL || !Array.isArray(extension.extension)) {
        return false
    }

    const latitude = extension.extension.find((item) => item.url === 'latitude')
    const longitude = extension.extension.find((item) => item.url === 'longitude')

    return Boolean(
        latitude?.url === 'latitude' && isNumber(latitude.valueDecimal) &&
        longitude?.url === 'longitude' && isNumber(longitude.valueDecimal)
    )
}

const extractGeolocation = (extension?: Extension[]): Pick<AddressAttributes, 'latitude' | 'longitude'> => {
    const geolocation = extension?.find(isGeolocationExtension)

    if (!geolocation) {
        return {}
    }

    const latitude = geolocation.extension.find((item) => item.url === 'latitude')?.valueDecimal
    const longitude = geolocation.extension.find((item) => item.url === 'longitude')?.valueDecimal

    return {
        latitude: isNumber(latitude) ? latitude : undefined,
        longitude: isNumber(longitude) ? longitude : undefined,
    }
}

const createGeolocationExtension = (
    latitude?: AddressAttributes['latitude'],
    longitude?: AddressAttributes['longitude']
): GeolocationExtension | undefined => {
    const childExtensions: GeolocationChildExtension[] = []

    if (isNumber(latitude)) {
        childExtensions.push({ url: 'latitude', valueDecimal: latitude })
    }

    if (isNumber(longitude)) {
        childExtensions.push({ url: 'longitude', valueDecimal: longitude })
    }

    if (!childExtensions.length) {
        return undefined
    }

    return {
        url: GEOLOCATION_URL,
        extension: childExtensions,
    }
}

const toAddressAttributes = (address: Address | AddressAttributes): AddressAttributes => ({
    addressLine: address.addressLine,
    country: address.country,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    latitude: 'latitude' in address ? address.latitude : undefined,
    longitude: 'longitude' in address ? address.longitude : undefined,
})

export type AddressRequestDTO = FHIRAddress

export type AddressResponseDTO = FHIRAddress

export const fromAddressRequestDTO = (dto: AddressRequestDTO): AddressAttributes => {
    const { country, city, state, postalCode, line, extension } = dto

    return {
        addressLine: line?.[0],
        country,
        city,
        state,
        postalCode,
        ...extractGeolocation(extension),
    }
}

export const toAddressResponseDTO = (address: Address | AddressAttributes): AddressResponseDTO => {
    const attributes = toAddressAttributes(address)
    const fhirAddress = toFHIRAddress({
        addressLine: attributes.addressLine,
        country: attributes.country,
        city: attributes.city,
        state: attributes.state,
        postalCode: attributes.postalCode,
    } as Address)

    const geolocation = createGeolocationExtension(attributes.latitude, attributes.longitude)

    return {
        ...fhirAddress,
        extension: geolocation ? [geolocation] : undefined,
    }
}

export type { AddressAttributes as AddressDTOAttributes }
