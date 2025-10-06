import type { Organization as FHIROrganization } from '../../fhirtypes/src/Organization'
import type { Address } from './address.model'
import { toFHIRAddress } from './address.model'
import type { Department } from './department.model'

type StringableId = { toString(): string }

export interface Organization {
    id?: string
    _id?: StringableId
    fhirId?: string
    name: string
    registrationNo?: string
    imageURL?: string
    type?: 'Veterinary Business' | 'Groomer Shop' | 'Breeding Facility' | 'Pet Sitter'
    phoneNo?: string
    website?: string
    country?: string
    address?: Address
    departments?: Department[]
    isVerified?: boolean
}

export type ToFHIROrganizationOptions = {
    typeCoding?: {
        system: string
        code: string
        display?: string
    }
}

export function toFHIROrganization(
    business: Organization,
    options: ToFHIROrganizationOptions = {}
): FHIROrganization {
    const businessId =
        business.id ?? (typeof business._id?.toString === 'function' ? business._id.toString() : undefined)

    const telecom = [
        business.phoneNo
            ? {
                  system: 'phone' as const,
                  value: business.phoneNo,
              }
            : undefined,
        business.website
            ? {
                  system: 'url' as const,
                  value: business.website,
              }
            : undefined,
    ].filter((contact): contact is { system: 'phone' | 'url'; value: string } => Boolean(contact?.value))

    const address = business.address ? toFHIRAddress(business.address) : undefined
    const addressList = address && Object.values(address).some(Boolean) ? [address] : undefined

    const extensions: NonNullable<FHIROrganization['extension']> = []

    if (typeof business.isVerified === 'boolean') {
        extensions.push({
            url: 'http://example.org/fhir/StructureDefinition/isVerified',
            valueBoolean: business.isVerified,
        })
    }

    if (business.departments && business.departments.length) {
        extensions.push({
            url: 'http://example.org/fhir/StructureDefinition/departments',
            valueString: JSON.stringify(business.departments),
        })
    }

    const type = options.typeCoding
        ? [
              {
                  coding: [
                      {
                          system: options.typeCoding.system,
                          code: options.typeCoding.code,
                          display: options.typeCoding.display,
                      },
                  ],
              },
          ]
        : undefined

    return {
        resourceType: 'Organization',
        id: businessId,
        name: business.name,
        telecom: telecom.length ? telecom : undefined,
        address: addressList,
        extension: extensions.length ? extensions : undefined,
        type,
    }
}
