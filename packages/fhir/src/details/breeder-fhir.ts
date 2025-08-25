import type { breeder } from '@yosemite-crew/types';
export function toFhirOrganizationBreeder(breeder: breeder): {
  resourceType: string;
  id: string;
  name?: string;
  telecom: { system: string; value: string }[];
  address: {
    line: string[];
    city?: string;
    postalCode?: string;
    country?: string;
  }[];
} {
  return {
    resourceType: "Organization",
    id: breeder._id?.toString() ?? '', 
    name: breeder.breederName,
    telecom: [
      breeder.telephone ? { system: "phone", value: breeder.telephone } : null,
      breeder.emailAddress ? { system: "email", value: breeder.emailAddress } : null,
      breeder.website ? { system: "url", value: breeder.website } : null
    ].filter(Boolean) as { system: string; value: string }[],
    address: [
      {
        line: [breeder.breederAddress ?? ''],
        city: breeder.city,
        postalCode: breeder.zipCode,
        country: breeder.country
      }
    ]
  };
}
