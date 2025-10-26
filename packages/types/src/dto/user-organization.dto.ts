import type { PractitionerRole } from "@yosemite-crew/fhirtypes"
import type { UserOrganization } from '../userOrganization'
import { toFHIRUserOrganization } from '../userOrganization'

export type UserOrganizationRequestDTO = PractitionerRole

export type UserOrganizationResponseDTO = PractitionerRole

export interface UserOrganizationDTOAttributes {
    id?: string
    practitionerReference?: string
    organizationReference?: string
    roleCode?: string
    roleDisplay?: string
    active?: boolean
}

const getPrimaryRoleCoding = (dto: PractitionerRole['code']): {
    code?: string
    display?: string
    text?: string
} => {
    const primary = dto?.[0]
    const coding = primary?.coding?.[0]

    return {
        code: coding?.code ?? primary?.text,
        display: coding?.display,
        text: primary?.text,
    }
}

export const fromUserOrganizationRequestDTO = (
    dto: UserOrganizationRequestDTO
): UserOrganizationDTOAttributes => {
    const practitionerReference = dto.practitioner?.reference
    const organizationReference = dto.organization?.reference
    const coding = getPrimaryRoleCoding(dto.code)

    return {
        id: dto.id,
        practitionerReference,
        organizationReference,
        roleCode: coding.code,
        roleDisplay: coding.display ?? coding.text,
        active: dto.active,
    }
}

export const toUserOrganizationResponseDTO = (
    mapping: UserOrganization
): UserOrganizationResponseDTO => toFHIRUserOrganization(mapping)
