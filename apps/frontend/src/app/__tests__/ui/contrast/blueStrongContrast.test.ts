/**
 * `--blue-strong` is the shared fill under white text, and it is measured from
 * `globals.css` rather than restated here.
 *
 * The token clears AA by 0.04 in dark (#2f74d9 is 4.54:1 against white), and it
 * is not one component's margin: every site that puts text on this fill pairs
 * it with white. At the time of writing that is 30 uses across 21 files -
 * lines under `src/app` matching `var(--blue-strong)`, excluding tests,
 * stories, markdown, `globals.css` itself and matches inside comments. The
 * remainder are border, hover and checked-state uses with no text over the
 * fill. So a nudge to this one value moves every consumer at once.
 *
 * The guard that existed before this one asserted
 * `measureContrast(mount('rgb(255,255,255)', 'rgb(47,116,217)')).ratio === 4.54`
 * against a literal the test carried. That pins the arithmetic of
 * `measureContrast`, which is worth pinning and is still pinned there - but its
 * input is a copy of the artefact, so moving the token to a failing value left
 * the whole suite green (#2822). This one reads the file and asserts the bar,
 * not the number, so it fails when the colour fails rather than when it changes.
 */
import {
  describeContrast,
  measureContrast,
} from '@/app/features/appointments/components/Calendar/responsive/contrastProbe';
import { resolveColour } from '@/app/__tests__/support/globalsTokens';

const FILL = 'var(--blue-strong)';
const INK = 'var(--white-text)';
const SURFACE = 'var(--screen)';

const mount = (color: string, background: string, surface: string) => {
  const outer = document.createElement('div');
  outer.style.backgroundColor = surface;
  const el = document.createElement('span');
  el.style.color = color;
  el.style.backgroundColor = background;
  /* The smallest and lightest text any consumer puts on this fill: the chat
     unread badge and the day-rail now-marker are 8.5-10px. Nothing here is
     WCAG-large, so the bar must be the strict 4.5 and never the 3.0 escape. */
  el.style.fontSize = '10px';
  el.style.fontWeight = '700';
  outer.appendChild(el);
  document.body.appendChild(outer);
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the reader behind these assertions', () => {
  it('resolves --blue-strong to a different literal in each theme', () => {
    /* Without this, a reader that returned the light value for both themes
       would make the dark assertion below a second copy of the light one -
       and dark is the side with the headroom problem. */
    const light = resolveColour(FILL, false);
    const dark = resolveColour(FILL, true);
    expect(light).toMatch(/^#/);
    expect(dark).toMatch(/^#/);
    expect(dark).not.toBe(light);
  });

  it('resolves the ink to an opaque literal in both themes', () => {
    /* A translucent ink would be composited against the fill before the ratio
       is taken, so the number below would still be correct - but it would no
       longer be the measurement this file claims to make, which is white on
       the fill. Opacity is the precondition, not the cross-theme sameness:
       a dark override for the ink is a legitimate change and the assertion
       below would measure it correctly. */
    expect(resolveColour(INK, false)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(resolveColour(INK, true)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe.each(['light', 'dark'] as const)('white on --blue-strong (%s)', (theme) => {
  const dark = theme === 'dark';

  it('clears AA at the smallest size any consumer renders it', () => {
    const reading = measureContrast(
      mount(resolveColour(INK, dark), resolveColour(FILL, dark), resolveColour(SURFACE, dark))
    );
    expect(reading.required).toBe(4.5);
    expect(
      reading.ratio >= reading.required ? true : describeContrast(`--blue-strong ${theme}`, reading)
    ).toBe(true);
  });
});
