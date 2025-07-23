import type { PetBoarding } from '@yosemite-crew/types';
import type { FhirOrganization } from './fhir-organization-validator'; // adjust if needed

export function toFhirOrganizationBoarding(petboarding: PetBoarding): FhirOrganization {
  return {
    resourceType: "Organization",
    id: petboarding._id?.toString() ?? '',
    name: petboarding.boardingName ?? '',
    telecom: [
      petboarding.telephone ? { system: "phone" as const, value: petboarding.telephone } : null,
      petboarding.emailAddess ? { system: "email" as const, value: petboarding.emailAddess } : null,
      petboarding.website ? { system: "url" as const, value: petboarding.website } : null
    ].filter(Boolean) as { system: "phone" | "email" | "url"; value: string }[],
    address: [
      {
        line: [petboarding.boardingAddress ?? ''],
        city: petboarding.city ?? '',
        postalCode: petboarding.zipCode ?? '',
        country: petboarding.country ?? ''
      }
    ]
  };
}