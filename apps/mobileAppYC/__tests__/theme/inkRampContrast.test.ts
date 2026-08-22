import * as fs from 'fs';
import * as path from 'path';
import {colors, colorsDark} from '@/theme';

const luminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = parts.map(v =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('ink ramp contrast', () => {
  it('inkMuted carries body text in both themes', () => {
    expect(contrast(colors.inkMuted, colors.screen)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(colorsDark.inkMuted, colorsDark.screen),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('inkFaint clears the 3:1 bar for icons and large type', () => {
    expect(contrast(colors.inkFaint, colors.screen)).toBeGreaterThanOrEqual(3);
    expect(
      contrast(colorsDark.inkFaint, colorsDark.screen),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('ink ramp usage', () => {
  const SRC = path.join(__dirname, '..', '..', 'src');

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
    return out;
  };

  // inkFaint2 measures 2.26:1 on the light ground - below the 4.5:1 text bar
  // AND below the 3:1 UI bar. The two allowed exceptions are a disabled
  // control (WCAG 1.4.3 exempts inactive controls) and the splash, whose copy
  // sits over video rather than over a themed ground.
  const ALLOWED = [
    path.join('auth', 'screens', 'OTPVerificationScreen.tsx'),
    path.join('customSplashScreen', 'customSplash.tsx'),
  ];

  it('inkFaint2 is not used outside the documented exceptions', () => {
    const offenders = walk(SRC)
      .filter(f => !f.includes(`${path.sep}theme${path.sep}`))
      .filter(f => !ALLOWED.some(a => f.endsWith(a)))
      .filter(f => /\binkFaint2\b/.test(fs.readFileSync(f, 'utf8')))
      .map(f => f.slice(f.indexOf(`src${path.sep}`)));

    expect(offenders).toEqual([]);
  });
});
