import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AppointmentCard} from '../../../src/shared/components/common/AppointmentCard/AppointmentCard';
import {Image} from 'react-native';

// --- Mocks ---

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    cat: {uri: 'cat-fallback-png'},
    viewIconSlide: {uri: 'view-icon-slide-png'},
  },
}));

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        success: '#00FF00',
        secondary: '#000000',
        cardBackground: '#FFFFFF',
        borderMuted: '#CCCCCC',
        neutralShadow: '#000000',
        primarySurface: '#F0F0F0',
        white: '#FFFFFF',
        placeholder: '#888888',
        primary: 'blue',
      },
      spacing: {
        1: 4,
        2: 8,
        3: 12,
        4: 16,
      },
      borderRadius: {
        lg: 12,
      },
      typography: {
        titleMedium: {fontSize: 16},
        labelXsBold: {fontSize: 12},
        businessTitle16: {fontSize: 16},
        paragraphBold: {fontWeight: 'bold'},
      },
      shadows: {
        md: {},
      },
    },
  }),
}));

// Mock resolveImageSource utility
jest.mock('@/shared/utils/resolveImageSource', () => ({
  resolveImageSource: (source: any) => source,
}));

// Mock isDummyPhoto utility
jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: (src: any) => src === 'dummy-url',
}));

// Mock LiquidGlassButton
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    const MockLiquidGlassButton = (props: any) => (
      <TouchableOpacity
        testID={props.title}
        onPress={props.onPress}
        // Explicitly pass disabled to accessibilityState for robust checking
        accessibilityState={{disabled: !!props.disabled}}
        disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
    return {
      LiquidGlassButton: MockLiquidGlassButton,
    };
  },
);

// Mock SwipeableGlassCard
jest.mock(
  '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard',
  () => {
    const {View} = require('react-native');
    const MockSwipeableGlassCard = (props: any) => (
      <View testID="swipeable-card">
        {props.children}
        <View
          testID="swipe-trigger"
          // @ts-ignore
          onSwipeTrigger={props.onAction}
        />
      </View>
    );
    return {
      SwipeableGlassCard: MockSwipeableGlassCard,
    };
  },
);

describe('AppointmentCard Component', () => {
  const defaultProps = {
    doctorName: 'Dr. Smith',
    specialization: 'Cardiology',
    hospital: 'General Hospital',
    dateTime: 'Today, 10:00 AM',
    avatar: {uri: 'http://avatar.com/img.png'},
    onPress: jest.fn(),
    onViewDetails: jest.fn(),
    onGetDirections: jest.fn(),
    onChat: jest.fn(),
    onCheckIn: jest.fn(),
    onChatBlocked: jest.fn(),
    testIDs: {
      container: 'card-container',
      directions: 'directions-btn',
      chat: 'chat-btn',
      checkIn: 'checkin-btn',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders correctly with all text fields', () => {
    const {getByText} = render(
      <AppointmentCard {...defaultProps} note="Bring reports" />,
    );

    expect(getByText('Dr. Smith')).toBeTruthy();
    expect(getByText('Cardiology')).toBeTruthy();
    expect(getByText('General Hospital')).toBeTruthy();
    expect(getByText('Today, 10:00 AM')).toBeTruthy();
    // Use Regex to find text even if split by nested nodes or whitespace
    expect(getByText(/Note:/)).toBeTruthy();
    expect(getByText(/Bring reports/)).toBeTruthy();
  });

  it('renders without note if note prop is missing', () => {
    const {queryByText} = render(
      <AppointmentCard {...defaultProps} note={undefined} />,
    );
    expect(queryByText(/Note:/)).toBeNull();
  });
  // ===========================================================================
  // 2. Avatar Logic (State & Effects)
  // ===========================================================================

  it('renders provided avatar initially', () => {
    const {UNSAFE_getByType} = render(<AppointmentCard {...defaultProps} />);
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({uri: 'http://avatar.com/img.png'});
  });

  it('switches to fallback avatar on image error', () => {
    const fallback = {uri: 'fallback.png'};
    const onAvatarError = jest.fn();

    const {UNSAFE_getByType} = render(
      <AppointmentCard
        {...defaultProps}
        fallbackAvatar={fallback}
        onAvatarError={onAvatarError}
      />,
    );

    const image = UNSAFE_getByType(Image);
    // Simulate Error
    fireEvent(image, 'error');

    expect(onAvatarError).toHaveBeenCalled();
  });

  it('uses fallback immediately if avatar is a known dummy URL', () => {
    const fallback = {uri: 'fallback.png'};
    const {UNSAFE_getByType} = render(
      <AppointmentCard
        {...defaultProps}
        avatar="dummy-url"
        fallbackAvatar={fallback}
      />,
    );

    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual(fallback);
  });

  it('updates avatar source if avatar prop changes', () => {
    const {UNSAFE_getByType, rerender} = render(
      <AppointmentCard {...defaultProps} avatar={{uri: 'img1.png'}} />,
    );

    let image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({uri: 'img1.png'});

    // Update Prop
    rerender(<AppointmentCard {...defaultProps} avatar={{uri: 'img2.png'}} />);

    image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({uri: 'img2.png'});
  });

  // ===========================================================================
  // 3. Interaction (Buttons & Card)
  // ===========================================================================

  it('calls onPress when the card body is pressed', () => {
    const {getByTestId} = render(<AppointmentCard {...defaultProps} />);
    const touchable = getByTestId('card-container');

    fireEvent.press(touchable);
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('disables card press if onPress is undefined', () => {
    const {getByTestId} = render(
      <AppointmentCard {...defaultProps} onPress={undefined} />,
    );
    const touchable = getByTestId('card-container');
    // Check disabled prop specifically. React Native TouchableOpacity maps this.
    // If testing library returns the node, we usually check props.disabled or props.accessibilityState.disabled
    expect(touchable.props.accessibilityState?.disabled).toBe(true);
  });

  it('calls onViewDetails when swipe action is triggered', () => {
    const {getByTestId} = render(<AppointmentCard {...defaultProps} />);
    const trigger = getByTestId('swipe-trigger');

    // @ts-ignore
    trigger.props.onSwipeTrigger();

    expect(defaultProps.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('calls onGetDirections when button is pressed', () => {
    const {getByText} = render(<AppointmentCard {...defaultProps} />);
    fireEvent.press(getByText('Get directions'));
    expect(defaultProps.onGetDirections).toHaveBeenCalled();
  });

  it('calls onCheckIn when button is pressed', () => {
    const {getByText} = render(
      <AppointmentCard {...defaultProps} checkInLabel="Check In Now" />,
    );
    fireEvent.press(getByText('Check In Now'));
    expect(defaultProps.onCheckIn).toHaveBeenCalled();
  });

  it('handles checkInDisabled prop', () => {
    const {getByTestId} = render(
      <AppointmentCard {...defaultProps} checkInDisabled={true} />,
    );
    const btn = getByTestId('Check in');
    // Check accessibilityState for robustness with TouchableOpacity mocks
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  // ===========================================================================
  // 4. Chat Logic & Branches
  // ===========================================================================

  it('calls onChat when Chat button is pressed and canChat is true', () => {
    const {getByText} = render(
      <AppointmentCard {...defaultProps} canChat={true} />,
    );
    fireEvent.press(getByText('Chat'));
    expect(defaultProps.onChat).toHaveBeenCalled();
    expect(defaultProps.onChatBlocked).not.toHaveBeenCalled();
  });

  it('calls onChatBlocked when Chat button is pressed and canChat is false', () => {
    const {getByText} = render(
      <AppointmentCard {...defaultProps} canChat={false} />,
    );
    fireEvent.press(getByText('Chat'));
    expect(defaultProps.onChatBlocked).toHaveBeenCalled();
    expect(defaultProps.onChat).not.toHaveBeenCalled();
  });

  it('does NOT render buttons if showActions is false', () => {
    const {queryByText} = render(
      <AppointmentCard {...defaultProps} showActions={false} />,
    );

    expect(queryByText('Get directions')).toBeNull();
    expect(queryByText('Chat')).toBeNull();
    expect(queryByText('Check in')).toBeNull();
  });

  it('handles missing callbacks gracefully (coverage for optional funcs)', () => {
    const {getByText, getByTestId} = render(
      <AppointmentCard
        {...defaultProps}
        onGetDirections={undefined}
        onChat={undefined}
        onCheckIn={undefined}
        onViewDetails={undefined}
        onPress={undefined}
      />,
    );

    fireEvent.press(getByText('Get directions'));
    fireEvent.press(getByText('Chat'));
    fireEvent.press(getByText('Check in'));
    getByTestId('swipe-trigger').props.onSwipeTrigger();
  });
});
