import { HealthcareService } from "@yosemite-crew/fhirtypes";
import { fromFHIRHealthCareService, Service, toFHIRHealthcareService } from "../service";

export type ServiceRequestDTO = HealthcareService;
export type ServiceResponseDTO = HealthcareService;

export const fromServiceRequestDTO = (dto: ServiceRequestDTO) => {

  if (!dto || dto.resourceType !== "HealthcareService") {
    throw new Error("Invalid payload. Expected FHIR HealthcareService resource.");
  }

  return fromFHIRHealthCareService(dto)
}

export const toServiceResponseDTO = (service: Service) => {
  return toFHIRHealthcareService(service)
}

