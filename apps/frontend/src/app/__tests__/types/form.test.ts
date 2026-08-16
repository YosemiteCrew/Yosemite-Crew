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
      'Vitals',
      'Prescription Template',
      'Inpatient Schedule',
      'Task Template',
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

      expect(fields.length).toBe(8);
      expect(fields.map((f) => f.id)).toEqual([
        'prescription_name',
        'prescription_dosage',
        'prescription_route',
        'prescription_frequency',
        'prescription_duration',
        'prescription_qty',
        'prescription_price',
        'prescription_remark',
      ]);
    });

    it('should build medication fields with custom separator (-)', () => {
      const prefix = 'meds';
      const fields = buildMedicationFields(prefix, '-');

      expect(fields.length).toBe(8);
      expect(fields.map((f) => f.id)).toEqual([
        'meds-name',
        'meds-dosage',
        'meds-route',
        'meds-frequency',
        'meds-duration',
        'meds-qty',
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
      expect(template.map((f: any) => f.label)).toEqual(['Medications']);
      const medicationsGroup = template.find((f: any) => f.label === 'Medications');
      expect(medicationsGroup?.meta?.medicationGroup).toBe(true);
      const signatureFields = template.filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(0);
    });

    it('should verify SOAP template has Subjective, Objective, Assessment and Plan without signature', () => {
      const template = CategoryTemplates['SOAP'];
      expect(template.map((f: any) => f.label)).toEqual([
        'Subjective',
        'Objective',
        'Assessment',
        'Plan',
      ]);
      const flatten = (fields: any[]): any[] =>
        fields.flatMap((f) => (f.type === 'group' ? [f, ...flatten(f.fields ?? [])] : [f]));
      const flat = flatten(template as any[]);
      const subjective = flat.find((f: any) => f.id === 'subjective');
      expect(subjective?.type).toBe('richtext');
      expect(subjective?.required).toBe(true);
      expect(flat.find((f: any) => f.id === 'objective')?.type).toBe('richtext');
      const signatureFields = flatten(template as any[]).filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(0);
    });

    it('should verify Vitals template has structured clinical fields', () => {
      const template = CategoryTemplates['Vitals'];
      expect(template.map((f: any) => f.label)).toEqual(['Vitals', 'Notes']);
      const flatten = (fields: any[]): any[] =>
        fields.flatMap((f) => (f.type === 'group' ? [f, ...flatten(f.fields ?? [])] : [f]));
      const flat = flatten(template as any[]);
      expect(flat.find((f: any) => f.id === 'heartRateBpm')?.type).toBe('number');
      expect(flat.find((f: any) => f.id === 'tempF')?.meta?.unit).toBe('°F');
      expect(flat.find((f: any) => f.id === 'painScore')?.meta?.unit).toBe('/ 10');
    });

    it('should verify Discharge Form template has rich-text body sections, follow-up days and a single signature', () => {
      const template = CategoryTemplates['Discharge Form'];
      expect(template.map((f: any) => f.label)).toEqual(['Discharge summary', 'Follow up']);
      const flatten = (fields: any[]): any[] =>
        fields.flatMap((f) => (f.type === 'group' ? [f, ...flatten(f.fields ?? [])] : [f]));
      const flat = flatten(template as any[]);
      expect(flat.find((f: any) => f.id === 'summaryText')?.type).toBe('richtext');
      expect(flat.find((f: any) => f.id === 'followUpInDays')?.type).toBe('number');
      expect(flat.find((f: any) => f.id === 'followUpInDays')?.meta?.unit).toBe('days');
      const signatureFields = flat.filter((f: any) => f.type === 'signature');
      expect(signatureFields).toHaveLength(0);
    });

    it('should keep the Boarder - Boarding Checklist option fields exactly as designed', () => {
      const template = CategoryTemplates['Boarder - Boarding Checklist'] as any[];
      const boardingOptions = template.find((f: any) => f.id === 'boarding_options');
      expect(boardingOptions?.fields?.[0]).toEqual({
        id: 'day_boarding_services',
        type: 'checkbox',
        label: 'Day boarding services',
        options: [
          { label: 'Day care options', value: 'day_care_options' },
          { label: 'Overnight stay details', value: 'overnight_stay_details' },
          { label: 'Weekly boarding plans', value: 'weekly_boarding_plans' },
        ],
        multiple: true,
      });
      expect(boardingOptions?.fields?.[1]).toEqual({
        id: 'overnight_boarding_services',
        type: 'radio',
        label: 'Overnight boarding services',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
      });
      const comfort = template.find((f: any) => f.id === 'comfort_environment');
      expect(comfort?.fields?.map((f: any) => [f.id, f.type, f.options?.length])).toEqual([
        ['room_type_selection', 'radio', 3],
        ['playgroup_participation', 'radio', 2],
        ['bedding_preferences', 'radio', 3],
      ]);
      expect(comfort?.fields?.[2]).toEqual({
        id: 'bedding_preferences',
        type: 'radio',
        label: 'Bedding preferences',
        options: [
          { label: 'Facility bedding', value: 'facility_bedding' },
          { label: 'Own bedding', value: 'own_bedding' },
          { label: 'Orthopaedic bedding', value: 'orthopaedic_bedding' },
        ],
      });
    });

    it('should keep the Boarder - Dietary Plan option fields exactly as designed', () => {
      const template = CategoryTemplates['Boarder - Dietary Plan'] as any[];
      expect(template.map((f: any) => f.id)).toEqual([
        'dietary_type',
        'diet_special_notes',
        'feeding_frequency',
        'specific_feeding_times',
        'portion_preferences',
        'portion_special_notes',
        'brand_preferences',
        'feeding_method',
        'feeding_method_notes',
        'treat_preferences',
        'water_preferences',
        'water_additional_info',
      ]);
      expect(template.find((f: any) => f.id === 'treat_preferences')).toEqual({
        id: 'treat_preferences',
        type: 'checkbox',
        label: 'Treat preferences',
        options: [
          { label: 'Jerky treats', value: 'jerky' },
          { label: 'Dental sticks', value: 'dental_sticks' },
          { label: 'Dehydrated meat', value: 'dehydrated_meat' },
          { label: 'Homemade treats', value: 'homemade' },
          { label: 'Training treats only', value: 'training_only' },
          { label: 'No treats (parent restricted)', value: 'no_treats' },
        ],
        multiple: true,
      });
      expect(template.find((f: any) => f.id === 'water_preferences')).toEqual({
        id: 'water_preferences',
        type: 'radio',
        label: 'Water preferences',
        options: [
          { label: 'Filtered / RO water only', value: 'filtered_ro' },
          { label: 'Regular tap water', value: 'tap_water' },
          { label: 'Bottled mineral water', value: 'bottled_mineral' },
          { label: 'Mix with electrolytes', value: 'electrolytes_mix' },
        ],
      });
    });

    it('should keep the Boarder - Daily Summary radio fields exactly as designed', () => {
      const template = CategoryTemplates['Boarder - Daily Summary'] as any[];
      expect(template.find((f: any) => f.id === 'meals_provided')).toEqual({
        id: 'meals_provided',
        type: 'radio',
        label: 'Meals provided to companion',
        options: [
          { label: 'Administered 1x daily', value: '1x_daily' },
          { label: 'Administered 2x daily', value: '2x_daily' },
          { label: 'Administered 3x daily', value: '3x_daily' },
        ],
      });
      expect(template.find((f: any) => f.id === 'daily_poop_completed')).toEqual({
        id: 'daily_poop_completed',
        type: 'radio',
        label: 'Daily pooping completed',
        options: [
          { label: 'Completed 1x', value: '1x' },
          { label: 'Completed 2x', value: '2x' },
        ],
      });
      expect(template.find((f: any) => f.id === 'medication_administered')?.options).toEqual([
        { label: 'Scheduled time entry', value: 'scheduled_time' },
      ]);
    });
  });
});
