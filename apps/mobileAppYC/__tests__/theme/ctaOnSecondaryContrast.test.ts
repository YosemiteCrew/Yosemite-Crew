import {colors, colorsDark} from '@/theme';

/**
 * Buttons tinted `secondary` must label themselves with `ctaText`.
 *
 * `secondary` flips with the theme (near-black in light, bone in dark) while
 * `white` is a fixed literal, so a white label on one of these buttons is
 * legible in light and invisible in dark. That shipped on the passport wallet
 * buttons at 1.18:1 and went unseen only because the screen was unreachable.
 */
const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const relativeLuminance = (hex: string): number => {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe('ctaText pairs with the secondary tint in both themes', () => {
  it.each([
    ['light', colors],
    ['dark', colorsDark],
  ])('clears 4.5:1 in %s mode', (_theme, palette) => {
    expect(contrast(palette.ctaText, palette.secondary)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('white would fail in dark mode, which is why the token matters', () => {
    // Pins the reason rather than just the outcome: if someone reaches for
    // `white` again on one of these buttons, this is the number they get.
    expect(contrast(colorsDark.white, colorsDark.secondary)).toBeLessThan(1.5);
  });
});
