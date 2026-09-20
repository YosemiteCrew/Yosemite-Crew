import fs from 'node:fs';
import path from 'node:path';
import {
  LOCAL_PAGE_BACKGROUND,
  localPageBackgroundColor,
  isValidAccentColor,
  isValidFontScale,
  clampFontScale,
  buildThemeCss,
  applyThemeToWebContents,
  DEFAULT_ACCENT_COLOR,
} from '../src/ui/theming';

describe('isValidAccentColor', () => {
  test('returns true for valid colors from the palette', () => {
    expect(isValidAccentColor('#3b87ec')).toBe(true);
    expect(isValidAccentColor('#6c5ce7')).toBe(true);
    expect(isValidAccentColor('#e74c3c')).toBe(true);
  });

  test('returns false for colors not in the palette', () => {
    expect(isValidAccentColor('#ff0000')).toBe(false);
    expect(isValidAccentColor('red')).toBe(false);
    expect(isValidAccentColor('')).toBe(false);
  });
});

describe('isValidFontScale', () => {
  test('returns true for values between 0.5 and 2.0', () => {
    expect(isValidFontScale(0.5)).toBe(true);
    expect(isValidFontScale(1)).toBe(true);
    expect(isValidFontScale(1.5)).toBe(true);
    expect(isValidFontScale(2.0)).toBe(true);
  });

  test('returns false for values outside range', () => {
    expect(isValidFontScale(0.49)).toBe(false);
    expect(isValidFontScale(2.01)).toBe(false);
    expect(isValidFontScale(-1)).toBe(false);
  });

  test('returns false for non-finite values', () => {
    expect(isValidFontScale(Infinity)).toBe(false);
    expect(isValidFontScale(NaN)).toBe(false);
  });
});

describe('clampFontScale', () => {
  test('passes through valid values', () => {
    expect(clampFontScale(1)).toBe(1);
    expect(clampFontScale(1.5)).toBe(1.5);
  });

  test('clamps values below 0.5', () => {
    expect(clampFontScale(0.25)).toBe(0.5);
    expect(clampFontScale(0)).toBe(0.5);
  });

  test('clamps values above 2.0', () => {
    expect(clampFontScale(2.5)).toBe(2.0);
    expect(clampFontScale(10)).toBe(2.0);
  });

  test('rounds to nearest 0.25', () => {
    expect(clampFontScale(0.6)).toBe(0.5);
    expect(clampFontScale(0.7)).toBe(0.75);
    expect(clampFontScale(1.1)).toBe(1);
    expect(clampFontScale(1.3)).toBe(1.25);
  });
});

describe('buildThemeCss', () => {
  test('includes valid accent color', () => {
    const css = buildThemeCss('#6c5ce7');
    expect(css).toContain('--yc-accent: #6c5ce7');
  });

  test('uses default color for invalid input', () => {
    const css = buildThemeCss('invalid');
    expect(css).toContain(`--yc-accent: ${DEFAULT_ACCENT_COLOR}`);
  });

  test('returns valid CSS with root selector', () => {
    const css = buildThemeCss('#3b87ec');
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toContain('}');
  });
});

describe('applyThemeToWebContents', () => {
  test('sets zoom level and injects CSS', async () => {
    let zoomLevel = 0;
    let injectedCss = '';
    const wc = {
      setZoomLevel: (level: number) => {
        zoomLevel = level;
      },
      insertCSS: (css: string) => {
        injectedCss = css;
        return Promise.resolve('key-1');
      },
    };
    const key = await applyThemeToWebContents(
      wc as Parameters<typeof applyThemeToWebContents>[0],
      '#e74c3c',
      1.25
    );
    expect(zoomLevel).toBe(0.25);
    expect(injectedCss).toContain('--yc-accent: #e74c3c');
    expect(key).toBe('key-1');
  });

  test('returns null when insertCSS throws', async () => {
    const wc = {
      setZoomLevel: () => undefined,
      insertCSS: () => Promise.reject(new Error('fail')),
    };
    const key = await applyThemeToWebContents(
      wc as Parameters<typeof applyThemeToWebContents>[0],
      '#3b87ec',
      1
    );
    expect(key).toBeNull();
  });
});

describe('localPageBackgroundColor', () => {
  test('selects by theme', () => {
    expect(localPageBackgroundColor(true)).toBe(LOCAL_PAGE_BACKGROUND.dark);
    expect(localPageBackgroundColor(false)).toBe(LOCAL_PAGE_BACKGROUND.light);
  });

  test('the two themes are different colours', () => {
    // Without this, setting both constants to the same value would still pass
    // the agreement check below for whichever theme it matched.
    expect(LOCAL_PAGE_BACKGROUND.light).not.toBe(LOCAL_PAGE_BACKGROUND.dark);
  });

  /*
   * The point of the constant is that Electron paints the same colour the page
   * is about to paint, so a window no longer flashes white before its first
   * frame (issue #3298). That only holds while it agrees with `--screen` in
   * tokens.css, which this reads rather than restates.
   */
  test('agrees with the --screen the local pages paint', () => {
    const tokensPath = path.join(__dirname, '..', 'src', 'pages', 'tokens.css');
    const tokens = fs.readFileSync(tokensPath, 'utf8');
    const declared = [...tokens.matchAll(/^\s*--screen:\s*(#[0-9a-fA-F]{3,8});/gm)].map((m) =>
      m[1]!.toLowerCase()
    );

    // Canary: zero matches would make the set comparison below vacuous in
    // exactly the case where it is wrong - a renamed token, a moved file.
    expect(declared.length).toBeGreaterThan(0);

    // `:root` is the light theme and is declared first; the dark blocks follow.
    expect(declared[0]).toBe(LOCAL_PAGE_BACKGROUND.light);
    expect(new Set(declared)).toEqual(
      new Set([LOCAL_PAGE_BACKGROUND.light, LOCAL_PAGE_BACKGROUND.dark])
    );
  });
});
