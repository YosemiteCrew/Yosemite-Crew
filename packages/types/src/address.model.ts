import type { Address as FHIRAddress, Extension } from "@yosemite-crew/fhirtypes"

export type Address = {
    addressLine? : string;
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
}

export function toFHIRAddress(address: Address): FHIRAddress  {
    return {
        line: address.addressLine ? [address.addressLine] : undefined,
        country: address.country,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        extension: (address.latitude !== undefined && address.longitude !== undefined) ? [
            {
                url: 'http://hl7.org/fhir/StructureDefinition/geolocation',
                extension: [
                    {
                        url: 'latitude',
                        valueDecimal: address.latitude,
                    },
                    {
                        url: 'longitude',
                        valueDecimal: address.longitude,
                    },
                ],
            },
        ] : undefined,
    }
}

const GEOLOCATION_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/geolocation'
const LATITUDE_CHILD_URL = 'latitude'
const LONGITUDE_CHILD_URL = 'longitude'

const extractDecimal = (extensions: Extension[] | undefined, url: string): number | undefined =>
    extensions?.find((child) => child.url === url)?.valueDecimal

export function fromFHIRAddress(address?: FHIRAddress): Address {
    if (!address) {
        return {}
    }

    const geolocationExtension = address.extension?.find(
        (extension) => extension.url === GEOLOCATION_EXTENSION_URL
    )

    const latitude = extractDecimal(geolocationExtension?.extension, LATITUDE_CHILD_URL)
    const longitude = extractDecimal(geolocationExtension?.extension, LONGITUDE_CHILD_URL)

    return {
        addressLine: address.line?.[0],
        country: address.country,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        latitude,
        longitude,
    }
}
