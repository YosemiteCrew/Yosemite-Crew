import React from 'react';
import {render, fireEvent, act, screen} from '@testing-library/react-native';
import {NotificationCard} from '../../../../src/features/notifications/components/NotificationCard/NotificationCard';
// FIX 1 & 2: Removed the unused 'Images' import which was causing the module error.
// FIX 3: Added 'Image' to imports so we can use it in getAllByType
import {PanResponder, Animated, Image} from 'react-native';

// --- Mocks ---

// 1. Mock Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: 'mock-border',
        cardBackground: 'mock-card-bg',
        text: 'mock-text',
      },
      spacing: {1: 4, 3: 12},
      borderRadius: {lg: 8},
      typography: {
        titleSmall: {fontSize: 16},
        bodyExtraSmall: {fontSize: 12},
        labelSmallBold: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
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

// 6. Setup PanResponder and Animated Spies
beforeAll(() => {
  jest.spyOn(PanResponder, 'create').mockImplementation((config: any) => ({
    panHandlers: {
      onStartShouldSetResponder: config.onStartShouldSetPanResponder,
      onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
      onResponderGrant: config.onPanResponderGrant,
      onResponderMove: config.onPanResponderMove,
      onResponderRelease: config.onPanResponderRelease,
      testID: 'SWIPE_ANIMATED_VIEW',
    },
  }));

  // @ts-ignore
  jest.spyOn(Animated, 'event').mockImplementation(() => jest.fn());

  jest
    .spyOn(Animated, 'timing')
    .mockImplementation((value: any, config: any) => {
      return {
        start: (callback?: any) => {
          if (typeof config.toValue === 'number') {
            value.setValue(config.toValue);
          }
          if (callback) callback({finished: true});
        },
        stop: jest.fn(),
        reset: jest.fn(),
      };
    });

  jest
    .spyOn(Animated, 'spring')
    .mockImplementation((value: any, config: any) => {
      return {
        start: (callback?: any) => {
          if (config.toValue && typeof config.toValue === 'object') {
            value.setValue(config.toValue);
          }
          if (callback) callback({finished: true});
        },
        stop: jest.fn(),
        reset: jest.fn(),
      };
    });
});

afterAll(() => {
  jest.restoreAllMocks();
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

  const getSwipeableView = () => screen.getByTestId('SWIPE_ANIMATED_VIEW');

  const triggerPanHandler = (
    handlerName: string,
    evt = {},
    gestureState = {},
  ) => {
    const view = getSwipeableView();
    act(() => {
      if (view.props[handlerName]) {
        view.props[handlerName](evt, gestureState);
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
      const view = getSwipeableView();
      expect(view.props.onStartShouldSetResponder()).toBe(true);
    });

    it('disables pan responder when swipeEnabled is false', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          swipeEnabled={false}
        />,
      );
      const view = getSwipeableView();
      expect(view.props.onStartShouldSetResponder()).toBe(false);
    });

    it('returns false for onMoveShouldSetPanResponder if swipeEnabled is false', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          swipeEnabled={false}
        />,
      );
      const view = getSwipeableView();
      expect(view.props.onMoveShouldSetResponder({}, {dx: 10})).toBe(false);
    });

    it('determines move responder based on DX threshold', () => {
      render(<NotificationCard notification={baseNotification as any} />);
      const view = getSwipeableView();

      expect(view.props.onMoveShouldSetResponder({}, {dx: 2})).toBe(false);
      expect(view.props.onMoveShouldSetResponder({}, {dx: 6})).toBe(true);
    });

    it('sets dragging state on Grant (disabling the Touchable)', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          onPress={jest.fn()}
        />,
      );
      triggerPanHandler('onResponderGrant');
    });

    it('does NOT set dragging state on Grant if swipeEnabled is false', () => {
      render(
        <NotificationCard
          notification={baseNotification as any}
          onPress={jest.fn()}
          swipeEnabled={false}
        />,
      );

      triggerPanHandler('onResponderGrant');

      const card = screen.getByTestId('liquid-glass-card');
      const disabledState = card.parent!.props.accessibilityState?.disabled;
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

      triggerPanHandler('onResponderRelease', {}, {dx: SWIPE_THRESHOLD + 10});
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

      triggerPanHandler(
        'onResponderRelease',
        {},
        {dx: -(SWIPE_THRESHOLD + 10)},
      );

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

      triggerPanHandler('onResponderGrant');
      triggerPanHandler('onResponderRelease', {}, {dx: 10});

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

      triggerPanHandler('onResponderRelease', {}, {dx: 500});
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
