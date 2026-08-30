import type { Meta, StoryObj } from '@storybook/react';
import type { CSSProperties, ReactNode } from 'react';
import { expect, waitFor, within } from 'storybook/test';

import { HERO_POSTERS, HERO_VIDEOS } from './assets';
import {
  CountUp,
  HeroGlow,
  HeroVideo,
  InkAnnotate,
  Reveal,
  ScrollProgress,
  Spotlight,
  Tilt,
  useParallax,
} from './motion';
// Every reveal state lives in this sheet - the component only flips `data-reveal`
// and owns none of the opacity/translate/blur - so without the import a "hidden"
// element paints fully opaque and the stagger story below proves nothing. Only
// `(routes)/(public)/layout.tsx` loads it in the app.
import './marketing.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Force `useReducedMotion` to report true for one story.
 *
 * The hook reads the media query through `useSyncExternalStore`, so swapping
 * `matchMedia` before the story renders is enough - no effect has to run first.
 * It is installed for the reduced-motion query ONLY and delegates everything else
 * (Storybook's own layout queries included) to the real implementation.
 *
 * What this cannot reach is the CSS half of the guard: `@media
 * (prefers-reduced-motion: reduce)` blocks in marketing.css are evaluated by the
 * browser, not by `matchMedia`, so the stories below assert the component's JS
 * branch. Reviewing the CSS half needs the OS preference actually set.
 */
const withReducedMotion = () => {
  const original = globalThis.window.matchMedia;
  const reduced = {
    matches: true,
    media: REDUCED_MOTION_QUERY,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  globalThis.window.matchMedia = ((query: string) =>
    query === REDUCED_MOTION_QUERY
      ? reduced
      : original.call(globalThis.window, query)) as typeof globalThis.window.matchMedia;

  return () => {
    globalThis.window.matchMedia = original;
  };
};

const byId = (canvasElement: HTMLElement, id: string): HTMLElement =>
  canvasElement.querySelector(`#${id}`) as HTMLElement;

/** Move the pointer to a point inside `node`, expressed as a fraction of its box. */
const pointerAt = (node: HTMLElement, fx: number, fy: number, target: EventTarget = node): void => {
  const rect = node.getBoundingClientRect();
  target.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: rect.left + rect.width * fx,
      clientY: rect.top + rect.height * fy,
    })
  );
};

const leave = (node: HTMLElement): void => {
  node.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
};

/**
 * X offset out of a translate3d, e.g. 'translate3d(-2.8px, 1.4px, 0)' -> -2.8.
 * Anchored on the function name because a bare number match finds the '3' in
 * "translate3d" first.
 */
const translateX = (value: string): number => Number(/translate3d\((-?[\d.]+)px/.exec(value)?.[1]);

const CARD_STYLE: CSSProperties = {
  border: '1px solid var(--hairline)',
  borderRadius: 20,
  background: 'var(--band)',
  padding: '28px 30px',
  marginBottom: 18,
  fontSize: 20,
  letterSpacing: '-0.02em',
  color: 'var(--ink)',
};

const SectionCopy = ({ children }: Readonly<{ children: ReactNode }>) => (
  <p
    style={{
      margin: 0,
      maxWidth: 460,
      fontSize: 16,
      lineHeight: 1.6,
      letterSpacing: '-0.01em',
      color: 'var(--ink-muted)',
    }}
  >
    {children}
  </p>
);

/**
 * A page tall enough to have a fold. `Reveal` only arms an element the observer has
 * confirmed is off-screen, so a component rendered into a short canvas stays `idle`
 * forever and none of its states are reachable.
 */
const ScrollSurface = () => (
  <div style={{ padding: '0 32px 32px' }}>
    <div id="progress-host">
      <ScrollProgress />
    </div>
    <Reveal
      id="reveal-lede"
      style={{
        padding: '64px 0 0',
        maxWidth: 620,
        fontFamily: 'var(--font-newsreader)',
        fontSize: 44,
        lineHeight: 1.08,
        letterSpacing: '-0.03em',
        color: 'var(--ink)',
      }}
    >
      The operating system veterinary clinics run on.
    </Reveal>
    <div style={{ height: '150vh' }} aria-hidden="true" />
    <Reveal id="reveal-a" delay={0} style={CARD_STYLE}>
      Appointments, records, and billing on one screen.
    </Reveal>
    <Reveal id="reveal-b" delay={250} style={CARD_STYLE}>
      A FHIR-native API and a codebase you can actually read.
    </Reveal>
    <div style={{ height: '40vh' }} aria-hidden="true" />
  </div>
);

const PointerPlayground = () => (
  <div style={{ display: 'grid', gap: 28, padding: 40 }}>
    <Tilt
      max={6}
      className="story-tilt"
      style={{
        borderRadius: 24,
        border: '1px solid var(--hairline)',
        background: 'var(--band)',
        padding: '34px 36px',
      }}
    >
      <SectionCopy>Tilt: the card leans toward the cursor and flattens on exit.</SectionCopy>
    </Tilt>
    <Spotlight
      className="story-spotlight"
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        background: '#1b1a16',
        padding: '34px 36px',
        color: '#d8cec0',
      }}
    >
      <p style={{ margin: 0, maxWidth: 460, fontSize: 16, lineHeight: 1.6 }}>
        Spotlight: a radial glow follows the cursor across the dark band.
      </p>
    </Spotlight>
  </div>
);

const HeroBand = ({ src }: Readonly<{ src: string }>) => (
  <div
    style={{
      position: 'relative',
      minHeight: 460,
      overflow: 'hidden',
      background: 'var(--page)',
    }}
  >
    <HeroVideo src={src} poster={HERO_POSTERS.home} position="center 50%" />
    <div style={{ position: 'relative', zIndex: 2, padding: '96px 48px' }}>
      <h2
        style={{
          margin: 0,
          maxWidth: 620,
          fontFamily: 'var(--font-newsreader)',
          fontSize: 52,
          fontWeight: 400,
          lineHeight: 1.04,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}
      >
        See the whole animal.
      </h2>
    </div>
  </div>
);

const COUNT_STYLE: CSSProperties = {
  fontSize: 60,
  fontWeight: 500,
  letterSpacing: '-0.05em',
  lineHeight: 1,
  color: 'var(--ink)',
};

const CountCell = ({
  id,
  value,
  label,
}: Readonly<{ id: string; value: string; label: string }>) => (
  <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <CountUp value={value} className="story-count" style={COUNT_STYLE} />
    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-muted)' }}>{label}</span>
  </div>
);

const CountBand = ({ belowTheFold }: Readonly<{ belowTheFold: boolean }>) => (
  <div style={{ padding: 32 }}>
    {belowTheFold ? <div style={{ height: '140vh' }} aria-hidden="true" /> : null}
    <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
      <CountCell id="count-clones" value="67,134" label="Repository clones" />
      <CountCell id="count-stars" value="2.4k" label="GitHub stars" />
      <CountCell id="count-pending" value="·" label="Discord members" />
    </div>
    <div style={{ height: '40vh' }} aria-hidden="true" />
  </div>
);

const InkHeadline = () => (
  <div style={{ padding: '72px 48px', maxWidth: 760 }}>
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-newsreader)',
        fontSize: 54,
        fontWeight: 400,
        lineHeight: 1.1,
        letterSpacing: '-0.03em',
        color: 'var(--ink)',
      }}
    >
      See the{' '}
      <span id="ink-circle">
        <InkAnnotate type="circle" delay={0} color="var(--blue)">
          whole
        </InkAnnotate>
      </span>{' '}
      animal.
    </h2>
    <p
      style={{
        margin: '28px 0 0',
        fontSize: 18,
        lineHeight: 1.6,
        letterSpacing: '-0.01em',
        color: 'var(--ink-muted)',
      }}
    >
      Free to self-host, and{' '}
      <span id="ink-underline">
        <InkAnnotate type="underline" delay={0} color="var(--blue)">
          built in the open
        </InkAnnotate>
      </span>
      .
    </p>
  </div>
);

/**
 * `useParallax` is a hook, so the scope it returns has to live in a real component -
 * calling it from a story `render` breaks `react-hooks/rules-of-hooks`.
 */
const GlowScope = () => {
  const scopeRef = useParallax<HTMLElement>();
  return (
    <section
      id="glow-scope"
      ref={scopeRef}
      style={{
        position: 'relative',
        minHeight: 420,
        overflow: 'hidden',
        background: 'var(--page)',
      }}
    >
      <HeroGlow
        depth="0.05"
        scrollSpeed="-0.05"
        color="var(--glow-b09)"
        box={{ top: -140, left: 'calc(50% - 420px)', width: 760, height: 520 }}
        animation="ycDrift 26s ease-in-out infinite alternate"
      />
      <HeroGlow
        parallax={false}
        color="var(--glow-b07)"
        box={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 640,
          height: 380,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2, padding: '120px 48px' }}>
        <SectionCopy>
          Two glows: the first rides a parallax-depth layer, the second sits bare in the section.
        </SectionCopy>
      </div>
    </section>
  );
};

/**
 * No `component` on the meta on purpose: motion.tsx exports eight primitives and no
 * single one of them is "the" component of the file, so pinning one would put the
 * wrong prop table on every story below.
 */
const meta = {
  title: 'Marketing/Motion',
  parameters: {
    layout: 'fullscreen',
    // Marketing surface: without this the preview decorator stamps `data-yc-app` on
    // the wrapper and swaps in the PIMS-scoped faint inks, which these primitives are
    // never drawn against.
    surface: 'marketing',
    docs: {
      description: {
        component:
          "The public site's motion primitives. On a real page they are only observable by " +
          'scrolling two thousand lines of marketing copy, and every one of them has a branch ' +
          'that is invisible from the outside: a reveal that never armed, a tilt that is inert ' +
          'under reduced motion, a hero loop that failed to load and removed itself.\n\n' +
          'Two things had to be arranged for any of it to be reachable here. `Reveal` and ' +
          '`CountUp` are driven by IntersectionObserver, so those stories render a page with a ' +
          'real fold and scroll it in the play function - in a short canvas everything is in ' +
          'view from the first frame and no state ever changes. And the reveal states themselves ' +
          'live in `marketing.css`, not in the component, so the sheet is imported here; without ' +
          'it a "hidden" element is fully opaque.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollReveals: Story = {
  name: 'Reveal - idle, armed, staggered',
  render: () => <ScrollSurface />,
  play: async ({ canvasElement }) => {
    const lede = byId(canvasElement, 'reveal-lede');
    const first = byId(canvasElement, 'reveal-a');
    const second = byId(canvasElement, 'reveal-b');
    const bar = byId(canvasElement, 'progress-host').firstElementChild as HTMLElement;

    /* On screen at first report, so it is never armed. That is the whole safety
       property of this component: the settled look is the default and only an
       element the client has PROVEN it can reveal is ever hidden. If this ever
       reads 'hidden' the copy above the fold is being animated in after the
       reader has already looked at it. */
    await expect(lede).toHaveAttribute('data-reveal', 'idle');
    await expect(getComputedStyle(lede).opacity).toBe('1');

    await waitFor(() => {
      expect(first).toHaveAttribute('data-reveal', 'hidden');
    });
    await expect(second).toHaveAttribute('data-reveal', 'hidden');
    /* Computed, not the attribute: the attribute is set by the component but the
       opacity comes from marketing.css, and a missing stylesheet is exactly the
       failure that leaves every "hidden" element visible while the attribute
       still says otherwise. */
    await expect(getComputedStyle(first).opacity).toBe('0');
    await expect(bar.style.width).toBe('0%');

    second.scrollIntoView({ block: 'center' });

    await waitFor(() => {
      expect(first).toHaveAttribute('data-reveal', 'shown');
    });
    /* The stagger, measured rather than eyeballed: both cards crossed the
       threshold in the same scroll, and the 250ms delay is the only thing holding
       the second one back. A delay prop that stopped being applied would show up
       here as both flipping together. */
    await expect(second).toHaveAttribute('data-reveal', 'hidden');
    await expect(getComputedStyle(first).animationName).toBe('ycReveal');

    await waitFor(
      () => {
        expect(second).toHaveAttribute('data-reveal', 'shown');
      },
      { timeout: 2000 }
    );

    globalThis.window.scrollTo(0, globalThis.document.documentElement.scrollHeight);
    await waitFor(() => {
      expect(bar.style.width).toBe('100%');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three reveal states in one scroll. The lede is in view when the observer first ' +
          'reports and stays `idle`; the two cards below the fold are armed to `hidden`, then ' +
          'run `ycReveal` 250ms apart when scrolled to. The fixed progress bar at the top is ' +
          '`ScrollProgress`, which reaches 100% at the bottom of the same page.',
      },
    },
  },
};

export const PointerDriven: Story = {
  name: 'Tilt and Spotlight - pointer',
  render: () => <PointerPlayground />,
  play: async ({ canvasElement }) => {
    const tilt = canvasElement.querySelector('.story-tilt') as HTMLElement;
    const spot = canvasElement.querySelector('.story-spotlight') as HTMLElement;
    const glow = spot.firstElementChild as HTMLElement;

    // The glow layer is decorative and must never be reachable, or a screen reader
    // meets an empty div between the section and its copy.
    await expect(glow).toHaveAttribute('aria-hidden', 'true');
    await expect(glow.style.opacity).toBe('0');

    // Below and right of centre. The sign convention is the part worth pinning:
    // rotateY follows the cursor's X and rotateX is INVERTED against its Y, which
    // is what makes the card lean toward the pointer rather than away from it.
    pointerAt(tilt, 0.75, 0.75);
    const rotate = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/.exec(tilt.style.transform);
    await expect(rotate).not.toBeNull();
    const rotateX = Number(rotate?.[1]);
    const rotateY = Number(rotate?.[2]);
    await expect(rotateX).toBeLessThan(0);
    await expect(rotateY).toBeGreaterThan(0);
    // `max` is the full sweep, so a quarter-box offset is a quarter of it and the
    // half-box edge is the ceiling. Neither rotation can exceed max/2.
    await expect(Math.abs(rotateX)).toBeLessThanOrEqual(3);
    await expect(Math.abs(rotateY)).toBeLessThanOrEqual(3);

    pointerAt(spot, 0.4, 0.5);
    await expect(glow.style.opacity).toBe('1');
    /* The glow centres on the cursor, in the band's own coordinates. Measured
       rather than matched as a string: the browser reserialises the gradient
       (it drops the `circle` keyword when the size is a single length), so a
       substring check on what the component wrote passes or fails on the
       serialiser rather than on where the light actually landed. */
    const spotRect = spot.getBoundingClientRect();
    const at = /at (-?[\d.]+)px (-?[\d.]+)px/.exec(glow.style.background);
    await expect(at).not.toBeNull();
    await expect(Math.abs(Number(at?.[1]) - spotRect.width * 0.4)).toBeLessThanOrEqual(1);
    await expect(Math.abs(Number(at?.[2]) - spotRect.height * 0.5)).toBeLessThanOrEqual(1);

    leave(tilt);
    leave(spot);
    // Flat and dark again. The reset is a separate listener from the move, so a
    // card that leans and never comes back is a live failure mode.
    await expect(tilt.style.transform).toBe('perspective(1100px) rotateX(0deg) rotateY(0deg)');
    await expect(glow.style.opacity).toBe('0');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both pointer effects write inline styles from a `mousemove` listener, so the play ' +
          'function drives them with real events at known fractions of each box and reads the ' +
          'geometry back. Hovering the card in the canvas does the same thing by hand.',
      },
    },
  },
};

export const PointerDrivenReducedMotion: Story = {
  name: 'Tilt and Spotlight - reduced motion',
  render: () => <PointerPlayground />,
  beforeEach: withReducedMotion,
  play: async ({ canvasElement }) => {
    const tilt = canvasElement.querySelector('.story-tilt') as HTMLElement;
    const spot = canvasElement.querySelector('.story-spotlight') as HTMLElement;
    const glow = spot.firstElementChild as HTMLElement;

    pointerAt(tilt, 0.75, 0.75);
    pointerAt(spot, 0.4, 0.5);

    /* Nothing was written at all - not a zeroed transform, not a transition. Both
       effects bail before they add their listeners, so the elements are inert
       rather than animating to a neutral value, and `transition` staying empty is
       what proves the effect returned early instead of merely being handed a
       cursor it ignored. */
    await expect(tilt.style.transform).toBe('');
    await expect(tilt.style.transition).toBe('');
    await expect(glow.style.opacity).toBe('0');
    await expect(glow.style.background).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same two cards for a reader who asked the OS for less motion. Both effects read ' +
          '`useReducedMotion` and never attach their pointer listeners, so the card is flat and ' +
          'the dark band keeps no glow.',
      },
    },
  },
};

export const HeroLoop: Story = {
  name: 'HeroVideo - ambient loop',
  render: () => <HeroBand src={HERO_VIDEOS.home} />,
  play: async ({ canvasElement }) => {
    const video = canvasElement.querySelector('video') as HTMLVideoElement;

    await expect(video.muted).toBe(true);
    await expect(video.loop).toBe(true);
    await expect(video.autoplay).toBe(true);
    await expect(video.hasAttribute('playsinline')).toBe(true);
    await expect(video.style.objectPosition).toBe('center 50%');

    /* The decorative layer is hidden at the WRAPPER, and the <video> itself must
       stay clean: aria-hidden on a focusable element is the Sonar finding this
       shape exists to avoid. */
    await expect(video.hasAttribute('aria-hidden')).toBe(false);
    await expect(video.parentElement).toHaveAttribute('aria-hidden', 'true');

    /* The reduced-motion CSS guard is written as `[data-hero-video] +
       [data-hero-scrim]`, so the scrim being the video's IMMEDIATE next sibling is
       load-bearing. Slip anything between them and reduced-motion readers get a
       hidden video under a scrim that still paints. */
    await expect(video.nextElementSibling).toHaveAttribute('data-hero-scrim', '');

    const source = video.querySelector('source') as HTMLSourceElement;
    await expect(source).toHaveAttribute('src', HERO_VIDEOS.home);
    /* No `media` attribute, ever. It used to carry
       media="(prefers-reduced-motion: no-preference)", which WebKit evaluates
       during initial resource selection and rejects, leaving the element in a
       terminal NETWORK_NO_SOURCE - the loop never played in Safari on any landing
       page. Reduced motion is honoured by the CSS guard and the unmount instead. */
    await expect(source.hasAttribute('media')).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The home hero loop, from the real CDN source, with its warm scrim over the top and ' +
          'the headline above both. Poster and loop are the shipped assets, so this is also ' +
          'where a broken CDN path shows up.',
      },
    },
  },
};

export const HeroLoopUnavailable: Story = {
  name: 'HeroVideo - source failed',
  render: () => <HeroBand src="/images/marketing/no-such-hero-loop.mp4" />,
  play: async ({ canvasElement }) => {
    /* Fired explicitly, because the 404 alone does not get here. Measured in
       Chromium against this exact markup: a failing <source> CHILD fires `error`
       on the source element, leaves `video.error` null and `networkState` at
       NETWORK_NO_SOURCE, and never fires `error` at the media element - and media
       error events do not bubble. So the component's onError (bound to the
       <video>) is unreachable through a broken source, and this story drives the
       fallback the only way anything can. */
    const video = canvasElement.querySelector('video');
    video?.dispatchEvent(new Event('error'));

    await waitFor(() => {
      expect(canvasElement.querySelector('video')).toBeNull();
    });
    // The scrim goes with it. Left behind it would wash the hero band for no
    // reason, which is the failure that is easy to miss because it still looks
    // deliberate.
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeNull();
    await expect(within(canvasElement).getByText('See the whole animal.')).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a reader gets when the loop cannot load: nothing. The component drops both the ' +
          'video and its scrim and the hero falls back to the flat band, with the headline ' +
          'untouched.',
      },
    },
  },
};

export const HeroLoopReducedMotion: Story = {
  name: 'HeroVideo - reduced motion',
  render: () => <HeroBand src={HERO_VIDEOS.home} />,
  beforeEach: withReducedMotion,
  play: async ({ canvasElement }) => {
    // Removed, not hidden. `display: none` alone leaves the loop playing, so the
    // unmount is what actually stops it - and the scrim must go with it or the
    // band keeps a wash over nothing.
    await expect(canvasElement.querySelector('video')).toBeNull();
    await expect(canvasElement.querySelector('[data-hero-scrim]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reduced motion drops the loop from the tree entirely. In the app the CSS guard hides ' +
          'it from the first paint as well, so it never flashes before the client can read the ' +
          'preference - that half is a real media query and is not reachable from this story.',
      },
    },
  },
};

export const Counters: Story = {
  name: 'CountUp - counts on entry',
  render: () => <CountBand belowTheFold />,
  play: async ({ canvasElement }) => {
    const cell = (id: string) =>
      byId(canvasElement, id).querySelector('.story-count') as HTMLElement;
    const clones = cell('count-clones');
    const pending = cell('count-pending');

    // Two children: an invisible sizer holding the final value, and the animating
    // overlay on top of it.
    const sizer = clones.firstElementChild as HTMLElement;
    const live = clones.lastElementChild as HTMLElement;
    await expect(sizer).toHaveAttribute('aria-hidden', 'true');

    /* Before it is in view the overlay already reads the final value - the count
       starts at zero only once the observer fires. Worth pinning because it is the
       opposite of what the name suggests, and it is what keeps a stat that is
       never scrolled to from reading "0". */
    await expect(live.textContent).toBe('67,134');

    const reservedWidth = sizer.getBoundingClientRect().width;
    clones.scrollIntoView({ block: 'center' });

    // Counting: the overlay drops well below the target and climbs.
    await waitFor(() => {
      expect(live.textContent).not.toBe('67,134');
    });
    /* The sizer is the whole reason this component is not a bare <span>: it holds
       the final value's width for the entire run, so the number cannot reflow the
       copy beside it on every frame. */
    await expect(sizer.textContent).toBe('67,134');
    // Within a subpixel: text metrics shift by a 32nd of a pixel with the box's
    // fractional position. A reflow caused by the counting value would be tens of
    // pixels, which this still catches.
    await expect(sizer.getBoundingClientRect().width).toBeCloseTo(reservedWidth, 1);

    // A placeholder is never mistaken for a number. '·' is what the marketing
    // pages pass while the stats fetch is still out, and parsing it must not turn
    // it into a zero that counts up.
    await expect((pending.lastElementChild as HTMLElement).textContent).toBe('·');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The stat band below the fold, then scrolled into view. The first number counts up ' +
          'over 1.5s while its invisible sizer holds the final width, and the third cell is the ' +
          'placeholder the marketing pages pass before the community stats resolve.',
      },
    },
  },
};

export const CountersReducedMotion: Story = {
  name: 'CountUp - reduced motion',
  render: () => <CountBand belowTheFold={false} />,
  beforeEach: withReducedMotion,
  play: async ({ canvasElement }) => {
    const cell = (id: string) =>
      byId(canvasElement, id).querySelector('.story-count') as HTMLElement;

    /* Polled on the SUFFIX cell, not on the plain one. '67,134' reads the same
       before the observer fires as it does after (the pre-view overlay already
       holds the final string), so a wait on that cell settles on the first tick
       and proves nothing about the reduced-motion branch ever running.

       '2.4k' is the suffix example from CountUp's own docstring, and this is what
       it renders: the trailing 'k' is carried through, but `parseInt` stops at the
       decimal point, so the target is 2 and the settled value is '2k'. That is a
       defect in the component, not in the story - pinned here rather than fixed. */
    await waitFor(() => {
      expect((cell('count-stars').lastElementChild as HTMLElement).textContent).toBe('2k');
    });
    await expect((cell('count-clones').lastElementChild as HTMLElement).textContent).toBe('67,134');
    // The sizer still reserves the width of the full '2.4k', so the visible '2k'
    // sits in a box that is wider than it needs.
    await expect((cell('count-stars').firstElementChild as HTMLElement).textContent).toBe('2.4k');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Under reduced motion the final value appears as soon as the cell is in view, with no ' +
          'count-up. Same formatting path as the animated end state, which is why the `2.4k` ' +
          'rounding shows up here.',
      },
    },
  },
};

export const Ink: Story = {
  name: 'InkAnnotate - circle and underline',
  render: () => <InkHeadline />,
  play: async ({ canvasElement }) => {
    const inkPath = async (hostId: string) =>
      waitFor(() => {
        const path = byId(canvasElement, hostId).querySelector(
          'svg[data-ink] path'
        ) as SVGPathElement;
        expect(path).not.toBeNull();
        return path;
      });

    const circle = await inkPath('ink-circle');
    const underline = await inkPath('ink-underline');
    const svg = circle.ownerSVGElement as SVGSVGElement;

    // Behind the word and out of the accessibility tree: the mark is drawn into
    // the DOM imperatively, so nothing else guards these two.
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    await expect(svg.style.zIndex).toBe('-1');
    await expect(svg.style.pointerEvents).toBe('none');

    // The svg is deliberately larger than the word and offset back over it, or the
    // circle would be clipped to the glyphs it is supposed to enclose.
    const host = byId(canvasElement, 'ink-circle').firstElementChild as HTMLElement;
    await expect(Number.parseFloat(svg.style.left)).toBeLessThan(0);
    await expect(Number.parseFloat(svg.style.width)).toBeGreaterThan(host.offsetWidth);

    await expect(circle).toHaveAttribute('stroke-width', '2.4');
    await expect(underline).toHaveAttribute('stroke-width', '3.4');
    // The circle is a 46-segment smoothed loop and the underline is a single
    // swoosh, so the two `type` values really do produce different geometry.
    await expect(circle.getTotalLength()).toBeGreaterThan(underline.getTotalLength());

    /* Both are in view, so both draw: the dash offset is reset to the path length
       and then transitioned to 0. Reading the inline value rather than a computed
       one keeps this off the transition clock. */
    await waitFor(() => {
      expect(circle.style.strokeDashoffset).toBe('0');
      expect(underline.style.strokeDashoffset).toBe('0');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both annotation types on real headline copy. The mark is an SVG built after ' +
          '`document.fonts.ready`, so it traces the final glyph metrics rather than the fallback ' +
          'face, and it redraws whenever the word re-enters view.',
      },
    },
  },
};

export const InkReducedMotion: Story = {
  name: 'InkAnnotate - reduced motion',
  render: () => <InkHeadline />,
  beforeEach: withReducedMotion,
  play: async ({ canvasElement }) => {
    const path = await waitFor(() => {
      const found = byId(canvasElement, 'ink-circle').querySelector(
        'svg[data-ink] path'
      ) as SVGPathElement;
      expect(found).not.toBeNull();
      return found;
    });

    /* Drawn, but never animated: no dash array is set at all, so there is nothing
       to transition and no observer wired to replay it. An empty string here is
       the assertion - a zero dash offset would mean the animated path ran and
       happened to have finished. */
    await expect(path.style.strokeDasharray).toBe('');
    await expect(path.style.strokeDashoffset).toBe('');
    await expect(path.style.transition).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same headline for a reduced-motion reader: the ink is present from the first ' +
          'paint with no pen stroke, and it still re-fits itself when the headline reflows.',
      },
    },
  },
};

export const Glows: Story = {
  name: 'HeroGlow - parallax layer and bare',
  render: () => <GlowScope />,
  play: async ({ canvasElement }) => {
    const scope = byId(canvasElement, 'glow-scope');
    const layers = canvasElement.querySelectorAll('[data-depth]');
    await expect(layers).toHaveLength(1);

    const layer = layers[0] as HTMLElement;
    const bare = scope.children[1] as HTMLElement;

    await expect(layer).toHaveAttribute('data-depth', '0.05');
    // The scroll-drift hook selects on this attribute, and it belongs to the GLOW
    // rather than the wrapper - ScrollDrift and useParallax move different nodes.
    await expect(layer.firstElementChild).toHaveAttribute('data-scroll-speed', '-0.05');

    // parallax={false} means the glow is placed directly in the section, with no
    // layer around it at all.
    await expect(bare).toHaveAttribute('aria-hidden', 'true');
    await expect(bare.hasAttribute('data-depth')).toBe(false);
    await expect(bare.parentElement).toBe(scope);

    const rect = scope.getBoundingClientRect();
    globalThis.window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height * 0.5,
      })
    );

    /* Right of centre pulls the layer LEFT - the drift is inverted so the glow
       appears to sit behind the section. Only the depth layer moves; the bare
       glow keeps the centring transform it was given, which is what would break
       silently if HeroGlow ever wrapped both. */
    await waitFor(() => {
      expect(layer.style.transform).toContain('translate3d');
    });
    await expect(translateX(layer.style.transform)).toBeLessThan(0);
    await expect(bare.style.transform).toBe('translate(-50%, -50%)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two ambient glows in one section. The first is wrapped in a `[data-depth]` layer and ' +
          'drifts toward the cursor through `useParallax`; the second is `parallax={false}`, ' +
          'which is the shape the closing CTA bands use where there is no parallax scope.',
      },
    },
  },
};
