import {Alert} from 'react-native';
import {act, renderHook, waitFor} from '@testing-library/react-native';

import {usePrescriptions} from '@/features/companion/hooks/usePrescriptions';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {prescriptionApi} from '@/features/companion/services/prescriptionService';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {useTranslation: () => ({t})};
});
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
jest.mock('@/features/companion/services/prescriptionService', () => ({
  prescriptionApi: {list: jest.fn(), requestRefill: jest.fn()},
}));

const mockTokens = getFreshStoredTokens as jest.Mock;
const mockList = prescriptionApi.list as jest.Mock;
const mockRequest = prescriptionApi.requestRefill as jest.Mock;

const row = (id: string, patientId: string) => ({
  id,
  patientId,
  encounterId: 'enc-1',
  organisationId: 'org-1',
  status: 'SIGNED',
  createdAt: '2026-01-15T12:00:00Z',
  items: [],
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
};

// The first render in a worker is cold; see PrescriptionsScreen.test.tsx.
const WAIT = {timeout: 5000};

const renderLoaded = async (companionId = 'pet-1') => {
  const hook = renderHook(() => usePrescriptions(companionId));
  await waitFor(() => expect(hook.result.current.loading).toBe(false), WAIT);
  return hook;
};

describe('usePrescriptions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockList.mockResolvedValue([row('rx-1', 'pet-1'), row('rx-2', 'pet-2')]);
    mockRequest.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts loading and keeps only the selected companion rows', async () => {
    const {result} = renderHook(() => usePrescriptions('pet-1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), WAIT);

    expect(mockList).toHaveBeenCalledWith('token');
    expect(result.current.prescriptions.map(p => p.id)).toEqual(['rx-1']);
    expect(result.current.error).toBeNull();
    expect(result.current.requestingId).toBeNull();
  });

  it('reports signIn without calling the list when there is no session', async () => {
    mockTokens.mockResolvedValue({accessToken: ''});
    const {result} = await renderLoaded();

    expect(result.current.error).toBe('signIn');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('reports loadFailed when the list throws', async () => {
    mockList.mockRejectedValue(
      new Error('Prescription pagination did not advance'),
    );
    const {result} = await renderLoaded();

    expect(result.current.error).toBe('loadFailed');
    expect(result.current.prescriptions).toEqual([]);
  });

  it('reports loadFailed when the token lookup itself throws', async () => {
    mockTokens.mockRejectedValue(new Error('refresh failed'));
    const {result} = await renderLoaded();

    expect(result.current.error).toBe('loadFailed');
  });

  it('clears the error and reloads on reload()', async () => {
    mockList.mockRejectedValueOnce(new Error('Network Error'));
    const {result} = await renderLoaded();
    expect(result.current.error).toBe('loadFailed');

    await act(() => result.current.reload());

    expect(result.current.error).toBeNull();
    expect(result.current.prescriptions.map(p => p.id)).toEqual(['rx-1']);
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('marks the refill busy before the token lookup and clears it after', async () => {
    const {result} = await renderLoaded();
    const tokens = deferred<{accessToken: string}>();
    mockTokens.mockReturnValue(tokens.promise);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.requestRefill('rx-1');
    });

    expect(result.current.requestingId).toBe('rx-1');
    expect(mockRequest).not.toHaveBeenCalled();

    await act(async () => {
      tokens.resolve({accessToken: 'token'});
      await pending;
    });

    expect(mockRequest).toHaveBeenCalledWith('rx-1', 'token');
    expect(Alert.alert).toHaveBeenCalledWith(
      'prescriptions.refillRequestedTitle',
      'prescriptions.refillRequestedBody',
    );
    expect(result.current.requestingId).toBeNull();
  });

  it('alerts a failure and clears busy when the refill request fails', async () => {
    mockRequest.mockRejectedValue(new Error('Network Error'));
    const {result} = await renderLoaded();

    await act(() => result.current.requestRefill('rx-1'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'prescriptions.refillFailedTitle',
      'prescriptions.refillFailedBody',
    );
    expect(result.current.requestingId).toBeNull();
  });

  it('asks to sign in again and sends nothing when the refill has no session', async () => {
    const {result} = await renderLoaded();
    mockTokens.mockResolvedValue(null);

    await act(() => result.current.requestRefill('rx-1'));

    expect(mockRequest).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'prescriptions.refillFailedTitle',
      'prescriptions.signInAgain',
    );
    expect(result.current.requestingId).toBeNull();
  });
});
