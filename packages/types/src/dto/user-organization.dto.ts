import type { PractitionerRole } from "@yosemite-crew/fhirtypes"
import type { UserOrganization } from '../userOrganization'
import { fromFHIRUserOrganization, toFHIRUserOrganization } from '../userOrganization'

export type UserOrganizationRequestDTO = PractitionerRole

export type UserOrganizationResponseDTO = PractitionerRole


export const fromUserOrganizationRequestDTO = (
    dto: UserOrganizationRequestDTO
): UserOrganization => {

    if (!dto || dto.resourceType !== "PractitionerRole") {
        throw new Error("Invalid payload. Expected FHIR PractitionerRole resource.");
    }
    
    return fromFHIRUserOrganization(dto)
}

export const toUserOrganizationResponseDTO = (
    mapping: UserOrganization
): UserOrganizationResponseDTO => toFHIRUserOrganization(mapping)
