import {durations, easings, springs, motion} from '@/theme/motion';

describe('motion tokens', () => {
  it('exposes the design-system duration scale in milliseconds', () => {
    expect(durations.instant).toBe(0);
    expect(durations.fast).toBe(150);
    expect(durations.normal).toBe(300);
    expect(durations.slow).toBe(500);
    expect(durations.slower).toBe(700);
  });

  it('exposes cubic-bezier easing tuples', () => {
    expect(easings.easeInOut).toHaveLength(4);
    expect(easings.spring).toEqual([0.34, 1.56, 0.64, 1]);
    expect(easings.ink).toEqual([0.6, 0.04, 0.28, 1]);
  });

  it('keeps the floating tab-bar spring config', () => {
    expect(springs.tabPill).toEqual({damping: 22, stiffness: 220});
  });

  it('flips the theme over 300ms with an ease-in-out curve', () => {
    expect(motion.themeFlip.duration).toBe(durations.normal);
    expect(motion.themeFlip.easing).toBe(easings.easeInOut);
  });

  it('describes the onboarding encircle stroke', () => {
    expect(motion.encircle.duration).toBe(1550);
    expect(motion.encircle.strokeWidth).toBe(2.4);
    expect(motion.encircle.easing).toBe(easings.ink);
  });
});
