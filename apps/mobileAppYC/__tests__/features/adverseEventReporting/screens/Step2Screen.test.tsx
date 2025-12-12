import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Step2Screen} from '../../../../src/features/adverseEventReporting/screens/Step2Screen';

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
// We use a mock function that we can control via implementation,
// but we ensure the import itself passes the selector through to be called.
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// 3. Child Components
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

// Mock AERInfoSection
jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERInfoSection',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({title, onEdit, rows}: any) => (
      <View testID="aer-info-section">
        <Text>{title}</Text>
        {/* Button to trigger the main Section Edit action */}
        <TouchableOpacity onPress={onEdit} testID="section-edit-btn">
          <Text>Edit Section</Text>
        </TouchableOpacity>

        {/* Render rows to verify data mapping and individual row onPress */}
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

describe('Step2Screen', () => {
  // Helper to mock the state and ensure the selector callback runs
  const setupState = (user: any) => {
    mockUseSelector.mockImplementation((selector: any) =>
      selector({
        auth: {user},
      }),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default navigation behavior: getParent returns a valid navigator
    mockNavigation.getParent.mockReturnValue({navigate: mockParentNavigate});
  });

  it('renders correctly with full user data (Happy Path)', () => {
    setupState({
      firstName: 'John',
      lastName: 'Doe',
      phone: '123456',
      email: 'john@example.com',
      currency: 'GBP',
      dateOfBirth: '1990-01-01T00:00:00.000Z',
      address: {
        addressLine: '123 Main St',
        city: 'London',
        stateProvince: 'Greater London',
        postalCode: 'SW1',
        country: 'UK',
      },
    });

    const {getByText} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Verify Layout Labels
    expect(getByText('Step 2 of 5')).toBeTruthy();
    expect(getByText('Parent Information')).toBeTruthy();

    // Verify mapped data exists in the rows
    expect(getByText('First name: John')).toBeTruthy();
    expect(getByText('Phone number: 123456')).toBeTruthy();
    expect(getByText('Currency: GBP')).toBeTruthy();
    expect(getByText('City: London')).toBeTruthy();

    // Verify Date Formatting (presence of the label implies row was rendered)
    expect(getByText(/Date of birth:/)).toBeTruthy();
  });

  it('renders correctly with missing/null user data (Fallbacks)', () => {
    // Passing null allows us to test the `?? ''` logic and default 'USD'
    mockUseSelector.mockImplementation((selector: any) =>
      selector({
        auth: {user: null},
      }),
    );

    const {getByText} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Verify Fallbacks (Empty strings)
    expect(getByText('First name: ')).toBeTruthy();
    expect(getByText('Last name: ')).toBeTruthy();
    expect(getByText('Email address: ')).toBeTruthy();

    // Verify Currency default logic
    expect(getByText('Currency: USD')).toBeTruthy();

    // Verify Date fallback logic
    expect(getByText('Date of birth: ')).toBeTruthy();

    // Verify Address nesting fallback logic
    expect(getByText('Address: ')).toBeTruthy();
    expect(getByText('Country: ')).toBeTruthy();
  });

  it('navigates back when layout Back button is pressed', () => {
    setupState({});
    const {getByTestId} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to "Step3" when layout Next button is pressed', () => {
    setupState({});
    const {getByTestId} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step3');
  });

  it('navigates to Edit Profile when "Edit" is pressed on the info section header', () => {
    setupState({});
    const {getByTestId} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    fireEvent.press(getByTestId('section-edit-btn'));

    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditParentOverview',
      params: {companionId: 'parent'},
    });
  });

  it('navigates to Edit Profile when an individual row is pressed', () => {
    setupState({});
    const {getByTestId} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Press the first row (First Name)
    fireEvent.press(getByTestId('row-0'));

    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditParentOverview',
      params: {companionId: 'parent'},
    });
  });

  it('handles safe navigation when getParent() returns undefined', () => {
    // Override mock to return undefined specifically for this test case
    // This covers the branch: navigation.getParent<any>()?.navigate(...)
    mockNavigation.getParent.mockReturnValueOnce(undefined);
    setupState({});

    const {getByTestId} = render(
      <Step2Screen navigation={mockNavigation} route={{} as any} />,
    );

    // Trigger edit action
    fireEvent.press(getByTestId('section-edit-btn'));

    // Should call getParent, but NOT crash and NOT call navigate
    expect(mockNavigation.getParent).toHaveBeenCalled();
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });
});
