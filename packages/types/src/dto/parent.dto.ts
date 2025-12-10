import type { RelatedPerson } from "@yosemite-crew/fhirtypes"
import type { Parent } from "../parent"
import { toFHIRRelatedPerson, fromFHIRRelatedPerson } from "../parent"

export type ParentRequestDTO = RelatedPerson
export type ParentResponseDTO = RelatedPerson

export const fromParentRequestDTO = (dto: ParentRequestDTO): Parent => {

  if (!dto || dto.resourceType !== "RelatedPerson") {
    throw new Error("Invalid payload. Expected FHIR RelatedPerson resource.");
  }

  return fromFHIRRelatedPerson(dto)
}

export const toParentResponseDTO = (parent: Parent): ParentResponseDTO => {
  return toFHIRRelatedPerson(parent)
}