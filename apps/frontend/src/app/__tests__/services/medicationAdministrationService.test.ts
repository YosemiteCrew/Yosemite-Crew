import {
  administerMedication,
  createMedicationAdministration,
  holdMedication,
  listMedicationAdministrations,
  MEDICATION_OUTCOME_ACTIONS,
  missMedication,
  refuseMedication,
} from '@/app/features/appointments/services/medicationAdministrationService';
import { getData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const getDataMock = getData as jest.Mock;
const postDataMock = postData as jest.Mock;

const entry = {
  id: 'mar-1',
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  prescriptionId: 'prescription-1',
  medicationName: 'Meloxicam',
  dose: '0.4 ml',
  route: 'Oral',
  scheduledAt: '2026-09-27T10:00:00.000Z',
  administeredAt: null,
  administeredBy: null,
  status: 'SCHEDULED',
  notes: null,
  createdAt: '2026-09-27T09:00:00.000Z',
  updatedAt: '2026-09-27T09:00:00.000Z',
};

const OUTCOME_FUNCTIONS = {
  administer: administerMedication,
  hold: holdMedication,
  miss: missMedication,
  refuse: refuseMedication,
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('medicationAdministrationService', () => {
  it('lists records for one patient and encounter in the organisation', async () => {
    getDataMock.mockResolvedValue({ data: [entry] });

    await expect(
      listMedicationAdministrations('org-1', 'patient-1', 'encounter-1')
    ).resolves.toEqual([entry]);
    expect(getDataMock).toHaveBeenCalledWith('/v1/pms/organisation/org-1/mar-entries', {
      patientId: 'patient-1',
      encounterId: 'encounter-1',
    });
  });

  it('creates a scheduled dose and returns the saved entry', async () => {
    postDataMock.mockResolvedValue({ data: entry });

    await expect(
      createMedicationAdministration({
        organisationId: 'org-1',
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        prescriptionId: 'prescription-1',
        medicationName: 'Meloxicam',
        dose: '0.4 ml',
        route: 'Oral',
        scheduledAt: entry.scheduledAt,
      })
    ).resolves.toEqual(entry);
    expect(postDataMock).toHaveBeenCalledWith('/v1/pms/organisation/org-1/mar-entries', {
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      prescriptionId: 'prescription-1',
      medicationName: 'Meloxicam',
      dose: '0.4 ml',
      route: 'Oral',
      scheduledAt: entry.scheduledAt,
    });
  });

  it.each(MEDICATION_OUTCOME_ACTIONS)(
    'posts a single %s request for one scheduled dose and returns the saved entry',
    async (outcome) => {
      postDataMock.mockResolvedValue({ data: entry });

      await expect(OUTCOME_FUNCTIONS[outcome]('org-1', 'mar-1')).resolves.toEqual(entry);
      expect(postDataMock).toHaveBeenCalledTimes(1);
      expect(postDataMock).toHaveBeenCalledWith(
        `/v1/pms/organisation/org-1/mar-entries/mar-1/${outcome}`,
        {}
      );
    }
  );

  it('exports a request function for every outcome the API accepts', () => {
    expect(Object.keys(OUTCOME_FUNCTIONS).toSorted()).toEqual(
      [...MEDICATION_OUTCOME_ACTIONS].toSorted()
    );
  });
});
