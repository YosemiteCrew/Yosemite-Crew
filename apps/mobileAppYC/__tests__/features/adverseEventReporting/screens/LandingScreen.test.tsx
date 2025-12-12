import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {LandingScreen} from '../../../../src/features/adverseEventReporting/screens/LandingScreen';

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
  useTheme: () => ({
    theme: {
      spacing: {6: 24},
    },
  }),
}));

// 3. Mock Images
jest.mock('../../../../src/assets/images', () => ({
  Images: {
    adverse1: {uri: 'test-image-uri'},
  },
}));

// 4. Mock Child Components
// We mock AERLayout to expose the 'onBack' and 'bottomButton' props as clickable elements.
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return ({children, onBack, bottomButton, stepLabel}: any) => (
      <View testID="aer-layout">
        <Text testID="step-label">{stepLabel}</Text>
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

jest.mock(
  '../../../../src/features/legal/components/LegalContentRenderer',
  () => {
    const {View} = require('react-native');
    return () => <View testID="legal-content-renderer" />;
  },
);

// 5. Mock Content Data
jest.mock(
  '../../../../src/features/adverseEventReporting/content/generalInfoSections',
  () => ({
    generalInfoSections: [],
  }),
);

// --- Test Suite ---

describe('LandingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with layout, image, and content', () => {
    const {getByTestId, getByText} = render(
      <LandingScreen navigation={mockNavigation} route={{} as any} />,
    );

    // Verify Layout is present
    expect(getByTestId('aer-layout')).toBeTruthy();

    // Verify Step Label passed to layout
    expect(getByText('General information')).toBeTruthy();

    // Verify Legal Content Renderer is present (mocked)
    expect(getByTestId('legal-content-renderer')).toBeTruthy();
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
