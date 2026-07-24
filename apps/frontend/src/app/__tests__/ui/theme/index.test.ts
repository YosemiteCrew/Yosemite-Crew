import * as theme from '@/app/ui/theme';

describe('ui/theme barrel', () => {
  it('re-exports the client-safe theme API surface', () => {
    expect(typeof theme.useTheme).toBe('function');
    expect(typeof theme.ThemeToggle).toBe('function');
  });

  it('does not re-export the server-only ThemeScript (keeps the barrel client-safe)', () => {
    expect('ThemeScript' in theme).toBe(false);
  });
});
