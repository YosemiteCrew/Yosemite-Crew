import type { Organization as FHIROrganization } from "@yosemite-crew/fhirtypes"
import {
    fromFHIROrganisation,
    toFHIROrganisation,
    type Organisation,
    type ToFHIROrganizationOptions,
} from "../organization"

type TelecomList = FHIROrganization["telecom"]

const getTelecomValue = (
    telecom: TelecomList | undefined,
    system: "phone" | "url"
): string | undefined => telecom?.find((contact) => contact?.system === system)?.value

const extractTypeCoding = (
    organization: FHIROrganization
): ToFHIROrganizationOptions["typeCoding"] | undefined => {
    const coding = organization.type?.[0]?.coding?.[0]

    if (!coding?.system || !coding?.code) {
        return undefined
    }

    return {
        system: coding.system,
        code: coding.code,
        display: coding.display,
    }
}

const normalizeId = (id?: string | Organisation["_id"]): string | undefined => {
    if (!id) {
        return undefined
    }

    if (typeof id === "string") {
        return id || undefined
    }

    try {
        const value = id.toString()
        return value || undefined
    } catch {
        return undefined
    }
}

export type OrganizationRequestDTO = FHIROrganization

export type OrganizationResponseDTO = FHIROrganization

export type OrganizationDTOAttributes = Organisation & {
    id?: string
    typeCoding?: ToFHIROrganizationOptions["typeCoding"]
}

export const fromOrganizationRequestDTO = (dto: OrganizationRequestDTO): OrganizationDTOAttributes => {
    const organisation = fromFHIROrganisation(dto)

    return {
        id: dto.id ?? normalizeId(organisation._id),
        ...organisation,
        phoneNo: getTelecomValue(dto.telecom, "phone") ?? organisation.phoneNo,
        website: getTelecomValue(dto.telecom, "url") ?? organisation.website,
        typeCoding: extractTypeCoding(dto),
    }
}

export const toOrganizationResponseDTO = (
    organization: Organisation,
    options: ToFHIROrganizationOptions = {}
): OrganizationResponseDTO => toFHIROrganisation(organization, options)
