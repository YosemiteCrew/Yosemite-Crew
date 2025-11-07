import type { Organization as FHIROrganization } from "@yosemite-crew/fhirtypes"
import type { Address } from './address.model'
import { toFHIRAddress, fromFHIRAddress } from './address.model'

type StringableId = { toString(): string }

export interface Organisation {
    _id?: string | StringableId
    name: string
    registrationNo: string
    DUNSNumber?: string
    imageURL?: string
    type: 'HOSPITAL' | 'BREEDER' | 'BOARDER' | 'GROOMER'
    phoneNo: string
    website?: string
    address: Address
    isVerified: boolean
    isActive: boolean
}

export type Organization = Organisation
export type ToFHIROrganizationOptions = {
    typeCoding?: {
        system: string
        code: string
        display?: string
    }
}

const REGISTRATION_IDENTIFIER_SYSTEM = 'http://example.org/fhir/NamingSystem/organisation-registration'
const DUNS_IDENTIFIER_SYSTEM = 'urn:oid:2.16.840.1.113883.4.13'
const IMAGE_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/organisation-image'
const IS_VERIFIED_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/isVerified'
const TYPE_SYSTEM = 'http://example.org/fhir/CodeSystem/organisation-type'

const ORGANISATION_TYPE_CODING_MAP: Record<Organisation['type'], { code: string; display: string }> = {
    HOSPITAL: { code: 'hospital', display: 'Hospital' },
    BREEDER: { code: 'breeder', display: 'Breeder' },
    BOARDER: { code: 'boarder', display: 'Boarder' },
    GROOMER: { code: 'groomer', display: 'Groomer' },
}

const REVERSE_TYPE_CODING_MAP = Object.entries(ORGANISATION_TYPE_CODING_MAP).reduce<
    Record<string, Organisation['type']>
>((acc, [type, coding]) => {
    acc[coding.code] = type as Organisation['type']
    return acc
}, {})

const toStringId = (id?: string | StringableId): string | undefined => {
    if (!id) {
        return undefined
    }

    if (typeof id === 'string') {
        return id
    }

    try {
        const value = id.toString()
        return value || undefined
    } catch {
        return undefined
    }
}

const buildIdentifiers = (organisation: Organisation): NonNullable<FHIROrganization['identifier']> | undefined => {
    const identifiers: NonNullable<FHIROrganization['identifier']> = []

    if (organisation.registrationNo) {
        identifiers.push({
            system: REGISTRATION_IDENTIFIER_SYSTEM,
            value: organisation.registrationNo,
            use: 'official',
        })
    }

    if (organisation.DUNSNumber) {
        identifiers.push({
            system: DUNS_IDENTIFIER_SYSTEM,
            value: organisation.DUNSNumber,
        })
    }

    return identifiers.length ? identifiers : undefined
}

const buildTelecom = (organisation: Organisation): NonNullable<FHIROrganization['telecom']> | undefined => {
    const telecom: NonNullable<FHIROrganization['telecom']> = []

    if (organisation.phoneNo) {
        telecom.push({
            system: 'phone',
            value: organisation.phoneNo,
        })
    }

    if (organisation.website) {
        telecom.push({
            system: 'url',
            value: organisation.website,
        })
    }

    return telecom.length ? telecom : undefined
}

const buildExtensions = (organisation: Organisation): FHIROrganization['extension'] => {
    const extensions: NonNullable<FHIROrganization['extension']> = []

    extensions.push({
        url: IS_VERIFIED_EXTENSION_URL,
        valueBoolean: organisation.isVerified,
    })

    if (organisation.imageURL) {
        extensions.push({
            url: IMAGE_EXTENSION_URL,
            valueUrl: organisation.imageURL,
        })
    }

    return extensions.length ? extensions : undefined
}

const buildType = (
    organisation: Organisation,
    options?: ToFHIROrganizationOptions
): FHIROrganization['type'] => {
    const override = options?.typeCoding

    if (override) {
        return [
            {
                coding: [
                    {
                        system: override.system,
                        code: override.code,
                        display: override.display,
                    },
                ],
                text: override.display,
            },
        ]
    }

    const coding = ORGANISATION_TYPE_CODING_MAP[organisation.type]

    return coding
        ? [
              {
                  coding: [
                      {
                          system: TYPE_SYSTEM,
                          code: coding.code,
                          display: coding.display,
                      },
                  ],
                  text: coding.display,
              },
          ]
        : undefined
}

export const toFHIROrganisation = (
    organisation: Organisation,
    options: ToFHIROrganizationOptions = {}
): FHIROrganization => ({
    resourceType: 'Organization',
    id: toStringId(organisation._id),
    active: organisation.isActive,
    name: organisation.name,
    identifier: buildIdentifiers(organisation),
    telecom: buildTelecom(organisation),
    type: buildType(organisation, options),
    address: [toFHIRAddress(organisation.address)],
    extension: buildExtensions(organisation),
})

const findIdentifierValue = (
    identifiers: FHIROrganization['identifier'],
    system: string
): string | undefined => identifiers?.find((identifier) => identifier.system === system)?.value

const extractIsVerified = (extensions: FHIROrganization['extension']): boolean =>
    extensions?.find((extension) => extension.url === IS_VERIFIED_EXTENSION_URL)?.valueBoolean ?? false

const extractImageUrl = (extensions: FHIROrganization['extension']): string | undefined =>
    extensions?.find((extension) => extension.url === IMAGE_EXTENSION_URL)?.valueUrl

const extractType = (resource: FHIROrganization): Organisation['type'] => {
    const coding = resource.type?.[0]?.coding?.[0]

    if (coding?.code) {
        const type = REVERSE_TYPE_CODING_MAP[coding.code]
        if (type) {
            return type
        }
    }

    return 'HOSPITAL'
}

const getTelecomValue = (
    telecom: FHIROrganization['telecom'],
    system: 'phone' | 'url'
): string | undefined => telecom?.find((item) => item.system === system)?.value

export const fromFHIROrganisation = (resource: FHIROrganization): Organisation => {
    const extensions = resource.extension

    return {
        _id: resource.id,
        name: resource.name ?? '',
        registrationNo: findIdentifierValue(resource.identifier, REGISTRATION_IDENTIFIER_SYSTEM) ?? '',
        DUNSNumber: findIdentifierValue(resource.identifier, DUNS_IDENTIFIER_SYSTEM),
        imageURL: extractImageUrl(extensions),
        type: extractType(resource),
        phoneNo: getTelecomValue(resource.telecom, 'phone') ?? '',
        website: getTelecomValue(resource.telecom, 'url'),
        address: fromFHIRAddress(resource.address?.[0]),
        isVerified: extractIsVerified(extensions),
        isActive: resource.active ?? false,
    }
}

export const toFHIROrganization = toFHIROrganisation
export const fromFHIROrganization = fromFHIROrganisation
