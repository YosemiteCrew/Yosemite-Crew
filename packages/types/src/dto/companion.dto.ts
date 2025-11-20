import type { Patient } from "@yosemite-crew/fhirtypes";
import type { Companion } from "../companion";
import { fromFHIRCompanion, toFHIRCompanion } from "../companion";

export type CompanionRequestDTO = Patient;
export type CompanionResponseDTO = Patient;

/**
 * FHIR Patient → Internal Companion
 */
export const fromCompanionRequestDTO = (
  dto: CompanionRequestDTO
): Companion => {
  if (!dto || dto.resourceType !== "Patient") {
    throw new Error("Invalid payload. Expected FHIR Patient resource.");
  }
  return fromFHIRCompanion(dto);
};

/**
 * Internal Companion → FHIR Patient
 */
export const toCompanionResponseDTO = (
  companion: Companion
): CompanionResponseDTO => {
  return toFHIRCompanion(companion);
};
