import { getMerckSubtopicPillStyle } from '@/app/features/integrations/constants/merck';
import { getStatusBadgeStyle } from '@/app/features/inventory/pages/Inventory/utils';
import { measureContrast } from '@/app/features/appointments/components/Calendar/responsive/contrastProbe';
import { getOrganizationStatusStyle } from '@/app/ui/tables/tableUtils';
import { AllFilterOption } from '@/app/constants/status';
import { resolve, resolveColour } from '@/app/__tests__/support/globalsTokens';

/**
 * These three switches paint with inline `style`, so their colours are invisible
 * to a className audit and to Storybook's theme decorator alike - the element
 * carries a plausible `text-[var(--ink-muted)]` class that the style object
 * overrides. They shipped `--color-badge-blue-text` on `--color-badge-blue-bg`,
 * which is 3.61:1 against a 4.5:1 bar at every size they render.
 *
 * Asserting the token NAMES would pass forever, so this resolves them out of
 * `globals.css` and measures. A regression in either the switch or the token
 * values fails it.
 *
 * The reader moved to `__tests__/support/globalsTokens` when #2822 added a
 * second guard that needed it. It is the same parse: `@theme` and `:root` into
 * the light map, every dark rule accumulating in file order so the later one
 * wins, and `resolveColour` failing loudly rather than handing the probe an
 * empty string it would read as black on white.
 */

const resolveToken = resolveColour;

const mount = (color: string, background: string, surface: string, px: string, weight: string) => {
  const outer = document.createElement('div');
  outer.style.backgroundColor = surface;
  const el = document.createElement('span');
  el.style.color = color;
  el.style.backgroundColor = background;
  el.style.fontSize = px;
  el.style.fontWeight = weight;
  outer.appendChild(el);
  document.body.appendChild(outer);
  return el;
};

/** The surface each pill actually sits on, needed because the dark fills are translucent. */
const SURFACE = { light: '--screen', dark: '--screen' };

type Site = {
  name: string;
  style: { color?: string; backgroundColor?: string };
  px: string;
  weight: string;
};

const SITES: Site[] = [
  {
    // InventoryPhoneCatalog -> StatusPill, `text-[10px] ... font-bold`.
    name: 'inventory status pill, unrecognised status',
    style: getStatusBadgeStyle('a status the API invented'),
    px: '10px',
    weight: '700',
  },
  {
    // AppointmentMerckSearch, `text-[10.5px] font-semibold`.
    name: 'merck Full Summary pill',
    style: getMerckSubtopicPillStyle('Full Summary'),
    px: '10.5px',
    weight: '600',
  },
  {
    // No production caller today; fixed so the pairing is not waiting to be used.
    name: 'organisation status, unknown',
    style: getOrganizationStatusStyle('something unmapped'),
    px: '10px',
    weight: '700',
  },
];

describe('the token reader itself', () => {
  /* Every assertion below is only as good as this. A scanner that silently
     resolves nothing would hand `measureContrast` two empty strings, which it
     reads as black on white - a comfortable pass on a broken instrument. */
  it('reads a token that flips between themes', () => {
    expect(resolve('var(--screen)', false)).toBe('#f7f3ec');
    expect(resolve('var(--screen)', true)).toBe('#2f271e');
  });

  it('resolves the aliased pill tokens through @theme into the dark values', () => {
    expect(resolve('var(--color-pill-neutral-text)', false)).toBe('#5c5956');
    expect(resolve('var(--color-pill-neutral-text)', true)).toBe('#b9b0a4');
  });

  it('shows the badge pair not flipping, which is why no ink rescued it', () => {
    expect(resolve('var(--color-badge-blue-bg)', false)).toBe('#007cf5');
    expect(resolve('var(--color-badge-blue-bg)', true)).toBe('#007cf5');
  });
});

describe.each(['light', 'dark'] as const)('inline status pill contrast (%s)', (theme) => {
  const dark = theme === 'dark';

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(SITES.map((s) => [s.name, s] as const))('%s clears its bar', (_name, site) => {
    expect(site.style.color).toBeDefined();
    expect(site.style.backgroundColor).toBeDefined();

    const el = mount(
      resolveToken(site.style.color as string, dark),
      resolveToken(site.style.backgroundColor as string, dark),
      resolveToken(`var(${dark ? SURFACE.dark : SURFACE.light})`, dark),
      site.px,
      site.weight
    );

    const reading = measureContrast(el);
    // None of these is large text, so the bar must be the strict one.
    expect(reading.required).toBe(4.5);
    expect(reading.ratio).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * The same defect one step earlier: colours that are not painted today but are
 * one deleted `key === 'ALL'` guard away from it.
 *
 * `StatusOptionButtons`' non-ALL branch renders `option.bg` under `option.text`.
 * The All row used to carry the badge-blue pair there and was kept off screen
 * only because each of its four consumers substituted something else at the
 * point of use (#2814). These two arms assert the data is safe to render, not
 * that the consumers happen not to render it.
 */
describe('the neutral All filter option', () => {
  it.each(['light', 'dark'] as const)('has no fill to write on (%s)', (theme) => {
    /* Not `expect(...).not.toBe('#007cf5')`: any prefix whose `-bg` is a colour
       reintroduces the pairing, so the assertion is the absence of a fill.
       Pointing `AllFilterOption` at any filled prefix fails here. */
    expect(resolve(AllFilterOption.bg, theme === 'dark')).toBe('transparent');
  });

  it.each(['light', 'dark'] as const)('reads on the panel it sits on (%s)', (theme) => {
    const dark = theme === 'dark';
    const el = mount(
      resolveToken(AllFilterOption.text, dark),
      resolveToken(`var(${dark ? SURFACE.dark : SURFACE.light})`, dark),
      resolveToken(`var(${dark ? SURFACE.dark : SURFACE.light})`, dark),
      '13px',
      '400'
    );
    const reading = measureContrast(el);
    expect(reading.required).toBe(4.5);
    expect(reading.ratio).toBeGreaterThanOrEqual(4.5);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });
});

describe('the token pair these replaced', () => {
  it('is still the failing pair, so the fix is not a no-op', () => {
    /* If someone "fixes" --color-badge-blue-* itself, the switches above could
       be reverted harmlessly and this test would stop meaning anything. Pin the
       reason the change was needed. */
    const ink = resolveToken('var(--color-badge-blue-text)', false);
    const fill = resolveToken('var(--color-badge-blue-bg)', false);
    /* This is the only assertion here that a broken token reader would SURVIVE:
       two empty strings measure as a low ratio and read as "still failing".
       Naming the literals makes it fail loudly instead - the shared guard in
       `resolveToken` is the other half, and removing it is what made this the
       one test in the file that stayed green with the reader disabled. */
    expect([ink, fill]).toEqual(['#eaf3ff', '#007cf5']);

    const el = mount(ink, fill, resolveToken('var(--screen)', false), '10px', '700');
    const reading = measureContrast(el);
    expect(reading.ratio).toBeLessThan(4.5);
  });
});
