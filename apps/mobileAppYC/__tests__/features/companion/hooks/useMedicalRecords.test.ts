import {act, renderHook, waitFor} from '@testing-library/react-native';

import {useMedicalRecords} from '@/features/companion/hooks/useMedicalRecords';
import {medicalRecordApi} from '@/features/companion/services/medicalRecordService';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
jest.mock('@/features/companion/services/medicalRecordService', () => ({
  medicalRecordApi: {fetchAllergies: jest.fn(), fetchProblems: jest.fn()},
}));

const mockTokens = getFreshStoredTokens as jest.Mock;
const mockFetchAllergies = medicalRecordApi.fetchAllergies as jest.Mock;
const mockFetchProblems = medicalRecordApi.fetchProblems as jest.Mock;

const allergy = (allergen: string) => ({
  id: allergen,
  allergen,
  allergyType: 'FOOD',
  severity: 'MILD',
  status: 'ACTIVE',
});

const deferred = () => {
  let resolve!: (value: unknown[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

// The way axios rejects a 403: an Error whose message is transport detail.
const forbidden = () =>
  Object.assign(new Error('Request failed with status code 403'), {
    isAxiosError: true,
    response: {status: 403},
  });

const renderForCompanion = (companionId: string) =>
  renderHook(({id}: {id: string}) => useMedicalRecords(id), {
    initialProps: {id: companionId},
  });

describe('useMedicalRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockFetchAllergies.mockResolvedValue([]);
    mockFetchProblems.mockResolvedValue([]);
  });

  it('loads the companion allergies and problems with the owner token', async () => {
    const problem = {id: 'p1', name: 'Arthritis', status: 'ACTIVE'};
    mockFetchAllergies.mockResolvedValue([allergy('Chicken')]);
    mockFetchProblems.mockResolvedValue([problem]);

    const {result} = renderForCompanion('pet-1');

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allergies).toEqual([allergy('Chicken')]);
    expect(result.current.problems).toEqual([problem]);
    expect(result.current.error).toBeNull();
    expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token');
    expect(mockFetchProblems).toHaveBeenCalledWith('pet-1', 'token');
  });

  it('asks for sign-in without calling the API when there is no session', async () => {
    mockTokens.mockResolvedValue(null);

    const {result} = renderForCompanion('pet-1');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('signIn');
    expect(mockFetchAllergies).not.toHaveBeenCalled();
    expect(mockFetchProblems).not.toHaveBeenCalled();
  });

  it('reports a transport failure as loadFailed and retry refetches', async () => {
    mockFetchAllergies
      .mockRejectedValueOnce(forbidden())
      .mockResolvedValueOnce([allergy('Beef')]);

    const {result} = renderForCompanion('pet-1');
    await waitFor(() => expect(result.current.error).toBe('loadFailed'));
    expect(result.current.loading).toBe(false);

    act(() => result.current.retry());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.allergies).toEqual([allergy('Beef')]);
    expect(mockFetchAllergies).toHaveBeenCalledTimes(2);
  });

  it('never applies a slow response for the previous companion', async () => {
    const pet1 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? pet1.promise : Promise.resolve([allergy('Beef')]),
    );
    const {result, rerender} = renderForCompanion('pet-1');
    await waitFor(() =>
      expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token'),
    );

    rerender({id: 'pet-2'});
    await waitFor(() =>
      expect(result.current.allergies).toEqual([allergy('Beef')]),
    );
    await act(async () => pet1.resolve([allergy('Chicken')]));

    expect(result.current.allergies).toEqual([allergy('Beef')]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('never applies a late failure for the previous companion', async () => {
    const pet1 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? pet1.promise : Promise.resolve([allergy('Beef')]),
    );
    const {result, rerender} = renderForCompanion('pet-1');
    await waitFor(() =>
      expect(mockFetchAllergies).toHaveBeenCalledWith('pet-1', 'token'),
    );

    rerender({id: 'pet-2'});
    await waitFor(() =>
      expect(result.current.allergies).toEqual([allergy('Beef')]),
    );
    await act(async () => pet1.reject(forbidden()));

    expect(result.current.error).toBeNull();
    expect(result.current.allergies).toEqual([allergy('Beef')]);
    expect(result.current.loading).toBe(false);
  });

  it('is loading for the next companion until its own response lands', async () => {
    const pet2 = deferred();
    mockFetchAllergies.mockImplementation((id: string) =>
      id === 'pet-1' ? Promise.resolve([allergy('Chicken')]) : pet2.promise,
    );
    const {result, rerender} = renderForCompanion('pet-1');
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({id: 'pet-2'});

    expect(result.current.loading).toBe(true);
    await act(async () => pet2.resolve([allergy('Beef')]));
    expect(result.current.loading).toBe(false);
    expect(result.current.allergies).toEqual([allergy('Beef')]);
  });
});
