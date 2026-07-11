import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act, screen} from '@testing-library/react-native';
import {NotificationCard} from '../../../../src/features/notifications/components/NotificationCard/NotificationCard';
// FIX 1 & 2: Removed the unused 'Images' import which was causing the module error.
// FIX 3: Added 'Image' to imports so we can use it in getAllByType
import {Image, Pressable, StyleSheet} from 'react-native';

// react-native's Pressable is wrapped in React.memo; UNSAFE_getAllByType
// must match against the memoized inner component, not the memo wrapper.
const PressableType = (Pressable as any).type;

const mockPanGestures: any[] = [];

const mockCreatePanGesture = () => {
  const handlers: Record<string, any> = {};
  const gesture: Record<string, any> = {handlers};
  [
    'enabled',
    'activeOffsetX',
    'onStart',
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

// 1. Mock Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock Image Utils
jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn(uri => (uri ? `normalized-${uri}` : null)),
}));

// 3. Mock Typography
jest.mock('@/theme/typography', () => ({
  fonts: {
    SATOSHI_BOLD: 'Satoshi-Bold',
  },
}));

// 4. Mock LiquidGlassCard
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children, ...props}: any) => {
    const {View} = require('react-native');
    return (
      <View testID="liquid-glass-card" {...props}>
        {children}
      </View>
    );
  },
}));

// 5. Mock Images with a Proxy to simulate errors
jest.mock('@/assets/images', () => {
  const actualImages = {
    notificationIcon: {uri: 'default-icon-uri'},
    taskIcon: {uri: 'task-icon-uri'},
  };

  return {
    Images: new Proxy(actualImages, {
      get(target, prop) {
        if (prop === 'crash_me') {
          throw new Error('Mock crash');
        }
        return target[prop as keyof typeof target];
      },
    }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const {View} = require('react-native');
  return {
    GestureDetector: ({children, gesture}: any) => (
      <View testID="SWIPE_GESTURE_DETECTOR" gesture={gesture}>
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
    withSpring: (value: any) => value,
    withTiming: (value: any, _config: any, callback?: any) => {
      callback?.(true);
      return value;
    },
  };
});

// --- Test Data ---
const baseNotification = {
  id: '1',
  title: 'Test Notification',
  description: 'Test Description',
  timestamp: new Date().toISOString(),
  icon: 'taskIcon',
  status: 'unread' as const,
  companionId: 'comp-1',
  avatarUrl: 'avatar.png',
};

const SCREEN_WIDTH = 750;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

describe('NotificationCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const getPanGesture = () => mockPanGestures[mockPanGestures.length - 1];

  const triggerGestureHandler = (handlerName: string, event = {}) => {
    const gesture = getPanGesture();
    act(() => {
      if (gesture[handlerName]) {
        gesture[handlerName](event);
      }
    });
  };

  describe('Rendering Logic', () => {
    it('renders title and description correctly', () => {
      render(<NotificationCard notification={baseNotification as any} />);
      expect(screen.getByText('Test Notification')).toBeTruthy();
      expect(screen.getByText('Test Description')).toBeTruthy();
    });

    it('renders without description (branch coverage)', () => {
      const noDesc = {...baseNotification, description: undefined};
      render(<NotificationCard notification={noDesc as any} />);
      expect(screen.getByText('Test Notification')).toBeTruthy();
      expect(screen.queryByText('Test Description')).toBeNull();
    });

    it('renders companion avatar image when available', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          companion={{name: 'Buddy', profileImage: 'buddy.jpg'}}
        />,
      );
      // FIX 3: Pass the 'Image' component itself, not the string 'Image'
      const images = screen.UNSAFE_getAllByType(Image);
      expect(images.length).toBe(2);
    });

    it('renders avatar fallback with initial when image is missing', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          companion={{name: 'Buddy'}}
        />,
      );
      expect(screen.getByText('B')).toBeTruthy();
    });

    it('renders default "P" initial if companion name is missing', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          companion={{name: ''}}
        />,
      );
      expect(screen.getByText('P')).toBeTruthy();
    });

    it('uses default icon if the icon key provided causes an error (catch block)', () => {
      const crashNotif = {...baseNotification, icon: 'crash_me' as any};
      render(<NotificationCard notification={crashNotif as any} />);

      // FIX 3: Pass the 'Image' component itself, not the string 'Image'
      const images = screen.UNSAFE_getAllByType(Image);
      expect(images[0].props.source.uri).toBe('default-icon-uri');
    });

    it.each([
      ['health', mockTheme.colors.successSurface],
      ['appointments', mockTheme.colors.indigoSurface],
      ['messages', mockTheme.colors.blueSoft],
      ['dietary', mockTheme.colors.warningSurface],
    ] as const)('tints the icon tile for the %s category', (category, bg) => {
      render(
        <NotificationCard
          notification={{...baseNotification, category} as any}
        />,
      );
      const iconTile = screen.UNSAFE_getAllByType(Image)[0].parent;
      const tileStyle = StyleSheet.flatten(iconTile?.props.style);
      expect(tileStyle.backgroundColor).toBe(bg);
    });

    it('falls back to the neutral tile when the category is unknown', () => {
      render(<NotificationCard notification={baseNotification as any} />);
      const iconTile = screen.UNSAFE_getAllByType(Image)[0].parent;
      const tileStyle = StyleSheet.flatten(iconTile?.props.style);
      expect(tileStyle.backgroundColor).toBe(mockTheme.colors.screen2);
    });

    it('applies the read title style when the notification is already read', () => {
      const readNotif = {...baseNotification, status: 'read' as const};
      render(<NotificationCard notification={readNotif as any} />);
      const titleStyle = StyleSheet.flatten(
        screen.getByText('Test Notification').props.style,
      );
      // Read notifications use titleRead (fontWeight 600), not the bold
      // titleUnread variant (Satoshi-Bold / fontWeight 700).
      expect(titleStyle.fontWeight).toBe('600');
      expect(titleStyle.fontFamily).not.toBe('Satoshi-Bold');
    });
  });

  describe('Time Formatting Logic', () => {
    const renderWithTime = (isoString: string) => {
      render(
        <NotificationCard
          notification={{...baseNotification, timestamp: isoString} as any}
        />,
      );
    };

    it('displays "now" for < 1 minute', () => {
      renderWithTime(new Date('2025-01-01T11:59:30Z').toISOString());
      expect(screen.getByText('now')).toBeTruthy();
    });

    it('displays "Xm ago" for < 1 hour', () => {
      renderWithTime(new Date('2025-01-01T11:50:00Z').toISOString());
      expect(screen.getByText('10m ago')).toBeTruthy();
    });

    it('displays "Xh ago" for < 24 hours', () => {
      renderWithTime(new Date('2025-01-01T07:00:00Z').toISOString());
      expect(screen.getByText('5h ago')).toBeTruthy();
    });

    it('displays "Xd ago" for < 7 days', () => {
      renderWithTime(new Date('2024-12-29T12:00:00Z').toISOString());
      expect(screen.getByText('3d ago')).toBeTruthy();
    });

    it('displays formatted date for >= 7 days', () => {
      renderWithTime(new Date('2024-12-22T12:00:00Z').toISOString());
      expect(screen.getByText('Dec 22, 2024')).toBeTruthy();
    });
  });

  describe('Interactions & Gestures', () => {
    it('calls onPress when the touchable area is pressed', () => {
      const onPress = jest.fn();
      render(
        <NotificationCard
          notification={baseNotification as any}
          onPress={onPress}
        />,
      );

      const card = screen.getByTestId('liquid-glass-card');
      fireEvent.press(card.parent!);
      expect(onPress).toHaveBeenCalled();
    });

    it('swipeEnabled prop defaults to true if not provided', () => {
      render(<NotificationCard notification={baseNotification as any} />);
      expect(getPanGesture().enabled).toBe(true);
      expect(getPanGesture().activeOffsetX).toEqual([-5, 5]);
    });

    it('disables pan gesture when swipeEnabled is false', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          swipeEnabled={false}
        />,
      );
      expect(getPanGesture().enabled).toBe(false);
    });

    it('sets dragging state on gesture start', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          onPress={jest.fn()}
        />,
      );
      triggerGestureHandler('onStart');

      const [touchable] = screen.UNSAFE_getAllByType(PressableType);
      expect(touchable.props.disabled).toBe(true);
    });

    it('clears dragging state on gesture finalize', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          onPress={jest.fn()}
        />,
      );

      triggerGestureHandler('onStart');
      triggerGestureHandler('onFinalize');

      const [touchable] = screen.UNSAFE_getAllByType(PressableType);
      const disabledState = touchable.props.disabled;
      expect(!!disabledState).toBe(false);
    });

    it('swipes right (positive DX) triggers onDismiss', () => {
      const onDismiss = jest.fn();
      render(
        <NotificationCard
          notification={baseNotification as any}
          onDismiss={onDismiss}
        />,
      );

      triggerGestureHandler('onEnd', {translationX: SWIPE_THRESHOLD + 10});
      expect(onDismiss).toHaveBeenCalled();
    });

    it('swipes left (negative DX) triggers onArchive', () => {
      const onArchive = jest.fn();
      render(
        <NotificationCard
          notification={baseNotification as any}
          onArchive={onArchive}
        />,
      );

      triggerGestureHandler('onEnd', {
        translationX: -(SWIPE_THRESHOLD + 10),
      });

      expect(onArchive).toHaveBeenCalled();
    });

    it('snaps back if swipe threshold is not met', () => {
      const onDismiss = jest.fn();
      const onArchive = jest.fn();
      render(
        <NotificationCard
          notification={baseNotification as any}
          onDismiss={onDismiss}
          onArchive={onArchive}
        />,
      );

      triggerGestureHandler('onStart');
      triggerGestureHandler('onUpdate', {translationX: 10});
      triggerGestureHandler('onEnd', {translationX: 10});

      expect(onDismiss).not.toHaveBeenCalled();
      expect(onArchive).not.toHaveBeenCalled();
    });

    it('does nothing on release if swipeEnabled is false', () => {
      const onDismiss = jest.fn();
      render(
        <NotificationCard
          notification={baseNotification as any}
          onDismiss={onDismiss}
          swipeEnabled={false}
        />,
      );

      expect(getPanGesture().enabled).toBe(false);
    });

    it('swipes left past threshold without an onArchive handler and does not throw', () => {
      render(<NotificationCard notification={baseNotification as any} />);

      expect(() =>
        triggerGestureHandler('onEnd', {
          translationX: -(SWIPE_THRESHOLD + 10),
        }),
      ).not.toThrow();
    });

    it('swipes right past threshold without an onDismiss handler and does not throw', () => {
      render(<NotificationCard notification={baseNotification as any} />);

      expect(() =>
        triggerGestureHandler('onEnd', {translationX: SWIPE_THRESHOLD + 10}),
      ).not.toThrow();
    });
  });
});
