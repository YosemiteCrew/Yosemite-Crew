import type { Organization as FHIROrganization } from "@yosemite-crew/fhirtypes"
import type { Address } from './address.model'
import { toFHIRAddress, fromFHIRAddress } from './address.model'

type StringableId = { toString(): string }

export interface Organisation {
    _id?: string | StringableId
    name: string
    DUNSNumber?: string
    imageURL?: string
    type: 'HOSPITAL' | 'BREEDER' | 'BOARDER' | 'GROOMER'
    phoneNo: string
    website?: string
    address?: Address
    isVerified?: boolean
    isActive?: boolean
    taxId: string
    healthAndSafetyCertNo?: string
    animalWelfareComplianceCertNo?: string
    fireAndEmergencyCertNo?: string
    googlePlacesId?: string
}

export type Organization = Organisation
export type ToFHIROrganizationOptions = {
    typeCoding?: {
        system: string
        code: string
        display?: string
    }
}

const TAX_IDENTIFIER_SYSTEM = 'http://example.org/fhir/NamingSystem/organisation-tax-id'
const DUNS_IDENTIFIER_SYSTEM = 'http://terminology.hl7.org/NamingSystem/DUNSNumber'
const IMAGE_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/organisation-image'
const IS_VERIFIED_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/isVerified'
const TAX_ID_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/taxId'
const HEALTH_SAFETY_CERT_EXTENSION_URL =
    'http://example.org/fhir/StructureDefinition/healthAndSafetyCertificationNumber'
const ANIMAL_WELFARE_CERT_EXTENSION_URL =
    'http://example.org/fhir/StructureDefinition/animalWelfareComplianceCertificationNumber'
const FIRE_EMERGENCY_CERT_EXTENSION_URL =
    'http://example.org/fhir/StructureDefinition/fireAndEmergencyCertificationNumber'
const TYPE_SYSTEM = 'http://example.org/fhir/CodeSystem/organisation-type'
const GOOGLE_PLACE_ID_EXTENSION_URL = 'http://example.com/fhir/StructureDefinition/google-place-id'

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

    if (organisation.taxId) {
        identifiers.push({
            system: TAX_IDENTIFIER_SYSTEM,
            value: organisation.taxId,
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

    if (organisation.taxId) {
        extensions.push({
            url: TAX_ID_EXTENSION_URL,
            valueString: organisation.taxId,
        })
    }

    const isVerifiedValue = organisation.isVerified ?? false
    extensions.push({
        url: IS_VERIFIED_EXTENSION_URL,
        valueBoolean: isVerifiedValue,
    })

    if (organisation.imageURL) {
        extensions.push({
            url: IMAGE_EXTENSION_URL,
            valueUrl: organisation.imageURL,
        })
    }

    if (organisation.healthAndSafetyCertNo) {
        extensions.push({
            url: HEALTH_SAFETY_CERT_EXTENSION_URL,
            valueString: organisation.healthAndSafetyCertNo,
        })
    }

    if (organisation.animalWelfareComplianceCertNo) {
        extensions.push({
            url: ANIMAL_WELFARE_CERT_EXTENSION_URL,
            valueString: organisation.animalWelfareComplianceCertNo,
        })
    }

    if (organisation.fireAndEmergencyCertNo) {
        extensions.push({
            url: FIRE_EMERGENCY_CERT_EXTENSION_URL,
            valueString: organisation.fireAndEmergencyCertNo,
        })
    }

    if (organisation.googlePlacesId) {
        extensions.push({
            url: GOOGLE_PLACE_ID_EXTENSION_URL,
            valueString: organisation.googlePlacesId
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
    active: organisation.isActive ?? false,
    name: organisation.name,
    identifier: buildIdentifiers(organisation),
    telecom: buildTelecom(organisation),
    type: buildType(organisation, options),
    address: organisation.address ? [toFHIRAddress(organisation.address)] : undefined,
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

const extractStringExtension = (extensions: FHIROrganization['extension'], url: string): string | undefined =>
    extensions?.find((extension) => extension.url === url)?.valueString

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
        taxId: findIdentifierValue(resource.identifier, TAX_IDENTIFIER_SYSTEM) ?? '',
        DUNSNumber: findIdentifierValue(resource.identifier, DUNS_IDENTIFIER_SYSTEM),
        imageURL: extractImageUrl(extensions),
        type: extractType(resource),
        phoneNo: getTelecomValue(resource.telecom, 'phone') ?? '',
        website: getTelecomValue(resource.telecom, 'url'),
        address: resource.address?.[0] ? fromFHIRAddress(resource.address?.[0]) : undefined,
        isVerified: extractIsVerified(extensions),
        isActive: resource.active ?? false,
        healthAndSafetyCertNo: extractStringExtension(extensions, HEALTH_SAFETY_CERT_EXTENSION_URL),
        animalWelfareComplianceCertNo: extractStringExtension(extensions, ANIMAL_WELFARE_CERT_EXTENSION_URL),
        fireAndEmergencyCertNo: extractStringExtension(extensions, FIRE_EMERGENCY_CERT_EXTENSION_URL),
        googlePlacesId: extractStringExtension(extensions, GOOGLE_PLACE_ID_EXTENSION_URL),
    }
}

export const toFHIROrganization = toFHIROrganisation
export const fromFHIROrganization = fromFHIROrganisation
