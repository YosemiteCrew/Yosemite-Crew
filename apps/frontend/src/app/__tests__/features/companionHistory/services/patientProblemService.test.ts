import {
  createPatientProblem,
  fetchPatientProblems,
  resolvePatientProblem,
  updatePatientProblem,
} from '@/app/features/companionHistory/services/patientProblemService';
import { getData, postData, putData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
}));

let mockOrgId: string | null = 'org-1';
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => ({ primaryOrgId: mockOrgId }) },
}));

const getMock = getData as jest.Mock;
const postMock = postData as jest.Mock;
const putMock = putData as jest.Mock;

const BASE = '/v1/pms/organisation/org-1/patient-problems';

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId = 'org-1';
});

describe('patientProblemService', () => {
  it('fetches problems scoped to the org and patient', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'p-1' }] });
    const result = await fetchPatientProblems({ patientId: 'pat-1' });
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'pat-1' });
    expect(result).toEqual([{ id: 'p-1' }]);
  });

  it('passes the status filter when supplied', async () => {
    getMock.mockResolvedValue({ data: [] });
    await fetchPatientProblems({ patientId: 'pat-1', status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith(BASE, { patientId: 'pat-1', status: 'ACTIVE' });
  });

  it('throws when the patient id is missing', async () => {
    await expect(fetchPatientProblems({ patientId: '' })).rejects.toThrow('Patient ID missing');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('creates a problem', async () => {
    postMock.mockResolvedValue({ data: { id: 'p-new' } });
    const input = { patientId: 'pat-1', name: 'Otitis', severity: 'MILD' as const };
    const result = await createPatientProblem(input);
    expect(postMock).toHaveBeenCalledWith(BASE, input);
    expect(result).toEqual({ id: 'p-new' });
  });

  it('updates a problem by id', async () => {
    putMock.mockResolvedValue({ data: { id: 'p-1', status: 'INACTIVE' } });
    const result = await updatePatientProblem('p-1', { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith(`${BASE}/p-1`, { status: 'INACTIVE' });
    expect(result).toEqual({ id: 'p-1', status: 'INACTIVE' });
  });

  it('resolves a problem, defaulting the body to an empty object', async () => {
    postMock.mockResolvedValue({ data: { id: 'p-1', status: 'RESOLVED' } });
    await resolvePatientProblem('p-1');
    expect(postMock).toHaveBeenCalledWith(`${BASE}/p-1/resolve`, {});
  });

  it('resolves a problem with an explicit resolved date', async () => {
    postMock.mockResolvedValue({ data: { id: 'p-1', status: 'RESOLVED' } });
    await resolvePatientProblem('p-1', '2026-02-02T00:00:00.000Z');
    expect(postMock).toHaveBeenCalledWith(`${BASE}/p-1/resolve`, {
      resolvedDate: '2026-02-02T00:00:00.000Z',
    });
  });

  it('throws when no organisation is selected', async () => {
    mockOrgId = null;
    await expect(fetchPatientProblems({ patientId: 'pat-1' })).rejects.toThrow(
      'No active organisation selected.'
    );
  });
});
