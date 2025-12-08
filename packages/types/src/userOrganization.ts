import type { PractitionerRole } from "@yosemite-crew/fhirtypes"

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
    extraPermissions?: string[];
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

export function fromFHIRUserOrganization(dto: PractitionerRole): UserOrganization {
  const practitionerReference = dto.practitioner?.reference ?? "";
  const organizationReference = dto.organization?.reference ?? "";

  const coding = dto.code?.[0]?.coding?.[0];
  const text = dto.code?.[0]?.text!;

  return {
    id: dto.id,
    practitionerReference,
    organizationReference,
    roleCode: coding?.code ?? text,
    roleDisplay: coding?.display ?? text,
    active: dto.active,
  };
}