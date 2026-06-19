import { createPmpSubmissionService } from '../src/compliance/pmp-submission';

describe('createPmpSubmissionService', () => {
  let idCounter = 0;
  const makeDeps = (nowVal = 1000) => ({
    now: jest.fn(() => nowVal),
    generateId: jest.fn(() => `pmp-test-${++idCounter}`),
  });

  beforeEach(() => {
    idCounter = 0;
  });

  test('addSubmission creates pending submission', () => {
    const deps = makeDeps();
    const svc = createPmpSubmissionService(deps);

    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'DEA-123',
      prescriberNpi: 'NPI-456',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });

    expect(sub.status).toBe('pending');
    expect(sub.id).toBe('pmp-test-1');
    expect(svc.getPending()).toHaveLength(1);
  });

  test('markSubmitted updates status', () => {
    const svc = createPmpSubmissionService(makeDeps(1000));
    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'D1',
      prescriberNpi: 'N1',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });

    expect(svc.markSubmitted(sub.id)).toBe(true);
    expect(svc.getSubmitted()).toHaveLength(1);
    expect(svc.getPending()).toHaveLength(0);
  });

  test('markFailed updates status with error', () => {
    const svc = createPmpSubmissionService(makeDeps(1000));
    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'D1',
      prescriberNpi: 'N1',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });

    expect(svc.markFailed(sub.id, 'Rejected')).toBe(true);
    expect(svc.getFailed()).toHaveLength(1);
    expect(svc.getFailed()[0].error).toBe('Rejected');
  });

  test('markSubmitted returns false for unknown id', () => {
    const svc = createPmpSubmissionService(makeDeps());
    expect(svc.markSubmitted('unknown')).toBe(false);
  });

  test('markFailed returns false for unknown id', () => {
    const svc = createPmpSubmissionService(makeDeps());
    expect(svc.markFailed('unknown', 'error')).toBe(false);
  });

  test('generateBatchFile creates CSV', () => {
    const svc = createPmpSubmissionService(makeDeps(1000));
    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'DEA-123',
      prescriberNpi: 'NPI-456',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });

    const csv = svc.generateBatchFile([sub], 'CA');
    expect(csv).toContain('State,DEANumber,NPI');
    expect(csv).toContain('CA,DEA-123,NPI-456');
    expect(csv).toContain('Ketamine,CIII,10,30,0');
  });

  test('getAll returns all submissions', () => {
    const svc = createPmpSubmissionService(makeDeps());
    svc.addSubmission({
      state: 'CA',
      deaNumber: 'D1',
      prescriberNpi: 'N1',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });
    svc.addSubmission({
      state: 'NV',
      deaNumber: 'D2',
      prescriberNpi: 'N2',
      prescriptionId: 'rx-2',
      patientIdentifier: 'pet-2',
      drugName: 'Dexdomitor',
      drugClass: 'CII',
      quantity: 5,
      daysSupply: 1,
      refills: 0,
    });

    expect(svc.getAll()).toHaveLength(2);
  });

  test('uses default generateId when not provided', () => {
    const svc = createPmpSubmissionService({ now: () => 1000 });
    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'D1',
      prescriberNpi: 'N1',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });
    expect(sub.id).toMatch(/^pmp-/);
    expect(sub.timestamp).toBe(1000);
  });

  test('uses default now when not provided', () => {
    const svc = createPmpSubmissionService();
    const sub = svc.addSubmission({
      state: 'CA',
      deaNumber: 'D1',
      prescriberNpi: 'N1',
      prescriptionId: 'rx-1',
      patientIdentifier: 'pet-1',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      quantity: 10,
      daysSupply: 30,
      refills: 0,
    });
    expect(typeof sub.timestamp).toBe('number');
  });
});
