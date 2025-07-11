import type { BasicImmunizationResource } from "@yosemite-crew/types";

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validate = (
  data: Partial<BasicImmunizationResource>
): ValidationResult => {
  const requiredFields: (keyof BasicImmunizationResource)[] = [
    'resourceType',
    'status',
    'vaccineCode',
    'patient',
    'occurrenceDateTime',
    'manufacturer',
    'lotNumber',
    'expirationDate',
  ];

  for (const field of requiredFields) {
  const value = data[field];

  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return { valid: false, error: `Missing field: ${field}` };
  }
}


  if (data.resourceType !== 'Immunization') {
    return { valid: false, error: 'Invalid resourceType' };
  }

  return { valid: true };
};
