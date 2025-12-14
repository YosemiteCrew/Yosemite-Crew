import React from 'react';
import {Text} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import AERLayout from '../../../../src/features/adverseEventReporting/components/AERLayout';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      spacing: {4: 16, 24: 96},
      colors: {
        placeholder: '#888',
      },
      typography: {
        subtitleBold12: {fontSize: 12, fontWeight: 'bold'},
      },
    },
  }),
}));

// 2. Mock Shared Components
// FIX: We require 'react-native' INSIDE the factory to avoid ReferenceError
jest.mock('@/shared/components/common', () => {
  const {View: RNView} = require('react-native');
  return {
    SafeArea: ({children}: any) => (
      <RNView testID="safe-area">{children}</RNView>
    ),
  };
});

jest.mock('@/shared/components/common/Header/Header', () => {
  const {
    View: RNView,
    Text: RNText,
    TouchableOpacity: RNTouchableOpacity,
  } = require('react-native');
  return {
    Header: ({title, showBackButton, onBack}: any) => (
      <RNView testID="mock-header">
        <RNText>{title}</RNText>
        <RNText>{showBackButton ? 'BackVisible' : 'BackHidden'}</RNText>
        {onBack && (
          <RNTouchableOpacity onPress={onBack} testID="header-back-btn">
            <RNText>Back</RNText>
          </RNTouchableOpacity>
        )}
      </RNView>
    ),
  };
});

jest.mock(
  '@/shared/components/common/PrimaryActionButton/PrimaryActionButton',
  () => {
    const {
      Text: RNText,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');
    return {
      __esModule: true,
      default: ({title, onPress, disabled, textStyle}: any) => (
        <RNTouchableOpacity
          testID="bottom-action-button"
          onPress={onPress}
          disabled={disabled}>
          <RNText>{title}</RNText>
          {disabled && <RNText>Disabled</RNText>}
          {textStyle && <RNText>CustomStyle</RNText>}
        </RNTouchableOpacity>
      ),
    };
  },
);

describe('AERLayout', () => {
  const ChildComponent = () => <Text>Child Content</Text>;

  // --- 1. Basic Rendering & Default Props ---
  it('renders children and default header configuration', () => {
    const {getByText, getByTestId, queryByText} = render(
      <AERLayout>
        <ChildComponent />
      </AERLayout>,
    );

    // Assert children are rendered
    expect(getByText('Child Content')).toBeTruthy();

    // Assert SafeArea wrapper
    expect(getByTestId('safe-area')).toBeTruthy();

    // Assert Default Header Props
    expect(getByText('Adverse event reporting')).toBeTruthy(); // Default title
    expect(getByText('BackVisible')).toBeTruthy(); // Default showBackButton = true

    // Assert Optional elements are NOT rendered
    expect(queryByText('Step', {exact: false})).toBeNull(); // No step label
    expect(queryByText('Submit')).toBeNull(); // No bottom button
  });

  // --- 2. Custom Header Props & Back Action ---
  it('renders custom header title and handles back navigation', () => {
    const onBackMock = jest.fn();
    const {getByText, getByTestId} = render(
      <AERLayout
        headerTitle="Custom Title"
        showBackButton={true}
        onBack={onBackMock}>
        <ChildComponent />
      </AERLayout>,
    );

    expect(getByText('Custom Title')).toBeTruthy();

    // Test Back Action
    fireEvent.press(getByTestId('header-back-btn'));
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('hides back button when showBackButton is false', () => {
    const {getByText} = render(
      <AERLayout showBackButton={false}>
        <ChildComponent />
      </AERLayout>,
    );

    expect(getByText('BackHidden')).toBeTruthy();
  });

  // --- 3. Step Label Rendering ---
  it('renders the step label when provided', () => {
    const {getByText} = render(
      <AERLayout stepLabel="Step 2 of 4">
        <ChildComponent />
      </AERLayout>,
    );

    expect(getByText('Step 2 of 4')).toBeTruthy();
  });

  // --- 4. Bottom Button Rendering & Interaction ---
  it('renders the bottom button and handles presses', () => {
    const onPressMock = jest.fn();
    const {getByTestId, getByText} = render(
      <AERLayout
        bottomButton={{
          title: 'Continue',
          onPress: onPressMock,
        }}>
        <ChildComponent />
      </AERLayout>,
    );

    const button = getByTestId('bottom-action-button');
    expect(getByText('Continue')).toBeTruthy();

    fireEvent.press(button);
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('passes disabled state and style overrides to the bottom button', () => {
    const {getByText} = render(
      <AERLayout
        bottomButton={{
          title: 'Save',
          onPress: jest.fn(),
          disabled: true,
          textStyleOverride: {color: 'red'},
        }}>
        <ChildComponent />
      </AERLayout>,
    );

    // Check our mock output for specific flags indicating props were passed
    expect(getByText('Disabled')).toBeTruthy();
    expect(getByText('CustomStyle')).toBeTruthy();
  });
});
