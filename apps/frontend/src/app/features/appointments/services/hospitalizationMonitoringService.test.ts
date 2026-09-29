import { getData, postData } from '@/app/services/axios';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from './hospitalizationMonitoringService';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

const observation: HospitalizationObservation = {
  id: 'obs-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  observedAt: '2026-09-27T10:00:00.000Z',
  temperature: 38.2,
  temperatureUnit: 'C',
  heartRate: 90,
  respiratoryRate: 20,
  painScore: 2,
  inputMl: 12,
  outputMl: 8,
  notes: null,
  createdAt: '2026-09-27T10:01:00.000Z',
};

describe('hospitalizationMonitoringService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists observations for the selected patient and encounter', async () => {
    jest.mocked(getData).mockResolvedValue({ data: [observation] } as never);

    await expect(
      listHospitalizationObservations('org-1', 'patient-1', 'encounter-1')
    ).resolves.toEqual([observation]);
    expect(getData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/hospitalization-monitoring', {
      patientId: 'patient-1',
      encounterId: 'encounter-1',
    });
  });

  it('records an observation without sending the organisation id in the body', async () => {
    jest.mocked(postData).mockResolvedValue({ data: observation } as never);
    const input = {
      organisationId: 'org-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      observedAt: observation.observedAt,
      inputMl: 12,
      outputMl: 8,
    };

    await expect(recordHospitalizationObservation(input)).resolves.toEqual(observation);
    expect(postData).toHaveBeenCalledWith('/v1/pms/organisation/org-1/hospitalization-monitoring', {
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      observedAt: observation.observedAt,
      inputMl: 12,
      outputMl: 8,
    });
  });
});
