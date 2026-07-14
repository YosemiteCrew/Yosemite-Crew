import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {SkeletonList} from '@/shared/components/common/Skeleton/SkeletonList';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Control the reduced-motion flag SkeletonList reads from its internal hook.
let mockReduceMotion = false;
jest.mock('@/shared/components/common/Skeleton/useReducedMotion', () => ({
  useReducedMotion: () => mockReduceMotion,
}));

// Replace the animated block with an inert, prop-capturing stub. This keeps the
// suite focused on SkeletonList's layout/branch logic (no Animated timers) while
// letting us assert exactly which blocks are rendered and with what props.
const mockBlockProps: Array<Record<string, unknown>> = [];
jest.mock('@/shared/components/common/Skeleton/SkeletonBlock', () => ({
  SkeletonBlock: (props: Record<string, unknown>) => {
    mockBlockProps.push(props);
    const {View} = require('react-native');
    return require('react').createElement(View, {testID: 'skeleton-block'});
  },
}));

// Walk a react-test-renderer JSON tree and collect every explicit `opacity`
// found on a node's flattened style. Only the row cards set an inline opacity
// (the dimming), so this yields the per-row dim values in render order.
const collectOpacities = (node: unknown, acc: number[] = []): number[] => {
  if (Array.isArray(node)) {
    node.forEach(child => collectOpacities(child, acc));
    return acc;
  }
  if (node && typeof node === 'object') {
    const {props, children} = node as {
      props?: {style?: unknown};
      children?: unknown;
    };
    const flat = (StyleSheet.flatten(props?.style) ?? {}) as {opacity?: number};
    if (typeof flat.opacity === 'number') {
      acc.push(flat.opacity);
    }
    collectOpacities(children, acc);
  }
  return acc;
};

describe('SkeletonList', () => {
  beforeEach(() => {
    mockBlockProps.length = 0;
    mockReduceMotion = false;
  });

  it('renders the header, filter row and five rows by default', () => {
    const {getAllByTestId} = render(<SkeletonList />);

    // 2 header blocks + 3 filter chips + 5 rows * 3 blocks each = 20.
    expect(getAllByTestId('skeleton-block')).toHaveLength(20);

    // Header: a wide title bar and a round action placeholder.
    const title = mockBlockProps.find(p => p.width === 168);
    expect(title).toMatchObject({height: 28, radius: 9, delay: 80});
    const action = mockBlockProps.find(
      p => p.width === 42 && p.height === 42 && p.delay === 140,
    );
    expect(action).toMatchObject({radius: mockTheme.borderRadius.chip});

    // Filter chips fan out on the staggered delays.
    const filters = mockBlockProps.filter(p => p.width === 84);
    expect(filters.map(p => p.delay)).toEqual([0, 120, 240]);
    filters.forEach(f =>
      expect(f).toMatchObject({
        height: 34,
        radius: mockTheme.borderRadius.chip,
      }),
    );

    // Each row has the two-line text placeholders.
    expect(mockBlockProps.some(p => p.width === '70%')).toBe(true);
    expect(mockBlockProps.some(p => p.width === '45%')).toBe(true);
  });

  it('dims the last two rows and keeps the rest at full opacity', () => {
    const {toJSON} = render(<SkeletonList />);

    // rows 0-2 full, row 3 second-last (0.7), row 4 last (0.4).
    expect(collectOpacities(toJSON())).toEqual([1, 1, 1, 0.7, 0.4]);
  });

  it('forwards the reduced-motion flag to every block', () => {
    mockReduceMotion = true;
    render(<SkeletonList />);

    expect(mockBlockProps.length).toBeGreaterThan(0);
    expect(mockBlockProps.every(p => p.reduceMotion === true)).toBe(true);
  });

  it('hides the title row when showHeader is false', () => {
    const {getAllByTestId} = render(<SkeletonList showHeader={false} />);

    // 0 header + 3 filters + 15 row blocks.
    expect(getAllByTestId('skeleton-block')).toHaveLength(18);
    expect(mockBlockProps.some(p => p.width === 168)).toBe(false);
  });

  it('hides the filter row when showFilters is false', () => {
    const {getAllByTestId} = render(<SkeletonList showFilters={false} />);

    // 2 header + 0 filters + 15 row blocks.
    expect(getAllByTestId('skeleton-block')).toHaveLength(17);
    expect(mockBlockProps.filter(p => p.width === 84)).toHaveLength(0);
  });

  it('renders only the rows when both header and filters are hidden', () => {
    const {getAllByTestId} = render(
      <SkeletonList showHeader={false} showFilters={false} />,
    );

    expect(getAllByTestId('skeleton-block')).toHaveLength(15);
    expect(mockBlockProps.some(p => p.width === 168)).toBe(false);
    expect(mockBlockProps.some(p => p.width === 84)).toBe(false);
  });

  it('honours a custom row count with staggered avatar delays and dimming', () => {
    const {getAllByTestId, toJSON} = render(<SkeletonList rows={3} />);

    // 2 header + 3 filters + 3 rows * 3 blocks each = 14.
    expect(getAllByTestId('skeleton-block')).toHaveLength(14);

    // Row avatars are the width-42, radius-13 blocks; delay = 80 + index * 80.
    const avatarDelays = mockBlockProps
      .filter(p => p.width === 42 && p.radius === 13)
      .map(p => p.delay);
    expect(avatarDelays).toEqual([80, 160, 240]);

    // full, second-last, last.
    expect(collectOpacities(toJSON())).toEqual([1, 0.7, 0.4]);
  });

  it('dims the single row as the last row when rows is one', () => {
    const {getAllByTestId, toJSON} = render(
      <SkeletonList rows={1} showHeader={false} showFilters={false} />,
    );

    expect(getAllByTestId('skeleton-block')).toHaveLength(3);
    expect(collectOpacities(toJSON())).toEqual([0.4]);
  });

  it('renders the header and filters but no rows when rows is zero', () => {
    const {getAllByTestId, toJSON} = render(<SkeletonList rows={0} />);

    expect(getAllByTestId('skeleton-block')).toHaveLength(5);
    expect(collectOpacities(toJSON())).toEqual([]);
  });

  it('merges a custom container style and applies the testID', () => {
    const {getByTestId} = render(
      <SkeletonList testID="skeleton-list" style={{margin: 10}} />,
    );

    const container = getByTestId('skeleton-list');
    const flat = StyleSheet.flatten(container.props.style) as {
      margin?: number;
      flex?: number;
      backgroundColor?: string;
    };
    expect(flat.margin).toBe(10);
    expect(flat.flex).toBe(1);
    expect(flat.backgroundColor).toBe(mockTheme.colors.background);
  });

  it('announces itself to screen readers as a busy loading region', () => {
    const {getByTestId} = render(<SkeletonList testID="skeleton-list" />);

    const container = getByTestId('skeleton-list');
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityRole).toBe('progressbar');
    expect(container.props.accessibilityLabel).toBe('Loading');
    expect(container.props.accessibilityState).toEqual({busy: true});
  });
});
