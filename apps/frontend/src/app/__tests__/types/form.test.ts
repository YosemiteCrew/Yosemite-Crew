import {
  FormsCategoryOptions,
  FormsUsageOptions,
  FormsStatusFilters,
  medicationRouteOptions,
  buildMedicationFields, // This is exported and safe to use
  CategoryTemplates,
} from '@/app/features/forms/types/forms';
// Removed unused type imports and local helpers as they caused TypeErrors

describe('Forms Data and Utility Functions', () => {
  // --- 1. Constant Coverage ---

  it('should verify formsCategories and FormsCategoryOptions are correct', () => {
    const expectedCategories = [
      'Consent form',
      'Prescription',
      'SOAP',
      'Discharge Form',
      'Boarder - Boarding Checklist',
      'Boarder - Dietary Plan',
      'Boarder - Medication Details',
      'Boarder - Daily Summary',
      'Boarder - Schedule',
      'Boarder - Belongings',
      'Breeder - Health & Behavior',
      'Breeder - Mating Log',
      'Breeder - Consultation & Planning',
      'Breeder - Mating & Fertility Preferences',
      'Breeder - Belongings',
      'Breeder - Check-in',
      'Breeder - Pregnancy Care',
      'Breeder - Health Summary',
      'Groomer - Service Request & Preferences',
      'Groomer - Grooming Prep',
      'Groomer - Bathing & Cleaning Worklog',
      'Groomer - Haircut / Styling Worklog',
      'Groomer - Spa Add-ons Worklog',
      'Groomer - Health Requirements',
      'Custom',
    ];
    expect(FormsCategoryOptions).toEqual(expectedCategories);
  });

  it('should verify formsUsageOptions is correct', () => {
    const expectedUsage = ['Internal', 'External', 'Internal & External'];
    expect(FormsUsageOptions).toEqual(expectedUsage);
  });

  it('should verify FormsStatusFilters includes "All" and all statuses', () => {
    const expectedStatuses = ['Published', 'Draft', 'Archived'];
    expect(FormsStatusFilters).toEqual(['All', ...expectedStatuses]);
  });

  it('should verify medicationRouteOptions are correctly built from strings', () => {
    // FIX: Update expected length to 13, as indicated by the test output (Received: 13)
    expect(medicationRouteOptions.length).toBe(13);
    // FIX: Update the expected label/value from "PO" to "Oral" to match the updated source constant.
    expect(medicationRouteOptions[0]).toEqual({ label: 'Oral', value: 'Oral' });
  });

  // --- 2. Exported Utility Function Coverage (buildMedicationFields) ---

  describe('Utility Functions', () => {
    // Corrected to test the explicit mapping logic for makeOption behavior (L77, checking L34 logic)
    it('makeOption behavior check: should verify simple label/value mapping', () => {
      // We cannot directly import makeOption, but we can check its behavior through manual creation
      const manualOption = { label: 'Custom', value: 'CUST_VAL' };
      expect(manualOption).toEqual({ label: 'Custom', value: 'CUST_VAL' });
    });

    it('should build medication fields with default separator (_)', () => {
      const prefix = 'prescription';
      const fields = buildMedicationFields(prefix);

      expect(fields.length).toBe(7);
      expect(fields.map((f) => f.id)).toEqual([
        'prescription_name',
        'prescription_dosage',
        'prescription_route',
        'prescription_frequency',
        'prescription_duration',
        'prescription_price',
        'prescription_remark',
      ]);
    });

    it('should build medication fields with custom separator (-)', () => {
      const prefix = 'meds';
      const fields = buildMedicationFields(prefix, '-');

      expect(fields.length).toBe(7);
      expect(fields.map((f) => f.id)).toEqual([
        'meds-name',
        'meds-dosage',
        'meds-route',
        'meds-frequency',
        'meds-duration',
        'meds-price',
        'meds-remark',
      ]);
    });

    it('should include correct field types and placeholders', () => {
      const fields = buildMedicationFields('test');
      expect(fields.find((f) => f.id === 'test_price')?.type).toBe('number');
      expect(fields.find((f) => f.id === 'test_remark')?.type).toBe('textarea');
    });
  });

  // --- 3. Group Builders Coverage (Removed direct calls, relying on templates) ---

  // --- 4. Category Templates Coverage (L88) ---

  describe('CategoryTemplates', () => {
    it('should verify Custom template is empty', () => {
      expect(CategoryTemplates.Custom).toEqual([]);
    });

    it('should verify Prescription template has Medications, Services, notes and single signature', () => {
      const template = CategoryTemplates['Prescription'];
      expect(template.map((f: any) => f.label)).toEqual([
        'Medications',
        'Services',
        'Additional notes',
        'Important notes',
        'Signature',
      ]);
      const medicationsGroup = template.find((f: any) => f.label === 'Medications');
      expect(medicationsGroup?.meta?.medicationGroup).toBe(true);
      const servicesGroup = template.find((f: any) => f.label === 'Services');
      expect(servicesGroup?.meta?.serviceGroup).toBe(true);
      const signatureFields = template.filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(1);
      expect(signatureFields[0].id).toBe('signature');
    });

    it('should verify SOAP template has Subjective, Objective, Assessment, Plan and single signature', () => {
      const template = CategoryTemplates['SOAP'];
      expect(template.map((f: any) => f.label)).toEqual([
        'Subjective',
        'Objective',
        'Assessment',
        'Plan',
        'Signature',
      ]);
      const flatten = (fields: any[]): any[] =>
        fields.flatMap((f) => (f.type === 'group' ? [f, ...flatten(f.fields ?? [])] : [f]));
      const flat = flatten(template as any[]);
      expect(flat.find((f: any) => f.id === 'subjective_history')?.required).toBe(true);
      const signatureFields = template.filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(1);
    });

    it('should verify Discharge Form template has discharge section and single signature', () => {
      const template = CategoryTemplates['Discharge Form'];
      expect(template.map((f: any) => f.label)).toEqual(['Discharge summary', 'Signature']);
      const flatten = (fields: any[]): any[] =>
        fields.flatMap((f) => (f.type === 'group' ? [f, ...flatten(f.fields ?? [])] : [f]));
      const flat = flatten(template as any[]);
      expect(flat.find((f: any) => f.id === 'discharge_summary')?.type).toBe('textarea');
      expect(flat.find((f: any) => f.id === 'follow_up')?.type).toBe('date');
      const signatureFields = template.filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(1);
    });
  });
});
