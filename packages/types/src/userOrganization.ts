import type { PractitionerRole } from '../../fhirtypes/src/PractitionerRole'

type StringableId = { toString(): string }

export interface UserOrganization {
    id?: string
    _id?: StringableId
    fhirId?: string
    practitionerReference: string
    organizationReference: string
    roleCode: string
    roleDisplay?: string
    active?: boolean
}

export type ToFHIRUserOrganizationOptions = {
    roleSystem?: string
    roleText?: string
}

export function toFHIRUserOrganization(
    mapping: UserOrganization,
    options: ToFHIRUserOrganizationOptions = {}
): PractitionerRole {
    const identifier = mapping.fhirId ?? mapping.id ?? mapping._id?.toString()

    const practitioner = mapping.practitionerReference
        ? {
              reference: mapping.practitionerReference,
          }
        : undefined

    const organization = mapping.organizationReference
        ? {
              reference: mapping.organizationReference,
          }
        : undefined

    const roleText = mapping.roleDisplay ?? options.roleText ?? mapping.roleCode
    const roleSystem = options.roleSystem ?? 'http://example.org/fhir/CodeSystem/user-organization-role'

    const code = mapping.roleCode
        ? [
              {
                  coding: [
                      {
                          system: roleSystem,
                          code: mapping.roleCode,
                          display: roleText,
                      },
                  ],
                  text: roleText,
              },
          ]
        : undefined

    const resource: PractitionerRole = {
        resourceType: 'PractitionerRole',
        practitioner,
        organization,
        active: typeof mapping.active === 'boolean' ? mapping.active : undefined,
        code,
    }

    if (identifier) {
        resource.id = identifier
    }

    return resource
}
