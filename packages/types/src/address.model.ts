import { Address as FHIRAddress } from "@yosemite-crew/fhirtypes"

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
    console.log('toFHIRAddress called with:', address);
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