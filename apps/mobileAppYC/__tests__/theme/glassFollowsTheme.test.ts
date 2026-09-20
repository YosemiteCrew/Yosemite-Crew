import {findSourceFilesMatching} from '../setup/sourceScan';
import {colors, colorsDark} from '@/theme';

/**
 * Native liquid glass takes a `colorScheme` telling it which vibrancy to
 * render. Pinning that to 'light' hands espresso a pale wash, under ink the
 * theme already darkened for a dark ground - so the surface reads inverted
 * while every token on it is "correct".
 *
 * LiquidGlassButton and LiquidGlassIconButton were fixed for this; the card,
 * the header and the floating tab bar were not, which is what put a cream tab
 * bar across the bottom of every dark screen. The scans below keep all of them
 * honest: a glass surface resolves its scheme from the theme, never a literal.
 */
const SCHEME_ALLOWED = new Set<string>([]);

/**
 * Only glass surfaces are in scope. `colorScheme` is an ordinary prop name -
 * a WebView or a third-party picker may take one and have nothing to do with
 * the warm-bone glass system - so the scan is narrowed to files that actually
 * render a glass surface rather than banning the literal everywhere.
 *
 * A surface that genuinely must stay light in both themes (glass over fixed
 * light media, say) keeps its explicit `colorScheme="light"`, which the card
 * still honours over the theme, and is listed in SCHEME_ALLOWED with a reason.
 */
const GLASS_SURFACE = /LiquidGlass(?:View|Card|Button|IconButton)|BlurView/;

/**
 * `whiteOverlay70` is 70% white in BOTH themes - a literal, like `white`. It
 * is fine as a rim on a fill that itself flips (the CTA buttons), but as the
 * tint or fill OF a surface it paints that surface light on espresso.
 */
const TINT_ALLOWED = new Set<string>([]);

describe('glass surfaces follow the theme', () => {
  it('never pins a glass colorScheme to light', () => {
    const offenders = findSourceFilesMatching(
      [/colorScheme="light"/, /colorScheme: 'light'/, /colorScheme = 'light'/],
      SCHEME_ALLOWED,
      GLASS_SURFACE,
    );
    expect(offenders).toEqual([]);
  });

  it('does not tint or fill a themed surface with `whiteOverlay70`', () => {
    const offenders = findSourceFilesMatching(
      [
        /(?:tintColor|backgroundColor)(?:=\{|: )(?:theme\.)?colors\.whiteOverlay70\b/,
      ],
      TINT_ALLOWED,
    );
    expect(offenders).toEqual([]);
  });

  it('gives the tab bar frost a real espresso value, not the same white twice', () => {
    expect(colors.glassBarTint).toBe('rgba(255, 255, 255, 0.7)');
    expect(colorsDark.glassBarTint).not.toBe(colors.glassBarTint);
  });
});
