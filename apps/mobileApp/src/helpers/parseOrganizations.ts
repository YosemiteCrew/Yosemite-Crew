// src/helpers/parseOrganizations.ts
import { type FHIROrganizationResource, type SimpleOrganization } from '@/types/api';

export const parseOrganizations = (
  data: (FHIROrganizationResource | null | undefined)[]
): SimpleOrganization[] => {
  if (!Array.isArray(data)) return [];

  return data
    .filter((org): org is FHIROrganizationResource => !!org)
    .map(org => {
      const phone = org.telecom?.find(t => t.system === 'phone')?.value || '';
      const email = org.telecom?.find(t => t.system === 'email')?.value || '';
      const url = org.telecom?.find(t => t.system === 'url')?.value || '';

      const addressObj = org.address?.[0] || {};
      const address = [
        ...(addressObj.line || []),
        addressObj.city,
        addressObj.postalCode,
        addressObj.country,
      ]
        .filter(Boolean)
        .join(', ');

      return {
        id: org.id,
        name: org.name,
        phone,
        email,
        url,
        address,
        city: addressObj.city || '',
      };
    });
};