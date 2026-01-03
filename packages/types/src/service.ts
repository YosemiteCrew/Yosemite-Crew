import { Extension, HealthcareService } from "@yosemite-crew/fhirtypes";

export type Service = {
  id: string;
  organisationId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  cost: number;              
  maxDiscount?: number | null;
  specialityId?: string | null;
  serviceType?: "CONSULTATION" | "OBSERVATION_TOOL";
  observationToolId?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export const EXT_DURATION = "https://yosemitecrew.com/fhir/StructureDefinition/service-duration-minutes";
export const EXT_COST = "https://yosemitecrew.com/fhir/StructureDefinition/service-cost";
export const EXT_MAX_DISCOUNT = "https://yosemitecrew.com/fhir/StructureDefinition/service-max-discount";
export const EXT_SERVICE_TYPE = "https://yosemitecrew.com/fhir/StructureDefinition/service-type";
export const EXT_OBSERVATION_TOOL_ID = "https://yosemitecrew.com/fhir/StructureDefinition/service-observation-tool-id";

export function toFHIRHealthcareService(service: Service) : HealthcareService {
  const extensions : Extension[] = [];

  // Duration
  if (service.durationMinutes != null) {
    extensions.push({
      url: EXT_DURATION,
      valueInteger: service.durationMinutes,
    });
  }

  // Cost
  if (service.cost != null) {
    extensions.push({
      url: EXT_COST,
      valueDecimal: service.cost,
    });
  }

  // Max discount
  if (service.maxDiscount != null) {
    extensions.push({
      url: EXT_MAX_DISCOUNT,
      valueDecimal: service.maxDiscount,
    });
  }

  if (service.serviceType) {
    extensions.push({
      url: EXT_SERVICE_TYPE,
      valueString: service.serviceType,
    });
  }

  if (service.observationToolId) {
    extensions.push({
      url: EXT_OBSERVATION_TOOL_ID,
      valueString: service.observationToolId,
    });
  }


  const FHIRService : HealthcareService = {
    resourceType: "HealthcareService",
    id: service.id,
    active: service.isActive,

    providedBy: {
      reference: `Organization/${service.organisationId}`,
    },

    name: service.name,
    comment: service.description ?? undefined,

    extension: extensions,
  }

  if (service.specialityId) {
    FHIRService.specialty = [
      {
        coding: [
          {
            system: "https://yosemite.health/fhir/CodeSystem/specialities",
            code: service.specialityId,
          },
        ],
      },
    ];
  }

  return FHIRService;
}

export function fromFHIRHealthCareService(FHIRHealthcareService : HealthcareService) : Service {

  const service : Service = {
    id: FHIRHealthcareService.id!,
    organisationId: FHIRHealthcareService.providedBy?.reference?.replace("Organization/", "")!,
    isActive: FHIRHealthcareService.active ? FHIRHealthcareService.active : true,

    name: FHIRHealthcareService.name!,
    description: FHIRHealthcareService.comment,
    specialityId:
      FHIRHealthcareService.specialty?.[0]?.coding?.[0]?.code ?? undefined,
    durationMinutes: 0,
    cost: 0,
    maxDiscount: undefined,
    serviceType: undefined,
    observationToolId: undefined,
  }

  // Parse extensions
  if (Array.isArray(FHIRHealthcareService.extension)) {
    for (const ext of FHIRHealthcareService.extension) {
      switch (ext.url) {
        case EXT_DURATION:
          service.durationMinutes = ext.valueInteger ?? 0;
          break;

        case EXT_COST:
          service.cost = ext.valueDecimal ?? 0;
          break;

        case EXT_MAX_DISCOUNT:
          service.maxDiscount = ext.valueDecimal ?? undefined;
          break;

        case EXT_SERVICE_TYPE:
          service.serviceType =
            (ext.valueString as Service["serviceType"]) ?? undefined;
          break;

        case EXT_OBSERVATION_TOOL_ID:
          service.observationToolId = ext.valueString ?? undefined;
          break;
      }
    }
  }

  return service;

}
