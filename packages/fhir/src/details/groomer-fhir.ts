import type { PetGroomer } from '@yosemite-crew/types';
import type { FhirOrganization } from './fhir-organization-validator';

export function toFhirOrganizationGroomer(groomer: PetGroomer): FhirOrganization {
  return {
    resourceType: "Organization",
    id: groomer._id?.toString() ?? '',
    name: groomer.groomerName ?? '', // ✅ fixed here
    telecom: [
        groomer.telephone ? { system: "phone" as const, value: groomer.telephone } : null,
        groomer.emailAddress ? { system: "email" as const, value: groomer.emailAddress } : null,
        groomer.website ? { system: "url" as const, value: groomer.website } : null
        ].filter(Boolean) as { system: "phone" | "email" | "url"; value: string }[],
    address: [
      {
        line: [groomer.groomerAddress ?? ''],
        city: groomer.city ?? '',
        postalCode: groomer.zipCode ?? '',
        country: groomer.country ?? ''
      }
    ]
  };
}
