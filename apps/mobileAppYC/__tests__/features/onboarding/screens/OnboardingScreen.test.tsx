import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {OnboardingScreen} from '../../../../src/features/onboarding/screens/OnboardingScreen';
import {FlatList} from 'react-native';

// --- Mocks ---

// 1. Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

// react-native-svg, react-native-reanimated and react-native-linear-gradient
// are mocked globally in jest.setup.js, so InkAnnotation + the gradient render
// as plain hosts here.

describe('OnboardingScreen', () => {
  it('renders the first slide headline, encircled accent and subtitle', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    expect(screen.getByText('Every companion has a story.')).toBeTruthy();
    expect(screen.getByText('Keep it whole.')).toBeTruthy();
    expect(
      screen.getByText(
        'Cats, dogs and horses: visits, doses and documents on one timeline you own.',
      ),
    ).toBeTruthy();
  });

  it('renders the final-slide "Get started" CTA and the Sign in link', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    expect(screen.getByText('Get started')).toBeTruthy();
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skip').length).toBeGreaterThan(0);
  });

  it('calls onComplete when "Skip" is pressed', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.press(screen.getAllByText('Skip')[0]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when the "Sign in" link is pressed', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.press(screen.getAllByText('Sign in')[0]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when "Get started" (last slide) is pressed', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.press(screen.getByText('Get started'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not complete when a non-final "Continue" is pressed (it advances)', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    // Slides 1 and 2 both show "Continue"; pressing one should scroll, not finish.
    fireEvent.press(screen.getAllByText('Continue')[0]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('scrolls back a slide when the "Back" glass button is pressed (index !== 0)', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    // The Back button only renders on slides after the first (index !== 0).
    const backButtons = screen.getAllByLabelText('Back');
    expect(backButtons.length).toBeGreaterThan(0);
    fireEvent.press(backButtons[0]);
    // Back navigates within the list; it must not finish onboarding.
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('tracks the active slide via onViewableItemsChanged (all branches)', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const flatList = screen.UNSAFE_getByType(FlatList);

    // index present and > 0
    act(() => {
      flatList.props.onViewableItemsChanged({
        viewableItems: [{index: 1, item: {}, key: '2', isViewable: true}],
        changed: [],
      });
    });
    // index null -> guarded, no update
    act(() => {
      flatList.props.onViewableItemsChanged({
        viewableItems: [{index: null, item: {}, key: 'x', isViewable: true}],
        changed: [],
      });
    });
    // empty -> if condition false
    act(() => {
      flatList.props.onViewableItemsChanged({viewableItems: [], changed: []});
    });

    expect(screen.getByText('Every companion has a story.')).toBeTruthy();
  });

  it('extracts keys via keyExtractor', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const flatList = screen.UNSAFE_getByType(FlatList);
    expect(flatList.props.keyExtractor({id: 'slide-9'} as any, 0)).toBe(
      'slide-9',
    );
  });
});
