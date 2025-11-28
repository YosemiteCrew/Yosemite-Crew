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
  headOfServiceId?: string | null;
  teamMemberIds?: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export const EXT_DURATION = "https://yosemitecrew.com/fhir/StructureDefinition/service-duration-minutes";
export const EXT_COST = "https://yosemitecrew.com/fhir/StructureDefinition/service-cost";
export const EXT_MAX_DISCOUNT = "https://yosemitecrew.com/fhir/StructureDefinition/service-max-discount";
export const EXT_HEAD = "https://yosemitecrew.com/fhir/StructureDefinition/service-head-of-service";
export const EXT_TEAM = "https://yosemitecrew.com/fhir/StructureDefinition/service-team-member";

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

  // Head of service
  if (service.headOfServiceId) {
    extensions.push({
      url: EXT_HEAD,
      valueString: service.headOfServiceId,
    });
  }

  // Team members
  if (service.teamMemberIds?.length) {
    service.teamMemberIds.forEach((id) =>
      extensions.push({
        url: EXT_TEAM,
        valueString: id
      }),
    );
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
    isActive: !FHIRHealthcareService.active ? true : FHIRHealthcareService.active,

    name: FHIRHealthcareService.name!,
    description: FHIRHealthcareService.comment,
    specialityId:
      FHIRHealthcareService.specialty?.[0]?.coding?.[0]?.code ?? undefined,
    durationMinutes: 0,
    cost: 0,
    maxDiscount: undefined,
    headOfServiceId: undefined,
    teamMemberIds: [],
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

        case EXT_HEAD:
          service.headOfServiceId = ext.valueString
          break;

        case EXT_TEAM:
          if (ext.valueString) {
            service.teamMemberIds!.push(
              ext.valueString
            );
          }
          break;
      }
    }
  }

  return service;

}