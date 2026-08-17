import {
  buildClinicalExamPayload,
  buildParasiteTreatmentPayload,
  buildPassportIssuancePayload,
  buildRabiesTitrationPayload,
  buildVaccinationPayload,
  EMPTY_CLINICAL_EXAM_DRAFT,
  EMPTY_PARASITE_TREATMENT_DRAFT,
  EMPTY_PASSPORT_ISSUANCE_DRAFT,
  EMPTY_RABIES_TITRATION_DRAFT,
  EMPTY_VACCINATION_DRAFT,
  validateClinicalExamDraft,
  validateParasiteTreatmentDraft,
  validatePassportIssuanceDraft,
  validateRabiesTitrationDraft,
  validateVaccinationDraft,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportDrafts';
import { hasFieldErrors } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportFieldValidation';

describe('vaccination draft', () => {
  it('requires the vaccine name and the administration date', () => {
    const errors = validateVaccinationDraft(EMPTY_VACCINATION_DRAFT);
    expect(errors.vaccineName).toBe('Vaccine name is required.');
    expect(errors.dateAdministered).toBe('Date administered is required.');
  });

  it('validates the optional dates with the same calendar rule', () => {
    const errors = validateVaccinationDraft({
      ...EMPTY_VACCINATION_DRAFT,
      vaccineName: 'Nobivac',
      dateAdministered: '2026-02-14',
      validUntil: '2027-02-30',
    });
    expect(errors.validUntil).toBe(
      'Valid until must be a real calendar date in YYYY-MM-DD format.'
    );
    expect(errors.validFrom).toBeUndefined();
  });

  it('omits every blank optional field from the payload', () => {
    const payload = buildVaccinationPayload({
      ...EMPTY_VACCINATION_DRAFT,
      vaccineType: 'CORE',
      vaccineName: '  Nobivac DHPPi  ',
      dateAdministered: '2026-02-14',
      batchNumber: 'B-77',
    });
    expect(payload).toEqual({
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      dateAdministered: '2026-02-14',
      manufacturer: undefined,
      batchNumber: 'B-77',
      lotNumber: undefined,
      validFrom: undefined,
      validUntil: undefined,
      nextDueDate: undefined,
      administeringVetName: undefined,
      vetLicenseNumber: undefined,
      site: undefined,
      route: undefined,
      notes: undefined,
    });
  });
});

describe('parasite treatment draft', () => {
  it('requires the product and a real treatment instant', () => {
    const errors = validateParasiteTreatmentDraft(EMPTY_PARASITE_TREATMENT_DRAFT);
    expect(errors.productName).toBe('Product name is required.');
    expect(errors.treatedAt).toBe('Treated at is required.');
  });

  it('sends the treatment time as a full ISO instant, not a local one', () => {
    const payload = buildParasiteTreatmentPayload({
      ...EMPTY_PARASITE_TREATMENT_DRAFT,
      productName: 'Milbemax',
      treatedAt: '2026-02-14T09:30',
      manufacturer: 'Elanco',
    });
    expect(payload.treatedAt).toBe(new Date('2026-02-14T09:30').toISOString());
    expect(payload.treatmentType).toBe('ECHINOCOCCUS');
    expect(payload.manufacturer).toBe('Elanco');
    expect(payload.notes).toBeUndefined();
  });

  it('falls back to the raw value when it is not a convertible instant', () => {
    const payload = buildParasiteTreatmentPayload({
      ...EMPTY_PARASITE_TREATMENT_DRAFT,
      productName: 'Milbemax',
      treatedAt: ' 2026-02-30T09:30 ',
    });
    expect(payload.treatedAt).toBe('2026-02-30T09:30');
  });
});

describe('rabies titration draft', () => {
  it('requires the lab, the sample date and a non-negative result', () => {
    const errors = validateRabiesTitrationDraft({
      ...EMPTY_RABIES_TITRATION_DRAFT,
      resultIuMl: '-2',
    });
    expect(errors.approvedLab).toBe('Approved laboratory is required.');
    expect(errors.sampleDate).toBe('Sample date is required.');
    expect(errors.resultIuMl).toBe('Result must be 0 or more.');
  });

  it('sends the result as a number', () => {
    const payload = buildRabiesTitrationPayload({
      approvedLab: 'EU Reference Lab',
      sampleDate: '2026-02-14',
      resultIuMl: ' 0.7 ',
      reportUrl: '',
    });
    expect(payload).toEqual({
      approvedLab: 'EU Reference Lab',
      sampleDate: '2026-02-14',
      resultIuMl: 0.7,
      reportUrl: undefined,
    });
  });
});

describe('clinical exam draft', () => {
  it('requires the examination instant and validates the optional measurements', () => {
    const errors = validateClinicalExamDraft({
      ...EMPTY_CLINICAL_EXAM_DRAFT,
      weightKg: '-1',
      temperatureC: 'warm',
    });
    expect(errors.examinedAt).toBe('Examined at is required.');
    expect(errors.weightKg).toBe('Weight must be 0 or more.');
    expect(errors.temperatureC).toBe('Temperature must be a number.');
  });

  it('maps the fit-for-travel choice onto the boolean attestation', () => {
    const payload = buildClinicalExamPayload({
      examinedAt: '2026-02-14T09:30',
      fitForTravel: 'NO',
      findings: 'Mild dental tartar',
      weightKg: '12.4',
      temperatureC: '',
    });
    expect(payload).toEqual({
      examinedAt: new Date('2026-02-14T09:30').toISOString(),
      fitForTravel: false,
      findings: 'Mild dental tartar',
      weightKg: 12.4,
      temperatureC: undefined,
    });
  });

  it('keeps the raw examination value when it cannot become an instant', () => {
    const payload = buildClinicalExamPayload({
      ...EMPTY_CLINICAL_EXAM_DRAFT,
      examinedAt: '2026-02-30T09:30',
    });
    expect(payload.examinedAt).toBe('2026-02-30T09:30');
    expect(payload.fitForTravel).toBe(true);
  });
});

describe('passport issuance draft', () => {
  it('requires only the passport number', () => {
    const errors = validatePassportIssuanceDraft(EMPTY_PASSPORT_ISSUANCE_DRAFT);
    expect(errors.passportNumber).toBe('Passport number is required.');
    expect(
      hasFieldErrors(
        validatePassportIssuanceDraft({
          ...EMPTY_PASSPORT_ISSUANCE_DRAFT,
          passportNumber: 'UK-2026-001',
        })
      )
    ).toBe(false);
  });

  it('trims the number and omits the blank issuing details', () => {
    expect(
      buildPassportIssuancePayload({
        ...EMPTY_PASSPORT_ISSUANCE_DRAFT,
        passportNumber: '  UK-2026-001 ',
        issuingCountry: 'United Kingdom',
      })
    ).toEqual({
      passportNumber: 'UK-2026-001',
      issuingCountry: 'United Kingdom',
      issuingAuthority: undefined,
      issuingVetName: undefined,
      issuingVetLicense: undefined,
    });
  });
});
