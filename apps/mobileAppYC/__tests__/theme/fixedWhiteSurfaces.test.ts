import {findSourceFilesMatching} from '../setup/sourceScan';
import {colors, colorsDark} from '@/theme';

/**
 * `white` is #FFFFFF in BOTH themes by design - it is a literal, not a surface.
 * Using it as a fill under content that DOES follow the theme produces the same
 * bug five times over: in dark mode the content inverts to cream and the fill
 * stays white, so the element renders at about 1.2:1 and disappears.
 *
 * Found on the FAQ "No" button (1.18:1), the appointment card's Chat and
 * Check in buttons, InlineEditRow's Cancel, CardActionButton's primary variant
 * and the ErrorBoundary page. Anything genuinely white in both themes belongs
 * on the list below, with a reason.
 */
const ALLOWED = new Set([
  // The emergency badge's cross is a knockout, so it needs a light disc in
  // both themes - and an emergency control is the one place a high-visibility
  // disc is wanted.
  'features/home/screens/HomeScreen/HomeScreen.tsx',
  // A toggle knob is white in both themes, like the platform control.
  'shared/components/common/Toggle/Toggle.tsx',
  // Renders third-party HTML; the reader body is a white page by definition.
  'features/merck/components/MerckSearchWidget.tsx',
  // Icon tint on a filled coloured button, not a surface.
  'shared/components/common/FormScreenLayout.tsx',
  'shared/components/common/CardActionButton/CardActionButton.tsx',
  // A dropdown sheet and a full-screen loader that both carry their own
  // dark-mode treatment elsewhere in the file.
  'shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay.tsx',
  'context/GlobalLoaderContext.tsx',
  'features/coParent/screens/EditCoParentScreen/EditCoParentScreen.tsx',
]);

describe('fixed-white surfaces', () => {
  it('keeps `white` identical in both themes so it is never mistaken for a surface', () => {
    expect(colors.white).toBe(colorsDark.white);
  });

  it('does not fill a themed surface with `white`', () => {
    const offenders = findSourceFilesMatching(
      [
        /backgroundColor:\s*(theme\.)?colors\.white\b/,
        /tintColor=\{(theme\.)?colors\.white\}/,
      ],
      ALLOWED,
    );
    expect(offenders).toEqual([]);
  });
});
