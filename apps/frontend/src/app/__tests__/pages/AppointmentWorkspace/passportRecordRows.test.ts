import type {
  ClinicalExamDTO,
  ParasiteTreatmentDTO,
  PetPassportDTO,
  RabiesTitrationDTO,
  VaccinationDTO,
} from '@yosemite-crew/types';
import {
  buildSignedRecordRows,
  toClinicalExamRow,
  toParasiteTreatmentRow,
  toRabiesTitrationRow,
  toVaccinationRow,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportRecordRows';
import { formatDateTimeLocal, formatDisplayDate } from '@/app/lib/date';

const rabies: VaccinationDTO = {
  id: 'vac-rabies',
  patientId: 'pat-1',
  vaccineType: 'RABIES',
  vaccineName: 'Nobivac Rabies',
  dateAdministered: '2026-02-14',
  createdAt: '2026-02-14T09:00:00.000Z',
};

const treatment: ParasiteTreatmentDTO = {
  id: 'trt-1',
  patientId: 'pat-1',
  treatmentType: 'ECHINOCOCCUS',
  productName: 'Milbemax',
  treatedAt: '2026-02-14T09:30:00.000Z',
  createdAt: '2026-02-14T09:30:00.000Z',
};

const titration: RabiesTitrationDTO = {
  id: 'tit-1',
  patientId: 'pat-1',
  approvedLab: 'EU Reference Lab',
  sampleDate: '2026-03-01',
  resultIuMl: 0.7,
  createdAt: '2026-03-02T09:00:00.000Z',
};

const exam: ClinicalExamDTO = {
  id: 'exam-1',
  patientId: 'pat-1',
  examinedAt: '2026-03-05T08:15:00.000Z',
  fitForTravel: true,
  createdAt: '2026-03-05T08:15:00.000Z',
};

describe('record row mappers', () => {
  it('describes a vaccination by type and administration date', () => {
    expect(toVaccinationRow(rabies, 'DRAFT')).toEqual({
      id: 'vac-rabies',
      kind: 'VACCINATION',
      title: 'Nobivac Rabies',
      detail: `Rabies · given ${formatDisplayDate('2026-02-14', 'date not recorded')}`,
      status: 'DRAFT',
    });
  });

  it('keeps the treatment time on a parasite treatment row', () => {
    expect(toParasiteTreatmentRow(treatment, 'SIGNED')).toEqual({
      id: 'trt-1',
      kind: 'TREATMENT',
      title: 'Milbemax',
      detail: `Echinococcus · treated ${formatDateTimeLocal(
        '2026-02-14T09:30:00.000Z',
        'date not recorded'
      )}`,
      status: 'SIGNED',
    });
  });

  it('leads a titration row with the titre', () => {
    const row = toRabiesTitrationRow(titration, 'DRAFT');
    expect(row.title).toBe('0.7 IU/ml');
    expect(row.detail).toContain('EU Reference Lab');
  });

  it('states the travel decision on an exam row', () => {
    expect(toClinicalExamRow(exam, 'SIGNED').title).toBe('Fit for travel');
    expect(toClinicalExamRow({ ...exam, fitForTravel: false }, 'DRAFT').title).toBe(
      'Not fit for travel'
    );
  });

  it('falls back when a record carries no usable date', () => {
    expect(toVaccinationRow({ ...rabies, dateAdministered: '' }, 'DRAFT').detail).toContain(
      'date not recorded'
    );
  });
});

describe('buildSignedRecordRows', () => {
  const passport: PetPassportDTO = {
    identity: { id: 'pat-1', name: 'Bella', species: 'dog', breed: 'Beagle', sex: 'Female' },
    vaccinations: [rabies],
    parasiteTreatments: [treatment],
    rabiesTitrations: [titration],
    clinicalExams: [exam],
    rabies,
  };

  it('returns nothing when the passport has not loaded', () => {
    expect(buildSignedRecordRows(null)).toEqual([]);
    expect(buildSignedRecordRows()).toEqual([]);
  });

  it('marks every record the passport carries as signed', () => {
    const rows = buildSignedRecordRows(passport);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.status === 'SIGNED')).toBe(true);
    expect(rows.map((row) => row.kind)).toEqual(['VACCINATION', 'TITRATION', 'TREATMENT', 'EXAM']);
  });

  it('does not list the rabies dose twice when it is also in the vaccination list', () => {
    const rows = buildSignedRecordRows(passport);
    expect(rows.filter((row) => row.id === 'vac-rabies')).toHaveLength(1);
  });

  it('folds a separately surfaced rabies dose back into the list', () => {
    const rows = buildSignedRecordRows({ ...passport, vaccinations: [] });
    expect(rows[0]).toEqual(expect.objectContaining({ id: 'vac-rabies', kind: 'VACCINATION' }));
  });
});
