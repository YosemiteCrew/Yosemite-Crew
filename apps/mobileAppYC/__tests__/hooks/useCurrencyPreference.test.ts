import {renderHook, act} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCurrencyPreference} from '../../src/shared/hooks/useCurrencyPreference';

// --- Mocks ---
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('useCurrencyPreference Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Initialization Logic (useEffect)
  // ===========================================================================

  it('loads "USD" by default if storage is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const {result} = renderHook(() => useCurrencyPreference());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for effect to finish
    await act(async () => {});

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('app_currency_preference');
    expect(result.current.currency).toBe('USD');
    expect(result.current.isLoading).toBe(false);
  });

  it('loads stored currency ("EUR") if valid', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('EUR');

    const {result} = renderHook(() => useCurrencyPreference());

    await act(async () => {});

    expect(result.current.currency).toBe('EUR');
  });

  it('ignores stored value if invalid/unsupported and keeps default ("USD")', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('GBP'); // Unsupported

    const {result} = renderHook(() => useCurrencyPreference());

    await act(async () => {});

    expect(result.current.currency).toBe('USD');
  });

  it('handles storage read errors gracefully (logs warning but keeps default)', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read Error'));

    const {result} = renderHook(() => useCurrencyPreference());

    await act(async () => {});

    expect(result.current.currency).toBe('USD'); // Default
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load currency preference:',
      expect.any(Error),
    );
    expect(result.current.isLoading).toBe(false); // Should still finish loading

    consoleSpy.mockRestore();
  });

  // ===========================================================================
  // 2. State Updates & Persistence (setCurrency)
  // ===========================================================================

  it('persists valid currency change ("EUR") to storage and updates state', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const {result} = renderHook(() => useCurrencyPreference());
    await act(async () => {}); // Wait for load

    await act(async () => {
      await result.current.setCurrency('EUR');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_currency_preference', 'EUR');
    expect(result.current.currency).toBe('EUR');
  });

  it('ignores and warns when setting unsupported currency', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const {result} = renderHook(() => useCurrencyPreference());
    await act(async () => {});

    await act(async () => {
      // @ts-ignore testing invalid input
      await result.current.setCurrency('JPY');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported currency: JPY')
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(result.current.currency).toBe('USD'); // Unchanged

    consoleSpy.mockRestore();
  });

  it('handles storage write errors gracefully when setting currency', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write Error'));

    const {result} = renderHook(() => useCurrencyPreference());
    await act(async () => {});

    await act(async () => {
      await result.current.setCurrency('EUR');
    });

    // It attempts to set item
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_currency_preference', 'EUR');

    // Logs warning
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to save currency preference:',
      expect.any(Error),
    );

    // Note: The current implementation updates state ONLY if setItem succeeds?
    // Checking code: try { await setItem; setCurrency; } catch...
    // Since setItem throws, setCurrency is skipped in the try block.
    // So the local state should NOT update.
    expect(result.current.currency).toBe('USD');

    consoleSpy.mockRestore();
  });

  // ===========================================================================
  // 3. Constants Check
  // ===========================================================================

  it('exposes supported currencies list', () => {
    const {result} = renderHook(() => useCurrencyPreference());
    expect(result.current.supportedCurrencies).toEqual(['EUR', 'USD']);
  });
});