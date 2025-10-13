import type { BusinessProfile, FhirOrganization } from "@yosemite-crew/types";

export function toFHIRBusinessProfile(input: BusinessProfile): FhirOrganization {
  const business = input.name!;
  return {
    resourceType: "Organization",
    id: business.userId,
    name: business.businessName,
    telecom: [
      {
        system: "phone",
        value: business.phoneNumber,
      },
      {
        system: "url",
        value: business.website,
      },
    ],
    address: [
      {
        line: [business.addressLine1],
        city: business.city,
        state: business.state,
        postalCode: business.postalCode,
        country: input.country,
        area: business.area || "", // Optional area field
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/latitude",
            valueString: business.latitude,
          },
          {
            url: "http://example.org/fhir/StructureDefinition/longitude",
            valueString: business.longitude,
          },
        ],
      },
    ],
    
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/registrationNumber",
        valueString: business.registrationNumber,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/departmentFeatureActive",
        valueString: input.departmentFeatureActive,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/selectedServices",
        valueString: JSON.stringify(input.selectedServices),
      },
      {
        url: "http://example.org/fhir/StructureDefinition/addDepartment",
        valueString: JSON.stringify(input.addDepartment),
      },
      {
        url: "http://example.org/fhir/StructureDefinition/image",
        valueString: input.image ?? "",
      },
      {
        url:"http://example.org/fhir/StructureDefinition/key",
        valueString: JSON.stringify(input.key),
      },
      {
        url:"http://example.org/fhir/StructureDefinition/progress",
        valueString:  JSON.stringify(input.progress)
      }
    
    ],
    
  };
}
