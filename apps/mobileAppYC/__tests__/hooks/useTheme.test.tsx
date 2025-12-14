import {renderHook, act} from '@testing-library/react-native';
import {useTheme} from '../../src/shared/hooks/useTheme';
import {setTheme, toggleTheme} from '../../src/features/theme';
import * as hooks from '../../src/app/hooks';
import {lightTheme} from '../../src/theme';

// --- Mocks ---

// Mock Redux hooks
jest.mock('../../src/app/hooks', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

// Mock Actions
jest.mock('../../src/features/theme', () => ({
  setTheme: jest.fn(),
  toggleTheme: jest.fn(),
  updateSystemTheme: jest.fn(),
}));

// Mock Appearance
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(),
  addChangeListener: jest.fn(() => ({remove: jest.fn()})),
}));

describe('useTheme Hook', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (hooks.useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
    // Default Selector state: Light mode
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'light',
      isDark: false,
    });
  });

  // ===========================================================================
  // 1. Initialization & Locked State
  // ===========================================================================

  it('initializes with light theme and isDark=false (locked mode)', () => {
    const {result} = renderHook(() => useTheme());

    expect(result.current.theme).toBe(lightTheme);
    expect(result.current.isDark).toBe(false);
    expect(result.current.themeMode).toBe('light');
    expect(result.current.darkModeLocked).toBe(true);
  });

  it('forces light mode dispatch if stored state is inadvertently dark (correction logic)', () => {
    // Simulate stored state being 'dark'
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'dark',
      isDark: true,
    });

    renderHook(() => useTheme());

    // Because DARK_MODE_ENABLED is false, it should immediately dispatch 'light'
    expect(mockDispatch).toHaveBeenCalledWith(setTheme('light'));
  });

  it('does NOT dispatch correction if stored state is already light', () => {
    (hooks.useAppSelector as jest.Mock).mockReturnValue({
      theme: 'light',
      isDark: false,
    });

    renderHook(() => useTheme());

    expect(mockDispatch).not.toHaveBeenCalledWith(setTheme('light'));
  });

  // ===========================================================================
  // 2. Helper Functions (Safeguards)
  // ===========================================================================

  it('safeSetTheme ignores requests to change theme when locked', () => {
    const {result} = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    // Should NOT call the actual redux action for dark
    expect(mockDispatch).not.toHaveBeenCalledWith(setTheme('dark'));
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
      result.current.toggleTheme();
    });

    expect(mockDispatch).not.toHaveBeenCalledWith(toggleTheme());
  });
});
