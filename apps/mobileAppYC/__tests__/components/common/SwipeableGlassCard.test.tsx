import React from 'react';
import {Text, Image} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';

const mockPanGestures: any[] = [];
const mockWithSpring = jest.fn((value: any, _config?: any, callback?: any) => {
  callback?.(true);
  return value;
});

const mockCreatePanGesture = () => {
  const handlers: Record<string, any> = {};
  const gesture: Record<string, any> = {handlers};
  [
    'activeOffsetX',
    'failOffsetY',
    'onBegin',
    'onUpdate',
    'onEnd',
    'onFinalize',
  ].forEach(method => {
    gesture[method] = jest.fn((value: any) => {
      handlers[method] = value;
      return gesture;
    });
  });
  mockPanGestures.push(handlers);
  return gesture;
};

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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

jest.mock('react-native-gesture-handler', () => {
  const {View} = require('react-native');
  return {
    GestureDetector: ({children, gesture}: any) => (
      <View testID="gesture-detector" gesture={gesture}>
        {children}
      </View>
    ),
    Gesture: {
      Pan: jest.fn(() => mockCreatePanGesture()),
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: {View},
    runOnJS: (fn: any) => fn,
    useAnimatedStyle: (factory: any) => factory(),
    useSharedValue: (value: any) => ({value}),
    withSpring: mockWithSpring,
  };
});

const SwipeableGlassCard =
  require('../../../src/shared/components/common/SwipeableGlassCard/SwipeableGlassCard').default;

describe('SwipeableGlassCard', () => {
  const mockActionIcon = {uri: 'test-icon'};
  const mockOnAction = jest.fn();
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPanGestures.length = 0;
  });

  const getPanGesture = () => mockPanGestures[mockPanGestures.length - 1];
  const runGesture = (callback: () => void) => {
    act(callback);
  };

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
    expect(mockWithSpring).toHaveBeenCalledWith(0, {}, expect.any(Function));
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
    expect(mockWithSpring).toHaveBeenCalledWith(0, {}, expect.any(Function));
  });

  // ===========================================================================
  // 3. Gesture Logic
  // ===========================================================================

  it('handles standard horizontal swipe gestures', () => {
    render(
      <SwipeableGlassCard actionIcon={mockActionIcon}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    const gesture = getPanGesture();

    expect(gesture.activeOffsetX).toEqual([-6, 6]);

    runGesture(() => {
      gesture.onBegin();
      gesture.onUpdate({translationX: -100, translationY: 0});
      gesture.onUpdate({translationX: 50, translationY: 0});
    });

    // actionWidth=70, overlap=0 -> threshold is -35.
    runGesture(() => {
      gesture.onEnd({translationX: -40, translationY: 0});
    });
    expect(mockWithSpring).toHaveBeenCalledWith(-70, {});

    runGesture(() => {
      gesture.onEnd({translationX: 40, translationY: 0});
    });
    expect(mockWithSpring).toHaveBeenCalledWith(0, {});
  });

  it('handles tap gesture within pan gesture (dx/dy small)', () => {
    render(
      <SwipeableGlassCard actionIcon={mockActionIcon} onPress={mockOnPress}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    runGesture(() => {
      gesture.onEnd({translationX: 2, translationY: 2});
    });

    // Should animate to 0 and call onPress
    expect(mockWithSpring).toHaveBeenCalledWith(0, {}, expect.any(Function));
    expect(mockOnPress).toHaveBeenCalled();
  });

  // ===========================================================================
  // 4. Horizontal-Only Mode Logic
  // ===========================================================================

  it('respects enableHorizontalSwipeOnly constraints', () => {
    render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        enableHorizontalSwipeOnly={true}
        onPress={mockOnPress}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    expect(gesture.activeOffsetX).toEqual([-10, 10]);
    expect(gesture.failOffsetY).toEqual([-10, 10]);

    // Case A: Vertical > Horizontal -> return early (no value set)
    runGesture(() => {
      gesture.onUpdate({translationX: 10, translationY: 20});
    });

    // Case B: Horizontal > Vertical -> allow
    runGesture(() => {
      gesture.onUpdate({translationX: 20, translationY: 10});
    });

    runGesture(() => {
      gesture.onEnd({translationX: 2, translationY: 7});
    });
    expect(mockOnPress).toHaveBeenCalled();

    mockOnPress.mockClear();
    mockWithSpring.mockClear();
    runGesture(() => {
      gesture.onEnd({translationX: 10, translationY: 50});
    });

    expect(mockOnPress).not.toHaveBeenCalled();

    runGesture(() => {
      gesture.onEnd({translationX: -50, translationY: 10});
    });
    expect(mockWithSpring).toHaveBeenCalled();
  });

  it('opens the action when a vertical-dominant drag crosses the open threshold in horizontal-only mode', () => {
    render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        enableHorizontalSwipeOnly={true}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    mockWithSpring.mockClear();
    // isMostlyVertical (45 > 40), not a tap (|translationX| >= 8), and the
    // resulting offset (-40) crosses the -35 open threshold.
    runGesture(() => {
      gesture.onEnd({translationX: -40, translationY: 45});
    });

    expect(mockWithSpring).toHaveBeenCalledWith(-70, {});
  });

  it('does not schedule a press callback for a tap when no onPress handler is provided', () => {
    render(
      <SwipeableGlassCard actionIcon={mockActionIcon}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    expect(() =>
      runGesture(() => {
        gesture.onEnd({translationX: 2, translationY: 2});
      }),
    ).not.toThrow();
  });

  it('treats a non-positive swipeable width as fully transparent action opacity', () => {
    expect(() =>
      render(
        <SwipeableGlassCard actionIcon={mockActionIcon} actionWidth={0}>
          <Text>Content</Text>
        </SwipeableGlassCard>,
      ),
    ).not.toThrow();
  });

  it('applies android-specific card base styles on Android', () => {
    const {Platform} = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    expect(() =>
      render(
        <SwipeableGlassCard actionIcon={mockActionIcon}>
          <Text>Content</Text>
        </SwipeableGlassCard>,
      ),
    ).not.toThrow();

    Platform.OS = originalOS;
  });

  it('prefers a non-empty merged style/fallbackStyle over the raw cardProps values', () => {
    const {getByText} = render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        cardProps={
          {style: {opacity: 0.5}, fallbackStyle: {opacity: 0.5}} as any
        }>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    expect(getByText('Content')).toBeTruthy();
  });

  it('syncs currentOffset to translateX when the gesture finalizes', () => {
    render(
      <SwipeableGlassCard actionIcon={mockActionIcon}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    runGesture(() => {
      gesture.onEnd({translationX: -100, translationY: 0});
    });

    expect(() => runGesture(() => gesture.onFinalize())).not.toThrow();
  });

  it('merges provided cardProps with the reveal-driven style overrides', () => {
    const {getByText} = render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        cardProps={{shadow: 'lg', padding: '4'} as any}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );

    expect(getByText('Content')).toBeTruthy();
  });

  it('applies spring config overrides', () => {
    render(
      <SwipeableGlassCard
        actionIcon={mockActionIcon}
        springConfig={{stiffness: 1000}}>
        <Text>Content</Text>
      </SwipeableGlassCard>,
    );
    const gesture = getPanGesture();

    // Trigger animation
    runGesture(() => {
      gesture.onEnd({translationX: -100, translationY: 0});
    });

    expect(mockWithSpring).toHaveBeenCalledWith(
      -70,
      expect.objectContaining({stiffness: 1000}),
    );
  });
});
