import {act, renderHook, waitFor} from '@testing-library/react-native';

import {useBreedOptions} from '@/features/companion/hooks/useBreedOptions';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {fetchBreedCodeEntries} from '@/features/companion/services/codeEntriesService';

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));

jest.mock('@/features/companion/services/codeEntriesService', () => ({
  fetchBreedCodeEntries: jest.fn(),
}));

const mockTokens = getFreshStoredTokens as jest.Mock;
const mockFetch = fetchBreedCodeEntries as jest.Mock;

const params = {
  category: 'dog' as any,
  speciesQueryFor: () => 'DOG',
  speciesLabelFor: () => 'Dog',
  speciesCodeFor: () => 'SP-DOG',
};

describe('useBreedOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockTokens.mockResolvedValue({accessToken: 'token'});
    mockFetch.mockResolvedValue([
      {code: 'B1', display: 'Pug', meta: {speciesCode: 'SP-1'}},
    ]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps entries into breeds on a successful lookup', async () => {
    const {result} = renderHook(() => useBreedOptions(params));

    await waitFor(() => expect(result.current.breedLoading).toBe(false));

    expect(result.current.breedOptions).toEqual([
      {
        speciesId: 1,
        speciesName: 'Dog',
        breedId: 1,
        breedName: 'Pug',
        speciesCode: 'SP-1',
        breedCode: 'B1',
      },
    ]);
    expect(result.current.breedLoadFailed).toBe(false);
  });

  it('falls back to the supplied species code when an entry has none', async () => {
    mockFetch.mockResolvedValue([{code: 'B2', display: 'Beagle'}]);
    const {result} = renderHook(() => useBreedOptions(params));

    await waitFor(() => expect(result.current.breedLoading).toBe(false));

    expect(result.current.breedOptions[0].speciesCode).toBe('SP-DOG');
  });

  // The root cause behind the "no network request at all" report: the token
  // read early-returns, so the breed request is never sent. It still has to
  // surface as a retryable failure rather than an empty list.
  it('reports a failure without sending any request when there is no token', async () => {
    mockTokens.mockResolvedValue(null);
    const {result} = renderHook(() => useBreedOptions(params));

    await waitFor(() => expect(result.current.breedLoadFailed).toBe(true));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.breedOptions).toEqual([]);
  });

  it('reports a failure when the lookup throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const {result} = renderHook(() => useBreedOptions(params));

    await waitFor(() => expect(result.current.breedLoadFailed).toBe(true));
    expect(result.current.breedOptions).toEqual([]);
  });

  it('does not report failure for a species with genuinely no breeds', async () => {
    mockFetch.mockResolvedValue([]);
    const {result} = renderHook(() => useBreedOptions(params));

    await waitFor(() => expect(result.current.breedLoading).toBe(false));

    expect(result.current.breedOptions).toEqual([]);
    expect(result.current.breedLoadFailed).toBe(false);
  });

  describe('retry', () => {
    it('re-runs the lookup and clears the failure when it succeeds', async () => {
      mockTokens.mockResolvedValueOnce(null);
      const {result} = renderHook(() => useBreedOptions(params));

      await waitFor(() => expect(result.current.breedLoadFailed).toBe(true));
      expect(mockFetch).not.toHaveBeenCalled();

      await act(async () => {
        result.current.retryBreeds();
      });

      await waitFor(() => expect(result.current.breedLoadFailed).toBe(false));
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.breedOptions).toHaveLength(1);
    });

    it('keeps the failure when the retry fails again', async () => {
      mockTokens.mockResolvedValue(null);
      const {result} = renderHook(() => useBreedOptions(params));

      await waitFor(() => expect(result.current.breedLoadFailed).toBe(true));

      await act(async () => {
        result.current.retryBreeds();
      });

      await waitFor(() => expect(result.current.breedLoadFailed).toBe(true));
    });

    it('does nothing without a category', async () => {
      const {result} = renderHook(() =>
        useBreedOptions({...params, category: null}),
      );

      await act(async () => {
        result.current.retryBreeds();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('category changes', () => {
    it('clears state when the category is cleared', async () => {
      const {result, rerender} = renderHook((p: any) => useBreedOptions(p), {
        initialProps: params,
      });

      await waitFor(() => expect(result.current.breedOptions).toHaveLength(1));

      rerender({...params, category: null});

      await waitFor(() => expect(result.current.breedOptions).toEqual([]));
      expect(result.current.breedLoadFailed).toBe(false);
      expect(result.current.breedLoading).toBe(false);
    });

    // A slow response for a category the user has moved away from must not
    // land on the new one.
    it('discards a response from a superseded category', async () => {
      let releaseFirst: (v: any) => void = () => {};
      mockFetch.mockImplementationOnce(
        () => new Promise(resolve => (releaseFirst = resolve)),
      );

      const {result, rerender} = renderHook((p: any) => useBreedOptions(p), {
        initialProps: params,
      });

      mockFetch.mockResolvedValue([{code: 'C1', display: 'Siamese'}]);
      rerender({
        ...params,
        category: 'cat' as any,
        speciesLabelFor: () => 'Cat',
      });

      await waitFor(() =>
        expect(result.current.breedOptions[0]?.breedName).toBe('Siamese'),
      );

      await act(async () => {
        releaseFirst([{code: 'B1', display: 'Pug'}]);
        // Let the resolved promise's continuation AND any state update it
        // schedules actually run, otherwise this asserts before the stale
        // response has had a chance to land and passes for the wrong reason.
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.breedOptions.map(b => b.breedName)).toEqual([
        'Siamese',
      ]);
    });
  });
});
