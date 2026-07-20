import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import {mockTheme} from '../setup/mockTheme';
import {
  ChatTypingIndicator,
  default as ChatTypingIndicatorDefault,
} from '@/features/chat/components/ChatTypingIndicator';

// Mock the theme hook with the shared warm-bone mock theme.
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// react-native-reanimated is globally mocked in jest.setup.js
// (useReducedMotion -> false, withRepeat/withDelay/withTiming pass-through).
// We spy on that shared module namespace to exercise both motion branches.

/**
 * Recursively collect JSON nodes that carry a matching testID.
 */
const findByTestID = (node: any, testID: string): any | null => {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (node.props?.testID === testID) {
    return node;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = findByTestID(child, testID);
    if (found) {
      return found;
    }
  }
  return null;
};

describe('ChatTypingIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the receiver-side typing bubble with accessibility metadata', () => {
    const {getByTestId, getByLabelText} = render(<ChatTypingIndicator />);

    const bubble = getByTestId('typing-indicator');
    expect(bubble).toBeTruthy();
    expect(bubble.props.accessibilityLabel).toBe('typing');
    expect(bubble.props.accessible).toBe(true);
    // The a11y label is reachable via label query too.
    expect(getByLabelText('typing')).toBeTruthy();
  });

  it('wraps the bubble in a non-interactive container (pointerEvents none)', () => {
    const tree = render(<ChatTypingIndicator />).toJSON() as any;

    // The outermost node is the wrapper View.
    expect(tree.props.pointerEvents).toBe('none');
    // Its single child is the typing bubble.
    expect(Array.isArray(tree.children)).toBe(true);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].props.testID).toBe('typing-indicator');
  });

  it('renders exactly three dots tinted with the inkFaint token', () => {
    const tree = render(<ChatTypingIndicator />).toJSON() as any;
    const bubble = findByTestID(tree, 'typing-indicator');

    expect(bubble).toBeTruthy();
    expect(bubble.children).toHaveLength(3);

    bubble.children.forEach((dot: any) => {
      const flat = StyleSheet.flatten(dot.props.style) as any;
      expect(flat.backgroundColor).toBe(mockTheme.colors.inkFaint);
      expect(flat.width).toBe(7);
      expect(flat.height).toBe(7);
      expect(flat.borderRadius).toBe(3.5);
    });
  });

  it('starts the bounce loop for every dot when reduce-motion is off', () => {
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');

    const tree = render(<ChatTypingIndicator />).toJSON() as any;
    const bubble = findByTestID(tree, 'typing-indicator');

    // One repeating animation kicked off per dot.
    expect(repeatSpy).toHaveBeenCalledTimes(3);

    // The animated style uses the interpolated (non-static) opacity branch.
    bubble.children.forEach((dot: any) => {
      const flat = StyleSheet.flatten(dot.props.style) as any;
      // 0.35 + 0.65 * progress(0) at first render -> 0.35, i.e. NOT the
      // reduced-motion static value of 1.
      expect(flat.opacity).toBeCloseTo(0.35);
      expect(flat.transform).toHaveLength(1);
      expect(flat.transform[0].translateY).toBeCloseTo(0);
    });
  });

  it('honours reduce-motion: static dots and no bounce loop', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const repeatSpy = jest.spyOn(Reanimated, 'withRepeat');

    const tree = render(<ChatTypingIndicator />).toJSON() as any;
    const bubble = findByTestID(tree, 'typing-indicator');

    // Effect bails out before scheduling any repeating animation.
    expect(repeatSpy).not.toHaveBeenCalled();

    // Still renders three dots, but with the fully-opaque static style.
    expect(bubble.children).toHaveLength(3);
    bubble.children.forEach((dot: any) => {
      const flat = StyleSheet.flatten(dot.props.style) as any;
      expect(flat.opacity).toBe(1);
      expect(flat.transform).toHaveLength(1);
      expect(flat.transform[0].translateY).toBe(0);
    });
  });

  it('exposes the component as both a named and default export', () => {
    expect(ChatTypingIndicatorDefault).toBe(ChatTypingIndicator);
  });
});
