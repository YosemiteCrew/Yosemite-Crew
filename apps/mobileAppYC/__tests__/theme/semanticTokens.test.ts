import {semanticColorsLight, semanticColorsDark} from '@/theme/semanticTokens';

describe('semanticTokens', () => {
  it('exports semanticColorsLight as a non-empty object', () => {
    expect(semanticColorsLight).toBeDefined();
    expect(typeof semanticColorsLight).toBe('object');
    expect(Object.keys(semanticColorsLight).length).toBeGreaterThan(0);
  });

  it('exports semanticColorsDark as a non-empty object', () => {
    expect(semanticColorsDark).toBeDefined();
    expect(typeof semanticColorsDark).toBe('object');
    expect(Object.keys(semanticColorsDark).length).toBeGreaterThan(0);
  });

  it('light and dark tokens share the same keys', () => {
    const lightKeys = Object.keys(semanticColorsLight).sort();
    const darkKeys = Object.keys(semanticColorsDark).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('all token values are non-empty strings', () => {
    for (const [_key, value] of Object.entries(semanticColorsLight)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
    for (const [_key, value] of Object.entries(semanticColorsDark)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it('semanticColorsLight includes core semantic keys', () => {
    expect('text.primary' in semanticColorsLight).toBe(true);
    expect('surface.card' in semanticColorsLight).toBe(true);
    expect('border.default' in semanticColorsLight).toBe(true);
  });
});
