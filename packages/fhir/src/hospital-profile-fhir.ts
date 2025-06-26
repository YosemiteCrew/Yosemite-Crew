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
        value: business.PhoneNumber,
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
    ],
  };
}

export function fromFHIRBusinessProfile(fhir: FhirOrganization): BusinessProfile {
  const address = fhir.address?.[0] || {
    line: [""],
    city: "",
    state: "",
    postalCode: "",
    country: "",
    extension: [],
  };

  const getExt = (url: string): string =>
    fhir.extension?.find((e) => e.url === url)?.valueString ?? "";

  const parseExtArray = (url: string): string[] => {
    const raw = getExt(url);
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const latitude =
    address.extension?.find((e) => e.url.includes("latitude"))?.valueString || "";

  const longitude =
    address.extension?.find((e) => e.url.includes("longitude"))?.valueString || "";

  return {
    name: {
      userId: fhir.id || "",
      businessName: fhir.name,
      website: fhir.telecom?.find((t) => t.system === "url")?.value || "",
      PhoneNumber: fhir.telecom?.find((t) => t.system === "phone")?.value || "",
      addressLine1: address.line?.[0] || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "",
      latitude,
      longitude,
      registrationNumber: getExt("http://example.org/fhir/StructureDefinition/registrationNumber"),
    },
    country: address.country || "",
    departmentFeatureActive: getExt("http://example.org/fhir/StructureDefinition/departmentFeatureActive"),
    selectedServices: parseExtArray("http://example.org/fhir/StructureDefinition/selectedServices"),
    addDepartment: parseExtArray("http://example.org/fhir/StructureDefinition/addDepartment"),
    image: null,
    previewUrl: "",
  };
}
