import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Step4Screen} from '../../../../src/features/adverseEventReporting/screens/Step4Screen';

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

// 2. Redux
// We mock the hook implementation to return what we want in each test
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// 3. Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
      },
      typography: {
        titleMedium: {fontSize: 16},
      },
    },
  }),
}));

// 4. Utils
jest.mock('../../../../src/shared/utils/commonHelpers', () => ({
  capitalize: (str: string) => str?.toUpperCase() || '',
}));

// 5. Child Components
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

// Mock AERInfoSection
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERInfoSection',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({title, onEdit, rows}: any) => (
      <View testID="aer-info-section">
        <Text>{title}</Text>
        <TouchableOpacity onPress={onEdit} testID="section-edit-btn">
          <Text>Edit Section</Text>
        </TouchableOpacity>
        {rows.map((row: any, index: number) => (
          <TouchableOpacity
            key={index}
            onPress={row.onPress}
            testID={`row-${index}`}>
            <Text>
              {row.label}: {row.value}
            </Text>
          </TouchableOpacity>
        ))}
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
    dateOfBirth: '2020-01-01T00:00:00.000Z',
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigation.getParent.mockReturnValue({navigate: mockParentNavigate});
  });

  it('renders "Companion not found" view when no companion is selected', () => {
    setupState([], null);

    const {getByText, queryByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Companion not found')).toBeTruthy();
    expect(getByText('Step 4 of 5')).toBeTruthy();
    // Should NOT render the info section or next button logic when missing companion
    expect(queryByTestId('aer-info-section')).toBeNull();
  });

  it('renders correctly with full companion data', () => {
    setupState([mockCompanion], 'c1');

    const {getByText} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Companion Information')).toBeTruthy();
    expect(getByText('Name: Buddy')).toBeTruthy();
    expect(getByText('Breed: Golden Retriever')).toBeTruthy();
    expect(getByText('Gender: MALE')).toBeTruthy(); // mocked capitalize
    expect(getByText('Current weight: 25 kg')).toBeTruthy();
    expect(getByText('Color: Golden')).toBeTruthy();

    // Verify Date Formatting logic
    expect(getByText(/Date of birth:/)).toBeTruthy();
  });

  it('renders correctly with partial/missing companion data (Fallbacks)', () => {
    // Companion with missing optional fields
    const partialCompanion = {
      id: 'c2',
      name: 'Mittens',
      // Missing breed, dob, weight, etc.
    };
    setupState([partialCompanion], 'c2');

    const {getByText} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    expect(getByText('Name: Mittens')).toBeTruthy();

    // Fallback checks
    expect(getByText('Breed: ')).toBeTruthy();
    expect(getByText('Date of birth: ')).toBeTruthy();
    expect(getByText('Current weight: ')).toBeTruthy(); // No 'kg' suffix if value missing? actually logic is `${val} kg` if exists, else ''
    expect(getByText('Color: ')).toBeTruthy();
    expect(getByText('Neutered status: ')).toBeTruthy();
  });

  it('navigates back when layout Back button is pressed', () => {
    setupState([mockCompanion], 'c1');
    const {getByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to "Step5" when layout Next button is pressed', () => {
    setupState([mockCompanion], 'c1');
    const {getByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step5');
  });

  it('navigates to Edit Companion when "Edit" is pressed on section header', () => {
    setupState([mockCompanion], 'c1');
    const {getByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('section-edit-btn'));

    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditCompanionOverview',
      params: {companionId: 'c1'},
    });
  });

  it('navigates to Edit Companion when an individual row is pressed', () => {
    setupState([mockCompanion], 'c1');
    const {getByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Press the Name row
    fireEvent.press(getByTestId('row-0'));

    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditCompanionOverview',
      params: {companionId: 'c1'},
    });
  });

  it('handles safe navigation when getParent() returns undefined', () => {
    // Edge case: getParent() returns undefined
    mockNavigation.getParent.mockReturnValueOnce(undefined);
    setupState([mockCompanion], 'c1');

    const {getByTestId} = render(
      <Step4Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Trigger edit
    fireEvent.press(getByTestId('section-edit-btn'));

    // Should call getParent but not crash or call navigate
    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });
});
