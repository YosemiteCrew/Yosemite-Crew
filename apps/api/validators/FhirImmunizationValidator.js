class FhirImmunizationValidator {
    static validate(data) {
      const requiredFields = [
        'resourceType',
        'status',
        'vaccineCode',
        'patient',
        'occurrenceDateTime',
        'manufacturer',
        'lotNumber',
        'expirationDate'
      ];
  
      for (const field of requiredFields) {
        if (!data[field]) {
          return { valid: false, error: `Missing field: ${field}` };
        }
      }
  
      if (data.resourceType !== 'Immunization') {
        return { valid: false, error: 'Invalid resourceType' };
      }
  
      return { valid: true };
    }
  }
  
  module.exports = FhirImmunizationValidator;
  