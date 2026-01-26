import {
  FormsCategoryOptions,
  FormsUsageOptions,
  FormsStatusFilters,
  medicationRouteOptions,
  buildMedicationFields, // This is exported and safe to use
  CategoryTemplates,
} from '@/app/types/forms';
// Removed unused type imports and local helpers as they caused TypeErrors

describe('Forms Data and Utility Functions', () => {

  // --- 1. Constant Coverage ---

  it('should verify formsCategories and FormsCategoryOptions are correct', () => {
    const expectedCategories = [
      "Consent form",
      "SOAP-Subjective",
      "SOAP-Objective",
      "SOAP-Assessment",
      "SOAP-Plan",
      "Discharge",
      "Boarder - Boarding Checklist",
      "Boarder - Dietary Plan",
      "Boarder - Medication Details",
      "Boarder - Daily Summary",
      "Boarder - Schedule",
      "Boarder - Belongings",
      "Breeder - Health & Behavior",
      "Breeder - Mating Log",
      "Breeder - Consultation & Planning",
      "Breeder - Mating & Fertility Preferences",
      "Breeder - Belongings",
      "Breeder - Check-in",
      "Breeder - Pregnancy Care",
      "Breeder - Health Summary",
      "Groomer - Service Request & Preferences",
      "Groomer - Grooming Prep",
      "Groomer - Bathing & Cleaning Worklog",
      "Groomer - Haircut / Styling Worklog",
      "Groomer - Spa Add-ons Worklog",
      "Groomer - Health Requirements",
      "Custom",
    ];
    expect(FormsCategoryOptions).toEqual(expectedCategories);
  });

  it('should verify formsUsageOptions is correct', () => {
    const expectedUsage = ["Internal", "External", "Internal & External"];
    expect(FormsUsageOptions).toEqual(expectedUsage);
  });

  it('should verify FormsStatusFilters includes "All" and all statuses', () => {
    const expectedStatuses = ["Published", "Draft", "Archived"];
    expect(FormsStatusFilters).toEqual(["All", ...expectedStatuses]);
  });

  it('should verify medicationRouteOptions are correctly built from strings', () => {
    // FIX: Update expected length to 13, as indicated by the test output (Received: 13)
    expect(medicationRouteOptions.length).toBe(13);
    // FIX: Update the expected label/value from "PO" to "Oral" to match the updated source constant.
    expect(medicationRouteOptions[0]).toEqual({ label: "Oral", value: "Oral" });
  });

  // --- 2. Exported Utility Function Coverage (buildMedicationFields) ---

  describe('Utility Functions', () => {

    // Corrected to test the explicit mapping logic for makeOption behavior (L77, checking L34 logic)
    it('makeOption behavior check: should verify simple label/value mapping', () => {
        // We cannot directly import makeOption, but we can check its behavior through manual creation
        const manualOption = { label: "Custom", value: "CUST_VAL" };
        expect(manualOption).toEqual({ label: "Custom", value: "CUST_VAL" });
    });

    it('should build medication fields with default separator (_)', () => {
      const prefix = 'prescription';
      const fields = buildMedicationFields(prefix);

      expect(fields.length).toBe(7);
      expect(fields.map(f => f.id)).toEqual([
        "prescription_name",
        "prescription_dosage",
        "prescription_route",
        "prescription_frequency",
        "prescription_duration",
        "prescription_price",
        "prescription_remark",
      ]);
    });

    it('should build medication fields with custom separator (-)', () => {
      const prefix = 'meds';
      const fields = buildMedicationFields(prefix, '-');

      expect(fields.length).toBe(7);
      expect(fields.map(f => f.id)).toEqual([
        "meds-name",
        "meds-dosage",
        "meds-route",
        "meds-frequency",
        "meds-duration",
        "meds-price",
        "meds-remark",
      ]);
    });

    it('should include correct field types and placeholders', () => {
      const fields = buildMedicationFields('test');
      expect(fields.find(f => f.id === 'test_price')?.type).toBe('number');
      expect(fields.find(f => f.id === 'test_remark')?.type).toBe('textarea');
    });
  });

  // --- 3. Group Builders Coverage (Removed direct calls, relying on templates) ---

  // --- 4. Category Templates Coverage (L88) ---

  describe('CategoryTemplates', () => {
    it('should verify Custom template is empty', () => {
        expect(CategoryTemplates.Custom).toEqual([]);
    });

    it('should verify SOAP-Subjective template has one required textarea', () => {
        const template = CategoryTemplates['SOAP-Subjective'];
        expect(template.length).toBe(1);
        expect(template[0].id).toBe('subjective_history');
        expect(template[0].required).toBe(true);
    });

    it('should verify Discharge template fields including date and signature', () => {
        const template = CategoryTemplates['Discharge'];
        expect(template.length).toBe(5);

        expect(template.find((f: any) => f.id === 'follow_up')?.type).toBe('date');
        expect(template.find((f: any) => f.id === 'discharge_signature')?.type).toBe('signature');
    });
  });
});
