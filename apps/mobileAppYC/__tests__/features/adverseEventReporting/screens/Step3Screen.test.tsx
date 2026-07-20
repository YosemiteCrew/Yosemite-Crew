import React from 'react';
import {render, fireEvent, within} from '@testing-library/react-native';
import {Step3Screen} from '../../../../src/features/adverseEventReporting/screens/Step3Screen';
import {useSelector} from 'react-redux';
import {useAdverseEventReport} from '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as any;

// 2. Redux — Step3Screen only reads via useSelector; the business card
// (which uses useDispatch) is mocked below, so useSelector alone is enough.
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
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 5. Components
// Mock AERLayout — surface the step progress + back/next controls so tests can
// assert copy and drive the callbacks the screen wires up.
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({children, onBack, bottomButton, currentStep, totalSteps}: any) => (
      <View testID="aer-layout">
        <Text>{`Step ${currentStep} of ${totalSteps}`}</Text>
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

// Mock AERBusinessSelectCard (Named Export). The real card dispatches a thunk
// via useDispatch; mocking it keeps this suite focused on Step3Screen and
// exposes the selection state so we can verify isSelected wiring.
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERBusinessSelectCard',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      AERBusinessSelectCard: ({business, isSelected, onSelect}: any) => (
        <TouchableOpacity
          testID={`business-card-${business.id}`}
          onPress={() => onSelect(business.id)}>
          <Text>{business.businessName}</Text>
          <Text>{isSelected ? 'SELECTED' : 'UNSELECTED'}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

// --- Test Suite ---

describe('Step3Screen', () => {
  const mockBusinesses = [
    {id: 'b1', businessName: 'Vet Clinic A'},
    {id: 'b2', businessName: 'Animal Hospital B'},
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
    expect(getByText('Animal Hospital B')).toBeTruthy();

    // Neither card is selected initially
    const card1 = getByTestId('business-card-b1');
    const card2 = getByTestId('business-card-b2');
    expect(within(card1).getByText('UNSELECTED')).toBeTruthy();
    expect(within(card2).getByText('UNSELECTED')).toBeTruthy();
  });

  it('renders correctly with a pre-selected business from draft', () => {
    // Draft has 'b2', so b2 should render as selected and b1 as unselected.
    const {getByTestId} = setup('b2');

    const card1 = getByTestId('business-card-b1');
    const card2 = getByTestId('business-card-b2');

    expect(within(card1).getByText('UNSELECTED')).toBeTruthy();
    expect(within(card2).getByText('SELECTED')).toBeTruthy();
  });

  it('handles navigation back', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows a validation error when Next is pressed without a selection', () => {
    const {getByTestId, getByText} = setup(null);

    fireEvent.press(getByTestId('layout-next'));

    expect(getByText('Select a hospital to continue')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('selects a business, updates draft, clears error, and navigates', () => {
    const {getByTestId, queryByText, getByText} = setup(null);

    // 1. Trigger the error first so we can verify it later gets cleared.
    fireEvent.press(getByTestId('layout-next'));
    expect(getByText('Select a hospital to continue')).toBeTruthy();

    // 2. Select business 'b1'.
    fireEvent.press(getByTestId('business-card-b1'));

    // Draft updated with the selected id.
    expect(mockUpdateDraft).toHaveBeenCalledWith({linkedBusinessId: 'b1'});

    // Error cleared by handleBusinessSelect.
    expect(queryByText('Select a hospital to continue')).toBeNull();

    // Selected card now reflects selection.
    expect(
      within(getByTestId('business-card-b1')).getByText('SELECTED'),
    ).toBeTruthy();

    // 3. Press Next → navigates forward.
    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step4');
  });

  it('navigates immediately when a business is already selected from draft', () => {
    const {getByTestId, queryByText} = setup('b1');

    fireEvent.press(getByTestId('layout-next'));

    expect(mockNavigate).toHaveBeenCalledWith('Step4');
    // No validation error path taken.
    expect(queryByText('Select a hospital to continue')).toBeNull();
  });

  it('updates selection when switching between businesses', () => {
    // Start with b1 selected.
    const {getByTestId} = setup('b1');

    // Switch to b2.
    fireEvent.press(getByTestId('business-card-b2'));

    expect(mockUpdateDraft).toHaveBeenCalledWith({linkedBusinessId: 'b2'});

    // b2 now selected, b1 no longer selected.
    expect(
      within(getByTestId('business-card-b2')).getByText('SELECTED'),
    ).toBeTruthy();
    expect(
      within(getByTestId('business-card-b1')).getByText('UNSELECTED'),
    ).toBeTruthy();
  });

  it('reads linked businesses from redux state via the selector', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {linkedBusinessId: null},
      updateDraft: mockUpdateDraft,
    });

    // Invoke the actual selector so state.linkedBusinesses.linkedBusinesses runs.
    (useSelector as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({linkedBusinesses: {linkedBusinesses: mockBusinesses}}),
    );

    const {getByText} = render(
      <Step3Screen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Vet Clinic A')).toBeTruthy();
    expect(getByText('Animal Hospital B')).toBeTruthy();
  });

  it('renders no business cards when the linked list is empty', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {linkedBusinessId: null},
      updateDraft: mockUpdateDraft,
    });
    (useSelector as unknown as jest.Mock).mockReturnValue([]);

    const {queryByTestId, getByText} = render(
      <Step3Screen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Select Linked Hospital')).toBeTruthy();
    expect(queryByTestId('business-card-b1')).toBeNull();
  });
});
