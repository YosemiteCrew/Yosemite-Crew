import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {LandingScreen} from '../../../../src/features/adverseEventReporting/screens/LandingScreen';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mocks ---

// 1. Mock Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as any;

// 2. Mock Theme Hook
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 3. Mock Child Components
// We mock AERLayout to expose the 'onBack' and 'bottomButton' props as clickable elements.
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return ({children, onBack, bottomButton}: any) => (
      <View testID="aer-layout">
        <TouchableOpacity onPress={onBack} testID="layout-back-btn">
          <Text>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={bottomButton.onPress}
          testID="layout-bottom-btn">
          <Text>{bottomButton.title}</Text>
        </TouchableOpacity>
        {children}
      </View>
    );
  },
);

// --- Test Suite ---

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the layout, hero, explainer, and safety callout', () => {
    const {getByTestId, getByText} = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    // Verify Layout is present
    expect(getByTestId('aer-layout')).toBeTruthy();

    // Hero + explainer copy
    expect(
      getByText('If a medicine or vaccine went wrong, report it.'),
    ).toBeTruthy();
    expect(
      getByText(
        'Your report reaches the people who track drug safety: the ' +
          'manufacturer, your clinic, or the regulatory authority. It takes about ' +
          'five minutes.',
      ),
    ).toBeTruthy();

    // Hero icon tile + safety callout icon
    expect(getByTestId('icon-shield-half-outline')).toBeTruthy();
    expect(getByTestId('icon-alert-circle-outline')).toBeTruthy();

    // Safety callout copy
    expect(
      getByText(
        'If your companion is in danger right now, call the vet first. This ' +
          'report can wait.',
      ),
    ).toBeTruthy();

    // Start CTA title passed to the layout
    expect(getByText('Start report')).toBeTruthy();
  });

  it('renders the numbered five-step overview', () => {
    const {getByText} = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    // Step labels
    expect(getByText('Who to notify')).toBeTruthy();
    expect(getByText('Parent information')).toBeTruthy();
    expect(getByText('Which companion')).toBeTruthy();
    expect(getByText('Companion information')).toBeTruthy();
    expect(getByText('The product and what happened')).toBeTruthy();

    // Step badge numbers 1-5
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('navigates to "Step1" when the Start button is pressed', () => {
    const {getByTestId} = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    const startButton = getByTestId('layout-bottom-btn');
    fireEvent.press(startButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Step1');
  });

  it('navigates back when the Layout back action is triggered', () => {
    const {getByTestId} = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    const backButton = getByTestId('layout-back-btn');
    fireEvent.press(backButton);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
