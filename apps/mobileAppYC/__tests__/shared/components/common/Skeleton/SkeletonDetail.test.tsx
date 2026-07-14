import React from 'react';
import {StyleSheet, View} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {SkeletonDetail} from '@/shared/components/common/Skeleton/SkeletonDetail';

// --- Mocks ---

// 1. Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Reduced-motion hook — controllable so we can assert forwarding.
let mockReduceMotion = false;
jest.mock('@/shared/components/common/Skeleton/useReducedMotion', () => ({
  useReducedMotion: () => mockReduceMotion,
}));

// 3. SkeletonBlock — swap for a countable, inspectable stub. Encodes the props
// SkeletonDetail passes (delay + reduceMotion) so we can assert forwarding, and
// exposes its own style so wrapper-driven props stay observable.
jest.mock('@/shared/components/common/Skeleton/SkeletonBlock', () => ({
  SkeletonBlock: ({delay, reduceMotion, style}: any) => {
    const {View: MockView} = require('react-native');
    return (
      <MockView
        testID="skeleton-block"
        accessibilityLabel={`sk-${delay}`}
        accessibilityState={{disabled: !!reduceMotion}}
        style={style}
      />
    );
  },
}));

const countBlocks = () => screen.getAllByTestId('skeleton-block').length;
const bottomCtaWrappers = () => screen.queryAllByTestId('skeleton-bottom-cta');

describe('SkeletonDetail', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    jest.clearAllMocks();
  });

  it('renders the hero card, secondary section and bottom CTA with defaults', () => {
    render(<SkeletonDetail testID="skeleton-detail" />);

    // Container is present under the provided testID.
    expect(screen.getByTestId('skeleton-detail')).toBeTruthy();

    // 9 hero blocks + 1 secondary section title + 2 default secondary rows +
    // 1 bottom CTA = 13.
    expect(countBlocks()).toBe(13);

    // The pinned bottom CTA placeholder reserves space and is non-interactive.
    expect(bottomCtaWrappers()).toHaveLength(1);
  });

  it('omits the bottom CTA placeholder when showBottomCta is false', () => {
    render(<SkeletonDetail showBottomCta={false} />);

    // One fewer block than the default (no CTA), and no reserved wrapper.
    expect(countBlocks()).toBe(12);
    expect(bottomCtaWrappers()).toHaveLength(0);
  });

  it('renders the requested number of secondary rows', () => {
    render(<SkeletonDetail secondaryRows={4} />);

    // 9 hero + 1 section title + 4 rows + 1 CTA = 15.
    expect(countBlocks()).toBe(15);
  });

  it('renders no secondary row blocks when secondaryRows is zero', () => {
    render(<SkeletonDetail secondaryRows={0} />);

    // 9 hero + 1 section title + 0 rows + 1 CTA = 11.
    expect(countBlocks()).toBe(11);
  });

  it('dims every secondary row after the first', () => {
    render(<SkeletonDetail secondaryRows={3} showBottomCta={false} />);

    // The secondary row wrappers carry the dim style for index > 0 only, so
    // exactly one wrapper per row after the first is dimmed (2 of 3 here).
    const dimmed = screen
      .UNSAFE_getAllByType(View)
      .filter(node => StyleSheet.flatten(node.props.style)?.opacity === 0.7);
    expect(dimmed).toHaveLength(2);
  });

  it('merges a custom container style with the base container style', () => {
    const customStyle = {marginTop: 99};
    render(<SkeletonDetail testID="styled" style={customStyle} />);

    const container = screen.getByTestId('styled');
    const styleArr = Array.isArray(container.props.style)
      ? container.props.style
      : [container.props.style];
    expect(styleArr).toContain(customStyle);
  });

  it('forwards the reduced-motion setting to every skeleton block', () => {
    mockReduceMotion = true;
    render(<SkeletonDetail testID="reduced" />);

    const blocks = screen.getAllByTestId('skeleton-block');
    expect(blocks.length).toBeGreaterThan(0);
    expect(
      blocks.every(block => block.props.accessibilityState.disabled === true),
    ).toBe(true);
  });

  it('keeps skeleton blocks animated when reduced motion is off', () => {
    render(<SkeletonDetail testID="animated" />);

    const blocks = screen.getAllByTestId('skeleton-block');
    expect(
      blocks.every(block => block.props.accessibilityState.disabled === false),
    ).toBe(true);
  });

  it('announces itself to screen readers as a busy loading region', () => {
    render(<SkeletonDetail testID="skeleton-detail" />);

    const container = screen.getByTestId('skeleton-detail');
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityRole).toBe('progressbar');
    expect(container.props.accessibilityLabel).toBe('Loading');
    expect(container.props.accessibilityState).toEqual({busy: true});
  });
});
