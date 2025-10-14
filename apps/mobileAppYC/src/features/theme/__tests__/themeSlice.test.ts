import {
  themeReducer,
  setTheme,
  toggleTheme,
  updateSystemTheme,
  type ThemeState,
} from '@/features/theme';

const reducer = themeReducer;

describe('features/theme/themeSlice', () => {
  const baseState: ThemeState = {isDark: false, theme: 'light'};

  test('setTheme to dark', () => {
    const state = reducer(baseState, setTheme('dark'));
    expect(state.theme).toBe('dark');
    expect(state.isDark).toBe(true);
  });

  test('toggleTheme flips theme and isDark', () => {
    const state1 = reducer({isDark: false, theme: 'light'}, toggleTheme());
    expect(state1).toEqual({isDark: true, theme: 'dark'});
    const state2 = reducer(state1, toggleTheme());
    expect(state2).toEqual({isDark: false, theme: 'light'});
  });

  test('updateSystemTheme updates isDark only when theme is system', () => {
    const sysState: ThemeState = {isDark: false, theme: 'system'};
    const state = reducer(sysState, updateSystemTheme('dark'));
    expect(state.isDark).toBe(true);

    const nonSys = reducer({isDark: false, theme: 'light'}, updateSystemTheme('dark'));
    expect(nonSys.isDark).toBe(false);
  });
});
