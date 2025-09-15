// src/helpers/buildOrganizationFHIR.ts
import { type OrganizationDetails, type FHIROrganization } from '@/types/api';

export const buildOrganizationFHIR = ({
  id,
  name,
  email,
  website,
  phone,
  address,
  city,
  country,
  postalCode,
  subjectReference,
}: OrganizationDetails): FHIROrganization => {
  return {
    resourceType: 'Organization',
    id: id || `org-${Date.now()}`,
    name: name || '',
    ...(subjectReference
      ? {
          subject: {
            reference: `patient/${subjectReference}`,
          },
        }
      : {}),
    telecom: [
      ...(phone ? [{ system: 'phone' as const, value: phone }] : []),
      ...(email ? [{ system: 'email' as const, value: email }] : []),
      ...(website ? [{ system: 'url' as const, value: website }] : []),
    ],
    address: [
      {
        ...(address ? { line: [address] } : {}),
        ...(city ? { city } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(country ? { country } : {}),
      },
    ],
  };
};