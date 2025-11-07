import type { Organization as FHIROrganization } from "@yosemite-crew/fhirtypes"
import {
    fromFHIRSpeciality,
    toFHIRSpeciality,
    type Speciality,
} from "../speciality"

const normalizeId = (id?: string | Speciality["_id"]): string | undefined => {
    if (!id) {
        return undefined
    }

    if (typeof id === "string") {
        return id || undefined
    }

    try {
        const value = typeof (id as { toString?: () => string }).toString === "function"
            ? (id as { toString: () => string }).toString()
            : String(id)
        return value || undefined
    } catch {
        return undefined
    }
}

export type SpecialityRequestDTO = FHIROrganization

export type SpecialityResponseDTO = FHIROrganization

export type SpecialityDTOAttributes = Speciality & {
    id?: string
}

export const fromSpecialityRequestDTO = (dto: SpecialityRequestDTO): SpecialityDTOAttributes => {
    const speciality = fromFHIRSpeciality(dto)

    return {
        id: dto.id ?? normalizeId(speciality._id),
        ...speciality,
    }
}

export const toSpecialityResponseDTO = (speciality: Speciality): SpecialityResponseDTO =>
    toFHIRSpeciality(speciality)
