// Plain browser script loaded over file:// under a strict CSP - required, not
// imported, so its surface is restated here for the type checker.
import untypedPolicy from '../src/pages/carousel-autoplay.js';

type CarouselState = {
  reduceMotion?: boolean;
  paused?: boolean;
  hovering?: boolean;
  focusWithin?: boolean;
};

const policy: {
  SLIDE_MS: number;
  shouldAdvance: (state?: CarouselState) => boolean;
  controlIsUseful: (state?: CarouselState) => boolean;
  nextIndex: (index: number, total: number) => number;
} = untypedPolicy;

const RESTING: CarouselState = {
  reduceMotion: false,
  paused: false,
  hovering: false,
  focusWithin: false,
};

describe('shouldAdvance', () => {
  test('a carousel nobody is touching advances', () => {
    expect(policy.shouldAdvance(RESTING)).toBe(true);
  });

  // WCAG 2.2.2: the user must be able to stop it. Before this, the only thing
  // that paused the carousel was a mouse over the slides.
  test('the pause button stops it', () => {
    expect(policy.shouldAdvance({ ...RESTING, paused: true })).toBe(false);
  });

  test('a pointer over the slides stops it', () => {
    expect(policy.shouldAdvance({ ...RESTING, hovering: true })).toBe(false);
  });

  // The case the old mouseenter-only rule had no answer for: a keyboard user on
  // the dots had the slide move out from under them every four seconds.
  test('keyboard focus inside the carousel stops it', () => {
    expect(policy.shouldAdvance({ ...RESTING, focusWithin: true })).toBe(false);
  });

  test('reduced motion stops it outright', () => {
    expect(policy.shouldAdvance({ ...RESTING, reduceMotion: true })).toBe(false);
  });

  // Reduced motion is a setting, not a state the play button toggles: pressing
  // play must not start motion the OS has been asked to suppress.
  test('reduced motion is not overridable by the play button', () => {
    expect(policy.shouldAdvance({ ...RESTING, reduceMotion: true, paused: false })).toBe(false);
  });

  test('no state at all is treated as resting', () => {
    expect(policy.shouldAdvance()).toBe(true);
  });
});

describe('controlIsUseful', () => {
  test('the pause control is shown while the carousel can move', () => {
    expect(policy.controlIsUseful(RESTING)).toBe(true);
  });

  test('the pause control is hidden when there is nothing to pause', () => {
    expect(policy.controlIsUseful({ ...RESTING, reduceMotion: true })).toBe(false);
  });
});

describe('nextIndex', () => {
  test('walks forward within the deck', () => {
    expect(policy.nextIndex(2, 5)).toBe(2);
  });

  test('wraps past the last slide back to the first', () => {
    expect(policy.nextIndex(5, 5)).toBe(0);
  });

  test('wraps before the first slide back to the last', () => {
    expect(policy.nextIndex(-1, 5)).toBe(4);
  });

  test('an empty deck has no slide to land on', () => {
    expect(policy.nextIndex(3, 0)).toBe(0);
  });
});

describe('SLIDE_MS', () => {
  test('is the interval welcome.js drives the timer at', () => {
    expect(policy.SLIDE_MS).toBe(4000);
  });
});
