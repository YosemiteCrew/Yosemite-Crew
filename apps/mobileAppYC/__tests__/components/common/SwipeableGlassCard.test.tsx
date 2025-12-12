import React from 'react';
import {Animated, PanResponder, Text, Image} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import SwipeableGlassCard from '../../../src/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        success: '#28a745',
      },
      borderRadius: {lg: 8},
    },
  }),
}));

// 2. Mock LiquidGlassCard
// Note: We use require inside to avoid the ReferenceError for 'View'
jest.mock(
  '../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View: RNView} = require('react-native');
    return {
      LiquidGlassCard: ({children}: any) => <RNView>{children}</RNView>,
    };
  },
);

// 3. Mock Animated Spring
const mockStart = jest.fn(cb => cb && cb()); // Immediately invoke callback
const mockSpring = jest.spyOn(Animated, 'spring').mockReturnValue({
  start: mockStart,
} as any);

describe('SwipeableGlassCard', () => {
  const mockActionIcon = {uri: 'test-icon'};
  const mockOnAction = jest.fn();
  const mockOnPress = jest.fn();
  // Mock event to satisfy TS types for PanResponder handlers
  const mockEvent = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering
  // ===========================================================================

  it('renders correctly with default props', () => {
    const {getByText} = render(
      <SwipeableGlassCard actionIcon={mockActionIcon}>
        <Text>Card Content</Text>
      </SwipeableGlassCard>,
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('renders custom action content when provided', () => {
    const {getByText} = render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        renderActionContent={close => (
          <Text onPress={close}>Custom Action</Text>
        )}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    expect(getByText('Custom Action')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Interaction (Buttons)
  // ===========================================================================

  it('handles action button press', () => {
    const {UNSAFE_getByType} = render(
      <SwipeableGlassCard actionIcon={mockActionIcon} onAction={mockOnAction}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    // Find the Image component
    const imageInstance = UNSAFE_getByType(Image);

    // The hierarchy in code is TouchableOpacity -> View -> Image
    // So we traverse up to find the touchable parent
    const button = imageInstance.parent?.parent;

    fireEvent.press(button!);

    // Should animate to close (0) and call onAction
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: 0}),
    );
    expect(mockOnAction).toHaveBeenCalled();
  });

  it('handles promise rejection in onAction gracefully', async () => {
    const mockAsyncAction = jest.fn(() => Promise.reject('Error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {UNSAFE_getByType} = render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        onAction={mockAsyncAction}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    const imageInstance = UNSAFE_getByType(Image);
    const button = imageInstance.parent?.parent;
    fireEvent.press(button!);

    // Ensure action was called
    expect(mockAsyncAction).toHaveBeenCalled();

    // Wait for promise rejection handling
    await new Promise(process.nextTick);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SwipeableGlassCard] onAction rejected',
      'Error',
    );
    consoleSpy.mockRestore();
  });

  it('calls custom action close callback', () => {
    const {getByText} = render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        renderActionContent={close => <Text onPress={close}>Close Me</Text>}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    fireEvent.press(getByText('Close Me'));
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: 0}), // animateTo(0)
    );
  });

  // ===========================================================================
  // 3. PanResponder Logic
  // ===========================================================================

  it('handles standard horizontal swipe gestures', () => {
    // Spy on PanResponder.create to capture the config
    const panCreateSpy = jest.spyOn(PanResponder, 'create');

    render(
      <SwipeableGlassCard actionIcon={mockActionIcon}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    const config = panCreateSpy.mock.calls[0][0];

    // 1. Should Set Responder
    expect(config.onStartShouldSetPanResponder!(mockEvent, {} as any)).toBe(
      false,
    );
    expect(
      config.onMoveShouldSetPanResponder!(mockEvent, {dx: 10, dy: 0} as any),
    ).toBe(true); // Horizontal
    expect(
      config.onMoveShouldSetPanResponder!(mockEvent, {dx: 0, dy: 10} as any),
    ).toBe(true); // Vertical allowed by default

    // 2. Handle Move (Clamping logic)
    // actionWidth=70, overlap=12 -> swipeableWidth = 58
    // Clamps between -58 and 0
    config.onPanResponderMove!(mockEvent, {dx: -100, dy: 0} as any); // Should clamp to -58
    config.onPanResponderMove!(mockEvent, {dx: 50, dy: 0} as any); // Should clamp to 0

    // 3. Handle Release (Open)
    // Threshold is -58 / 2 = -29.
    // dx < -29 -> open (-58)
    config.onPanResponderRelease!(mockEvent, {dx: -30, dy: 0} as any);
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: -58}),
    );

    // 4. Handle Release (Close)
    // dx > -29 -> close (0)
    config.onPanResponderRelease!(mockEvent, {dx: -10, dy: 0} as any);
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: 0}),
    );
  });

  it('handles tap gesture within PanResponder (dx/dy small)', () => {
    const panCreateSpy = jest.spyOn(PanResponder, 'create');
    render(
      <SwipeableGlassCard actionIcon={mockActionIcon} onPress={mockOnPress}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const config = panCreateSpy.mock.calls[0][0];

    // Tap detected (dx < 8 && dy < 8)
    config.onPanResponderRelease!(mockEvent, {dx: 2, dy: 2} as any);

    // Should animate to 0 and call onPress
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: 0}),
    );
    expect(mockOnPress).toHaveBeenCalled();
  });

  // ===========================================================================
  // 4. Horizontal-Only Mode Logic
  // ===========================================================================

  it('respects enableHorizontalSwipeOnly constraints', () => {
    const panCreateSpy = jest.spyOn(PanResponder, 'create');
    render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        enableHorizontalSwipeOnly={true}
        onPress={mockOnPress}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const config = panCreateSpy.mock.calls[0][0];

    // 1. Should Set Responder
    // Requires dx > 10 AND dy < 10 (strict horizontal)
    expect(
      config.onMoveShouldSetPanResponder!(mockEvent, {dx: 11, dy: 5} as any),
    ).toBe(true);
    expect(
      config.onMoveShouldSetPanResponder!(mockEvent, {dx: 5, dy: 5} as any),
    ).toBe(false); // dx too small
    expect(
      config.onMoveShouldSetPanResponder!(mockEvent, {dx: 11, dy: 11} as any),
    ).toBe(false); // dy too big

    // 2. Handle Move
    // Case A: Vertical > Horizontal -> return early (no value set)
    config.onPanResponderMove!(mockEvent, {dx: 10, dy: 20} as any);

    // Case B: Horizontal > Vertical -> allow
    config.onPanResponderMove!(mockEvent, {dx: 20, dy: 10} as any);

    // 3. Handle Release Logic

    // Scenario: Mostly vertical, but small (Tap-like)
    config.onPanResponderRelease!(mockEvent, {dx: 2, dy: 7} as any); // dy > dx, but small (<8)
    expect(mockOnPress).toHaveBeenCalled();

    // Scenario: Mostly vertical, large swipe (Scroll) -> Should NOT trigger action or animation open
    mockOnPress.mockClear();
    mockSpring.mockClear();
    config.onPanResponderRelease!(mockEvent, {dx: 10, dy: 50} as any);

    expect(mockOnPress).not.toHaveBeenCalled();
    // It shouldn't animate open or call action
    expect(mockSpring).not.toHaveBeenCalled();

    // Scenario: Mostly horizontal swipe -> Should animate open
    config.onPanResponderRelease!(mockEvent, {dx: -50, dy: 10} as any);
    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({toValue: -58}),
    );
  });

  it('applies spring config overrides', () => {
    const panCreateSpy = jest.spyOn(PanResponder, 'create');
    render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        springConfig={{stiffness: 1000}}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const config = panCreateSpy.mock.calls[0][0];

    // Trigger animation
    config.onPanResponderRelease!(mockEvent, {dx: -100, dy: 0} as any);

    expect(mockSpring).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({stiffness: 1000}),
    );
  });
});
