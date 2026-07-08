import {renderHook, act} from '@testing-library/react-native';
import {Appearance} from 'react-native';
import {useTheme} from '../../src/shared/hooks/useTheme';
import {
  setTheme,
  toggleTheme,
  updateSystemTheme,
} from '../../src/features/theme';
import * as hooks from '../../src/app/hooks';
import {lightTheme, darkTheme} from '../../src/theme';

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

  it('toggleTheme dispatches the toggle action', () => {
    const {result} = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(mockDispatch).toHaveBeenCalledWith(toggleTheme());
  });

  it('unsubscribes from appearance changes on unmount', () => {
    const remove = jest.fn();
    (Appearance.addChangeListener as jest.Mock).mockReturnValue({remove});

    const {unmount} = renderHook(() => useTheme());
    unmount();

    expect(remove).toHaveBeenCalled();
  });

  it('does not crash on unmount when addChangeListener returns void', () => {
    (Appearance.addChangeListener as jest.Mock).mockReturnValue(undefined);

    const {unmount} = renderHook(() => useTheme());

    expect(() => unmount()).not.toThrow();
  });

  it('does not crash on unmount when the subscription lacks remove', () => {
    (Appearance.addChangeListener as jest.Mock).mockReturnValue({});

    const {unmount} = renderHook(() => useTheme());

    expect(() => unmount()).not.toThrow();
  });

  it('syncs a dark system appearance and reacts to appearance changes', () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
    let captured: ((p: {colorScheme: string | null}) => void) | undefined;
    (Appearance.addChangeListener as jest.Mock).mockImplementation(cb => {
      captured = cb;
      return {remove: jest.fn()};
    });

    renderHook(() => useTheme());

    expect(mockDispatch).toHaveBeenCalledWith(updateSystemTheme('dark'));

    act(() => {
      captured?.({colorScheme: 'light'});
    });

    expect(mockDispatch).toHaveBeenCalledWith(updateSystemTheme('light'));
  });
});
