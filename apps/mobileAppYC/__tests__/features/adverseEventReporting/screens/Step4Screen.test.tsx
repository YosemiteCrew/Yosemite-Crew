import React from 'react';
import {render, fireEvent, within} from '@testing-library/react-native';
import {Step4Screen} from '../../../../src/features/adverseEventReporting/screens/Step4Screen';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  getParent: jest.fn(() => ({navigate: mockParentNavigate})),
} as any;

// 2. Redux — the selector implementation is provided per-test.
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// 3. Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. Components — mock AERLayout so the step label, back/next controls and
// children surface for assertions. The real layout pulls in the liquid-glass
// header stack which is irrelevant to Step4's own logic.
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({
      children,
      onBack,
      bottomButton,
      stepLabel,
      currentStep,
      totalSteps,
    }: any) => (
      <View testID="aer-layout">
        <Text>{stepLabel}</Text>
        {currentStep != null ? (
          <Text testID="aer-step-counter">{`${currentStep}/${totalSteps}`}</Text>
        ) : null}
        <TouchableOpacity onPress={onBack} testID="layout-back">
          <Text>Back</Text>
        </TouchableOpacity>
        {bottomButton ? (
          <TouchableOpacity onPress={bottomButton.onPress} testID="layout-next">
            <Text>{bottomButton.title}</Text>
          </TouchableOpacity>
        ) : null}
        {children}
      </View>
    );
  },
);

// --- Test Suite ---

describe('Step4Screen', () => {
  const mockCompanion = {
    id: 'c1',
    name: 'Buddy',
    breed: {breedName: 'Golden Retriever'},
    dateOfBirth: '2020-06-15T12:00:00.000Z',
    gender: 'male',
    currentWeight: 25,
    color: 'Golden',
    allergies: 'None',
    neuteredStatus: 'neutered',
    bloodGroup: 'DEA 1.1',
    microchipNumber: '123456789',
    passportNumber: 'PASS-001',
    insuredStatus: 'insured',
  };

  const setupState = (companions: any[], selectedId: string | null) => {
    mockUseSelector.mockImplementation((selector: any) =>
      selector({
        companion: {
          companions,
          selectedCompanionId: selectedId,
        },
      }),
    );
  };

  const renderScreen = () =>
    render(<Step4Screen navigation={mockNavigation} route={{} as any} />);

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigation.getParent.mockReturnValue({navigate: mockParentNavigate});
  });

  it('renders the "Companion not found" view when no companion is selected', () => {
    setupState([], null);

    const {getByText, queryByTestId} = renderScreen();

    expect(getByText('Companion not found')).toBeTruthy();
    expect(getByText('Step 4 of 5')).toBeTruthy();
    // The progress counter and summary rows are only in the populated layout.
    expect(queryByTestId('aer-step-counter')).toBeNull();
    expect(queryByTestId('aer-summary-row-0')).toBeNull();
  });

  it('renders the "Companion not found" view when the selected id has no match', () => {
    // selectedCompanionId is set (truthy) but not present in the list, so
    // `.find()` returns undefined -> the empty branch is taken.
    setupState([{id: 'other'}], 'c1');

    const {getByText, queryByTestId} = renderScreen();

    expect(getByText('Companion not found')).toBeTruthy();
    expect(queryByTestId('aer-summary-row-0')).toBeNull();
  });

  it('navigates back from the "Companion not found" view when Back is pressed', () => {
    setupState([], null);

    const {getByText, getByTestId} = renderScreen();

    expect(getByText('Companion not found')).toBeTruthy();
    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders the title, subtitle, progress counter and all summary rows for a full companion', () => {
    setupState([mockCompanion], 'c1');

    const {getByText, getByTestId} = renderScreen();

    expect(getByText('About Buddy at the time')).toBeTruthy();
    expect(
      getByText(
        'From their record. Correct anything that was different when the event happened.',
      ),
    ).toBeTruthy();
    // currentStep/totalSteps wired into the layout.
    expect(getByTestId('aer-step-counter')).toHaveTextContent('4/5');

    // Row labels.
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Breed')).toBeTruthy();
    expect(getByText('Date of birth')).toBeTruthy();
    expect(getByText('Gender')).toBeTruthy();
    expect(getByText('Current weight')).toBeTruthy();
    expect(getByText('Color')).toBeTruthy();
    expect(getByText('Allergies')).toBeTruthy();
    expect(getByText('Neutered status')).toBeTruthy();
    expect(getByText('Blood group')).toBeTruthy();
    expect(getByText('Microchip number')).toBeTruthy();
    expect(getByText('Passport number')).toBeTruthy();
    expect(getByText('Insurance status')).toBeTruthy();

    // Row values (capitalize + weight/date formatting from the real helpers).
    expect(getByText('Buddy')).toBeTruthy();
    expect(getByText('Golden Retriever')).toBeTruthy();
    expect(getByText('Male')).toBeTruthy();
    expect(getByText('25 kg')).toBeTruthy();
    expect(getByText('Golden')).toBeTruthy();
    expect(getByText('None')).toBeTruthy();
    expect(getByText('Neutered')).toBeTruthy();
    expect(getByText('DEA 1.1')).toBeTruthy();
    expect(getByText('123456789')).toBeTruthy();
    expect(getByText('PASS-001')).toBeTruthy();
    expect(getByText('Insured')).toBeTruthy();

    // Date of birth is formatted (mid-day UTC keeps it stable across TZ).
    const dobRow = getByTestId('aer-summary-row-2');
    expect(within(dobRow).getByText(/2020/)).toBeTruthy();
    expect(within(dobRow).getByText(/Jun/)).toBeTruthy();
  });

  it('shows the em-dash fallback for every missing optional field', () => {
    const partialCompanion = {id: 'c2', name: 'Mittens'};
    setupState([partialCompanion], 'c2');

    const {getByText, getAllByText} = renderScreen();

    expect(getByText('About Mittens at the time')).toBeTruthy();
    expect(getByText('Mittens')).toBeTruthy();

    // Name has a value; the other 11 rows fall back to the em-dash.
    expect(getAllByText('—')).toHaveLength(11);
  });

  it('shows the em-dash fallback for a whitespace-only value', () => {
    // color is truthy but trims to empty -> the trim().length > 0 branch is false.
    setupState([{...mockCompanion, color: '   '}], 'c1');

    const {getByTestId} = renderScreen();

    const colorRow = getByTestId('aer-summary-row-5');
    expect(within(colorRow).getByText('Color')).toBeTruthy();
    expect(within(colorRow).getByText('—')).toBeTruthy();
  });

  it('renders a divider after every row except the last', () => {
    setupState([mockCompanion], 'c1');

    const {getByTestId} = renderScreen();

    // 12 rows -> rows 0..11 exist, the last row is index 11.
    expect(getByTestId('aer-summary-row-0')).toBeTruthy();
    expect(getByTestId('aer-summary-row-11')).toBeTruthy();
  });

  it('navigates back when the layout Back button is pressed', () => {
    setupState([mockCompanion], 'c1');

    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to "Step5" when the layout Next button is pressed', () => {
    setupState([mockCompanion], 'c1');

    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step5');
  });

  it('navigates to Edit Companion when a summary row is pressed', () => {
    setupState([mockCompanion], 'c1');

    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('aer-summary-row-0'));

    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditCompanionOverview',
      params: {companionId: 'c1'},
    });
  });

  it('does not crash or navigate when getParent() returns undefined', () => {
    mockNavigation.getParent.mockReturnValueOnce(undefined);
    setupState([mockCompanion], 'c1');

    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('aer-summary-row-3'));

    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });
});
