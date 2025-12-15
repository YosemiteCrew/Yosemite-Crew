import React from 'react';
import {render, fireEvent, within} from '@testing-library/react-native';
import {Step3Screen} from '../../../../src/features/adverseEventReporting/screens/Step3Screen';
import {useSelector} from 'react-redux';
import {useAdverseEventReport} from '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as any;

// 2. Redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

// 3. Context
const mockUpdateDraft = jest.fn();
jest.mock(
  '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext',
  () => ({
    useAdverseEventReport: jest.fn(),
  }),
);

// 4. Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        white: 'white',
        error: 'red',
      },
      spacing: {4: 16, 6: 24},
      typography: {
        h6Clash: {},
        paragraphBold: {},
        labelXsBold: {},
      },
    },
  }),
}));

// 5. Components
// Mock AERLayout
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({children, onBack, bottomButton, stepLabel}: any) => (
      <View testID="aer-layout">
        <Text>{stepLabel}</Text>
        <TouchableOpacity onPress={onBack} testID="layout-back">
          <Text>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={bottomButton.onPress} testID="layout-next">
          <Text>{bottomButton.title}</Text>
        </TouchableOpacity>
        {children}
      </View>
    );
  },
);

// Mock LinkedBusinessCard (Named Export)
jest.mock(
  '../../../../src/features/linkedBusinesses/components/LinkedBusinessCard',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LinkedBusinessCard: ({business, onPress, showBorder}: any) => (
        <TouchableOpacity
          testID={`business-card-${business.id}`}
          onPress={onPress}>
          <Text>{business.name}</Text>
          {/* Render status text to verify showBorder logic easily via getByText */}
          <Text>{showBorder ? 'BORDER_VISIBLE' : 'BORDER_HIDDEN'}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

// --- Test Suite ---

describe('Step3Screen', () => {
  const mockBusinesses = [
    {id: 'b1', name: 'Vet Clinic A'},
    {id: 'b2', name: 'Animal Hospital B'},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = (draftId: string | null = null) => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {linkedBusinessId: draftId},
      updateDraft: mockUpdateDraft,
    });

    (useSelector as unknown as jest.Mock).mockReturnValue(mockBusinesses);

    return render(
      <Step3Screen navigation={mockNavigation} route={{} as any} />,
    );
  };

  it('renders correctly with no selection initially', () => {
    const {getByText, getByTestId} = setup(null);

    expect(getByText('Step 3 of 5')).toBeTruthy();
    expect(getByText('Select Linked Hospital')).toBeTruthy();
    expect(getByText('Vet Clinic A')).toBeTruthy();

    // Verify correct styling prop logic via text existence within the specific card
    const card1 = getByTestId('business-card-b1');
    expect(within(card1).getByText('BORDER_HIDDEN')).toBeTruthy();
  });

  it('renders correctly with a pre-selected business from draft', () => {
    // Draft has 'b2', so b2 should show visible border status
    const {getByTestId} = setup('b2');

    const card1 = getByTestId('business-card-b1');
    const card2 = getByTestId('business-card-b2');

    expect(within(card1).getByText('BORDER_HIDDEN')).toBeTruthy();
    expect(within(card2).getByText('BORDER_VISIBLE')).toBeTruthy();
  });

  it('handles navigation back', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles validation error when Next is pressed without selection', () => {
    const {getByTestId, getByText} = setup(null);

    // Press Next
    fireEvent.press(getByTestId('layout-next'));

    // Check Error
    expect(getByText('Select a hospital to continue')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('selects a business, updates draft, clears error, and navigates', () => {
    const {getByTestId, queryByText} = setup(null);

    // 1. Trigger error first to test the clearing logic
    fireEvent.press(getByTestId('layout-next'));
    expect(queryByText('Select a hospital to continue')).toBeTruthy();

    // 2. Select Business 'b1'
    fireEvent.press(getByTestId('business-card-b1'));

    // Verify draft update
    expect(mockUpdateDraft).toHaveBeenCalledWith({linkedBusinessId: 'b1'});

    // Verify error cleared (if(error) check inside handleBusinessSelect)
    expect(queryByText('Select a hospital to continue')).toBeNull();

    // 3. Press Next
    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step4');
  });

  it('updates selection when switching between businesses', () => {
    // Start with b1 selected
    const {getByTestId} = setup('b1');

    // Select b2
    fireEvent.press(getByTestId('business-card-b2'));

    // Verify new draft update
    expect(mockUpdateDraft).toHaveBeenCalledWith({linkedBusinessId: 'b2'});

    // Verify UI update: b2 should now have visible border status
    const card2 = getByTestId('business-card-b2');
    expect(within(card2).getByText('BORDER_VISIBLE')).toBeTruthy();
  });
});
