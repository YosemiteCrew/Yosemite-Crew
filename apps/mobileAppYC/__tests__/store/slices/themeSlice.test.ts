import {
  themeReducer,
  setTheme,
  toggleTheme,
  updateSystemTheme,
  type ThemeState,
} from '@/features/theme';

// Mock Appearance before importing
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(),
}));

// Import Appearance after mocking
const {Appearance} = require('react-native');

describe('themeSlice', () => {
  beforeEach(() => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return the initial state', () => {
      const state = themeReducer(undefined, {type: 'unknown'});
      expect(state.theme).toBe('system');
      expect(typeof state.isDark).toBe('boolean');
    });
  });

  describe('setTheme reducer', () => {
    const initialState: ThemeState = {
      isDark: false,
      theme: 'system',
    };

    it('should set theme to light', () => {
      const state = themeReducer(initialState, setTheme('light'));
      expect(state.theme).toBe('light');
      expect(state.isDark).toBe(false);
    });

    it('should set theme to dark', () => {
      const state = themeReducer(initialState, setTheme('dark'));
      expect(state.theme).toBe('dark');
      expect(state.isDark).toBe(true);
    });

    it('should set theme to system with light appearance', () => {
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
      const state = themeReducer(initialState, setTheme('system'));
      expect(state.theme).toBe('system');
      expect(state.isDark).toBe(false);
    });

    it('should set theme to system with dark appearance', () => {
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
      const state = themeReducer(initialState, setTheme('system'));
      expect(state.theme).toBe('system');
      expect(state.isDark).toBe(true);
    });

    it('should override previous manual theme with system theme', () => {
      const darkState: ThemeState = {
        isDark: true,
        theme: 'dark',
      };
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
      const state = themeReducer(darkState, setTheme('system'));
      expect(state.theme).toBe('system');
      expect(state.isDark).toBe(false);
    });
  });

  describe('toggleTheme reducer', () => {
    it('should toggle from system light to dark', () => {
      const initialState: ThemeState = {
        isDark: false,
        theme: 'system',
      };
      const state = themeReducer(initialState, toggleTheme());
      expect(state.theme).toBe('dark');
      expect(state.isDark).toBe(true);
    });

    it('should toggle from system dark to light', () => {
      const initialState: ThemeState = {
        isDark: true,
        theme: 'system',
      };
      const state = themeReducer(initialState, toggleTheme());
      expect(state.theme).toBe('light');
      expect(state.isDark).toBe(false);
    });

    it('should toggle from light to dark', () => {
      const initialState: ThemeState = {
        isDark: false,
        theme: 'light',
      };
      const state = themeReducer(initialState, toggleTheme());
      expect(state.theme).toBe('dark');
      expect(state.isDark).toBe(true);
    });

    it('should toggle from dark to light', () => {
      const initialState: ThemeState = {
        isDark: true,
        theme: 'dark',
      };
      const state = themeReducer(initialState, toggleTheme());
      expect(state.theme).toBe('light');
      expect(state.isDark).toBe(false);
    });

    it('should toggle multiple times', () => {
      let state: ThemeState = {
        isDark: false,
        theme: 'light',
      };

      state = themeReducer(state, toggleTheme());
      expect(state.isDark).toBe(true);

      state = themeReducer(state, toggleTheme());
      expect(state.isDark).toBe(false);

      state = themeReducer(state, toggleTheme());
      expect(state.isDark).toBe(true);
    });
  });

  describe('updateSystemTheme reducer', () => {
    it('should update to dark when theme is system', () => {
      const initialState: ThemeState = {
        isDark: false,
        theme: 'system',
      };
      const state = themeReducer(initialState, updateSystemTheme('dark'));
      expect(state.isDark).toBe(true);
      expect(state.theme).toBe('system');
    });

    it('should update to light when theme is system', () => {
      const initialState: ThemeState = {
        isDark: true,
        theme: 'system',
      };
      const state = themeReducer(initialState, updateSystemTheme('light'));
      expect(state.isDark).toBe(false);
      expect(state.theme).toBe('system');
    });

    it('should not update when theme is light (not system)', () => {
      const initialState: ThemeState = {
        isDark: false,
        theme: 'light',
      };
      const state = themeReducer(initialState, updateSystemTheme('dark'));
      expect(state.isDark).toBe(false);
      expect(state.theme).toBe('light');
    });

    it('should not update when theme is dark (not system)', () => {
      const initialState: ThemeState = {
        isDark: true,
        theme: 'dark',
      };
      const state = themeReducer(initialState, updateSystemTheme('light'));
      expect(state.isDark).toBe(true);
      expect(state.theme).toBe('dark');
    });
  });

  describe('combined scenarios', () => {
    it('should handle system theme changes correctly', () => {
      // Start with system theme (light)
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
      let state: ThemeState = {
        isDark: false,
        theme: 'system',
      };

      // System changes to dark
      state = themeReducer(state, updateSystemTheme('dark'));
      expect(state.isDark).toBe(true);
      expect(state.theme).toBe('system');

      // User manually switches to light
      state = themeReducer(state, setTheme('light'));
      expect(state.isDark).toBe(false);
      expect(state.theme).toBe('light');

      // System theme change should not affect manual setting
      state = themeReducer(state, updateSystemTheme('dark'));
      expect(state.isDark).toBe(false);
      expect(state.theme).toBe('light');
    });

    it('should handle theme preference workflow', () => {
      // User starts with system theme
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
      let state: ThemeState = {
        isDark: false,
        theme: 'system',
      };

      // User toggles to dark
      state = themeReducer(state, toggleTheme());
      expect(state.theme).toBe('dark');
      expect(state.isDark).toBe(true);

      // User toggles back to light
      state = themeReducer(state, toggleTheme());
      expect(state.theme).toBe('light');
      expect(state.isDark).toBe(false);

      // User sets back to system
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
      state = themeReducer(state, setTheme('system'));
      expect(state.theme).toBe('system');
      expect(state.isDark).toBe(true);
    });

    it('should handle rapid theme changes', () => {
      let state: ThemeState = {
        isDark: false,
        theme: 'system',
      };

      state = themeReducer(state, setTheme('dark'));
      expect(state.isDark).toBe(true);

      state = themeReducer(state, setTheme('light'));
      expect(state.isDark).toBe(false);

      state = themeReducer(state, toggleTheme());
      expect(state.isDark).toBe(true);

      (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
      state = themeReducer(state, setTheme('system'));
      expect(state.isDark).toBe(false);
    });
  });
});
