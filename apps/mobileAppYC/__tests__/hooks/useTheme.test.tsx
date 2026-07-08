import {renderHook, act} from '@testing-library/react-native';
import {Appearance} from 'react-native';
import {createThemeHook, useTheme} from '../../src/shared/hooks/useTheme';
import {
  setTheme,
  toggleTheme,
  updateSystemTheme,
} from '../../src/features/theme';
import * as hooks from '../../src/app/hooks';
import {darkTheme, lightTheme} from '../../src/theme';

// --- Mocks ---

jest.mock('../../src/app/hooks', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

jest.mock('../../src/features/theme', () => ({
  setTheme: jest.fn(mode => ({type: 'theme/setTheme', payload: mode})),
  toggleTheme: jest.fn(() => ({type: 'theme/toggleTheme'})),
  updateSystemTheme: jest.fn(scheme => ({
    type: 'theme/updateSystemTheme',
    payload: scheme,
  })),
}));

jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({remove: jest.fn()})),
}));

describe('useTheme Hook', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (hooks.useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'light',
      isDark: false,
    });
  });

  it('returns the light theme when isDark is false and is not locked', () => {
    const {result} = renderHook(() => useTheme());

    expect(result.current.theme).toBe(lightTheme);
    expect(result.current.isDark).toBe(false);
    expect(result.current.themeMode).toBe('light');
    expect(result.current.darkModeLocked).toBe(false);
  });

  it('returns the espresso dark theme when isDark is true', () => {
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'dark',
      isDark: true,
    });

    const {result} = renderHook(() => useTheme());

    expect(result.current.theme).toBe(darkTheme);
    expect(result.current.isDark).toBe(true);
    expect(result.current.themeMode).toBe('dark');
  });

  it('syncs the system appearance on mount', () => {
    renderHook(() => useTheme());

    expect(mockDispatch).toHaveBeenCalledWith(updateSystemTheme('light'));
  });

  it('setTheme dispatches the requested mode', () => {
    const {result} = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(mockDispatch).toHaveBeenCalledWith(setTheme('dark'));
  });

  it('safeSetTheme ensures light mode if currently not light (redundancy check)', () => {
    // Simulate improper state again
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'system', // Not 'light'
      isDark: false,
    });

    const {result} = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    // Should correct it to light
    expect(mockDispatch).toHaveBeenCalledWith(setTheme('light'));
  });

  it('safeToggleTheme does nothing when locked', () => {
    const {result} = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
      result.current.toggleTheme();
    });

    expect(mockDispatch).not.toHaveBeenCalledWith(toggleTheme());
  });

  it('syncs system theme and exposes dark-mode controls when enabled', () => {
    const remove = jest.fn();
    let appearanceListener:
      | ((event: {colorScheme: 'light' | 'dark' | null}) => void)
      | undefined;

    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
    (Appearance.addChangeListener as jest.Mock).mockImplementation(listener => {
      appearanceListener = listener;
      return {remove};
    });
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'system',
      isDark: true,
    });

    const useEnabledTheme = createThemeHook(true);
    const {result, unmount} = renderHook(() => useEnabledTheme());

    expect(result.current.theme).toBe(darkTheme);
    expect(result.current.isDark).toBe(true);
    expect(result.current.themeMode).toBe('system');
    expect(result.current.darkModeLocked).toBe(false);
    expect(mockDispatch).toHaveBeenCalledWith(updateSystemTheme('dark'));

    act(() => {
      appearanceListener?.({colorScheme: null});
    });
    expect(mockDispatch).toHaveBeenCalledWith(updateSystemTheme('light'));

    act(() => {
      result.current.setTheme('dark');
      result.current.toggleTheme();
    });

    expect(mockDispatch).toHaveBeenCalledWith(setTheme('dark'));
    expect(mockDispatch).toHaveBeenCalledWith(toggleTheme());

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
