import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {
  render,
  fireEvent,
  screen,
  act,
  within,
} from '@testing-library/react-native';
import {OnboardingScreen} from '../../../../src/features/onboarding/screens/OnboardingScreen';
import {AccessibilityInfo, FlatList, StyleSheet} from 'react-native';

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

// 3. react-i18next — real English defaults so text/label assertions below
// keep matching the same strings as before translation.
const ONBOARDING_TRANSLATIONS: Record<string, string> = {
  'onboarding.slide1_lead': 'Every companion has a story.',
  'onboarding.slide1_accent': 'Keep it whole.',
  'onboarding.slide1_subtitle':
    'Cats, dogs and horses: visits, doses and documents on one timeline you own.',
  'onboarding.slide2_lead': 'Share the care,',
  'onboarding.slide2_accent': 'together.',
  'onboarding.slide2_subtitle':
    'Partners, kids, dog walkers and sitters see the same reminders, the same doses, the same vet thread.',
  'onboarding.slide3_lead': 'Book without',
  'onboarding.slide3_accent': 'the phone call.',
  'onboarding.slide3_subtitle':
    'Real openings at your linked clinic, records that travel with you, bills settled in two taps.',
  'onboarding.continue': 'Continue',
  'onboarding.getStarted': 'Get started',
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',
  'onboarding.skipOnboarding': 'Skip onboarding',
  'onboarding.alreadyHaveAccount': 'Already have an account? ',
  'onboarding.signIn': 'Sign in',
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ONBOARDING_TRANSLATIONS[key] ?? key,
  }),
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

  it('renders the last-slide top-bar spacer as an invisible layout placeholder', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const spacerStyle = StyleSheet.flatten(
      screen.getByTestId('onboarding-topbar-spacer').props.style,
    );
    // Same 40x40 footprint as the glass button but with no fill or border, so
    // it holds the back chevron left-anchored without painting a blob.
    expect(spacerStyle.backgroundColor).toBeUndefined();
    expect(spacerStyle.borderWidth).toBeUndefined();
  });

  it('exposes "Sign in" as a pressable button with a hit slop that finishes onboarding', () => {
    const onComplete = jest.fn();
    render(<OnboardingScreen onComplete={onComplete} />);
    const signIn = screen.getAllByLabelText('Sign in')[0];
    expect(signIn.props.accessibilityRole).toBe('button');
    expect(signIn.props.hitSlop).toBeDefined();
    fireEvent.press(signIn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('anchors the page dots in the bottom block alongside the "Get started" CTA', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);

    // The dots now live in the fixed-height bottom block next to "Get started".
    // Their nearest shared ancestor with that CTA is that bottom block, which -
    // unlike the old layout where the dots hung under the variable-height top
    // block - must NOT contain the slide's subtitle. That exclusion proves the
    // dots moved down and stop shifting between swipes.
    const cta = screen.getByLabelText('Get started');
    const ctaAncestors = new Set<unknown>();
    for (let node = cta.parent; node; node = node.parent) {
      ctaAncestors.add(node);
    }

    // For each slide's dots, the nearest ancestor it shares with the final CTA.
    // Only the final slide's dots share the tight bottom block; the others share
    // just the outer list container.
    const sharedBlocks = screen.getAllByTestId('onboarding-dots').map(dots => {
      for (let node = dots.parent; node; node = node.parent) {
        if (ctaAncestors.has(node)) {
          return node;
        }
      }
      return null;
    });

    const coLocated = sharedBlocks.some(block => {
      if (!block) {
        return false;
      }
      const scoped = within(block);
      return (
        scoped.queryByLabelText('Get started') !== null &&
        scoped.queryByText(
          'Real openings at your linked clinic, records that travel with you, bills settled in two taps.',
        ) === null
      );
    });

    expect(coLocated).toBe(true);
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

  it('wraps the copy block in a scrollable container so it never clips on small screens or large text', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);

    const [scrollView] = screen.getAllByTestId('onboarding-content-scroll');
    const contentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle,
    );

    // flexGrow (not a fixed height) lets the box grow past the screen and
    // scroll instead of forcing content into a rigid, clip-prone box.
    expect(contentStyle.flexGrow).toBe(1);
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
  });

  it('extracts keys via keyExtractor', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const flatList = screen.UNSAFE_getByType(FlatList);
    expect(flatList.props.keyExtractor({id: 'slide-9'} as any, 0)).toBe(
      'slide-9',
    );
  });

  it('plays the active slide video when reduce motion is off (default)', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const [firstSlideVideo] = screen.getAllByTestId('rn-video');
    expect(firstSlideVideo.props.paused).toBe(false);
  });

  it('keeps every video paused when the OS reduce-motion preference is on', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    render(<OnboardingScreen onComplete={jest.fn()} />);
    await act(async () => {});

    const videos = screen.getAllByTestId('rn-video');
    expect(videos.length).toBeGreaterThan(0);
    videos.forEach(video => {
      expect(video.props.paused).toBe(true);
    });
  });
});
