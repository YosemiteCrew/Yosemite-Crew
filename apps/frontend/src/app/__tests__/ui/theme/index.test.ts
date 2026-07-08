jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

import * as theme from '@/app/ui/theme';

describe('ui/theme barrel', () => {
  it('re-exports the theme API surface', () => {
    expect(typeof theme.useTheme).toBe('function');
    expect(typeof theme.ThemeToggle).toBe('function');
    expect(typeof theme.ThemeScript).toBe('function');
  });
});
