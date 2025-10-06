import type { Organization as FHIROrganization} from '../../../fhirtypes/src/Organization'
import type { Organization, ToFHIROrganizationOptions } from '../organization'
import type { Department } from '../department.model'
import type { AddressDTOAttributes } from './address.dto'
import { fromAddressRequestDTO } from './address.dto'
import { toFHIROrganization } from '../organization'

const IS_VERIFIED_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/isVerified'
const DEPARTMENTS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/departments'

type TelecomList = FHIROrganization['telecom']

const getTelecomValue = (
    telecom: TelecomList | undefined,
    system: 'phone' | 'url'
): string | undefined => telecom?.find((contact) => contact?.system === system)?.value

const safeParseJSON = <T>(value?: string): T | undefined => {
    if (!value) {
        return undefined
    }

    try {
        return JSON.parse(value) as T
    } catch {
        return undefined
    }
}

const extractDepartments = (extensions: FHIROrganization['extension']): Department[] | undefined => {
    const extension = extensions?.find((item) => item.url === DEPARTMENTS_EXTENSION_URL)

    if (!extension || typeof extension.valueString !== 'string') {
        return undefined
    }

    const parsed = safeParseJSON<Department[]>(extension.valueString)

    return Array.isArray(parsed) ? parsed : undefined
}

const extractIsVerified = (extensions: FHIROrganization['extension']): boolean | undefined => {
    const extension = extensions?.find((item) => item.url === IS_VERIFIED_EXTENSION_URL)

    return typeof extension?.valueBoolean === 'boolean' ? extension.valueBoolean : undefined
}

const extractTypeCoding = (
    organization: FHIROrganization
): ToFHIROrganizationOptions['typeCoding'] | undefined => {
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

export type OrganizationRequestDTO = FHIROrganization

export type OrganizationResponseDTO = FHIROrganization

export type OrganizationDTOAttributes = {
    id?: string
    name?: string
    phoneNo?: string
    website?: string
    address?: AddressDTOAttributes
    departments?: Department[]
    isVerified?: boolean
    typeCoding?: ToFHIROrganizationOptions['typeCoding']
}

export const fromOrganizationRequestDTO = (dto: OrganizationRequestDTO): OrganizationDTOAttributes => ({
    id: dto.id,
    name: dto.name,
    phoneNo: getTelecomValue(dto.telecom, 'phone'),
    website: getTelecomValue(dto.telecom, 'url'),
    address: dto.address?.[0] ? fromAddressRequestDTO(dto.address[0]) : undefined,
    departments: extractDepartments(dto.extension),
    isVerified: extractIsVerified(dto.extension),
    typeCoding: extractTypeCoding(dto),
})

export const toOrganizationResponseDTO = (
    organization: Organization,
    options: ToFHIROrganizationOptions = {}
): OrganizationResponseDTO => toFHIROrganization(organization, options)
