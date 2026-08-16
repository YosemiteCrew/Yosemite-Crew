import {colors, colorsDark} from '@/theme/colors';

describe('warm-bone colors', () => {
  it('exposes the light warm-bone surface + ink tokens', () => {
    expect(colors.screen).toBe('#F7F3EC');
    expect(colors.page).toBe('#EFE8DC');
    expect(colors.screen2).toBe('#F1EBE1');
    expect(colors.hairline).toBe('#E5DCCF');
    expect(colors.ink).toBe('#1D1C1B');
    expect(colors.inkMuted).toBe('#5C5956');
    expect(colors.cta).toBe('#302F2E');
    expect(colors.ctaText).toBe('#FFFFFF');
  });

  it('uses blue for interaction and pink for companion accents', () => {
    expect(colors.blue).toBe('#257BED');
    expect(colors.pink).toBe('#FF90D4');
    expect(colors.success).toBe('#008F5D');
    expect(colors.danger).toBe('#EA3729');
  });

  it('maps legacy background/text aliases onto warm-bone values', () => {
    expect(colors.background).toBe(colors.screen);
    expect(colors.cardBackground).toBe(colors.screen);
    expect(colors.text).toBe('#302F2E');
    expect(colors.border).toBe(colors.hairline);
    expect(colors.error).toBe(colors.danger);
  });

  it('inverts CTA and surfaces for the espresso dark palette', () => {
    expect(colorsDark.screen).toBe('#2F271E');
    expect(colorsDark.ink).toBe('#F4EFE6');
    expect(colorsDark.cta).toBe('#F2ECE1');
    expect(colorsDark.ctaText).toBe('#201C18');
  });

  it('keeps blue and pink fills identical across themes', () => {
    expect(colorsDark.blue).toBe(colors.blue);
    expect(colorsDark.pink).toBe(colors.pink);
  });

  it('light and dark palettes share exactly the same keys', () => {
    expect(Object.keys(colorsDark).sort()).toEqual(Object.keys(colors).sort());
  });

  it('every token is a non-empty string', () => {
    for (const value of Object.values(colors)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
    for (const value of Object.values(colorsDark)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
