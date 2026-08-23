import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {Step2Screen} from '@/features/adverseEventReporting/screens/Step2Screen';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockGetParent = jest.fn(() => ({navigate: mockParentNavigate}));

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  getParent: mockGetParent,
} as any;

// 2. Redux — passthrough selector so the auth.user branch logic actually runs.
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// 3. Theme hook (shared complete warm-bone theme mock)
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. AERLayout (default export) — expose step label + back/next + children.
jest.mock('@/features/adverseEventReporting/components/AERLayout', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  const MockAERLayout = ({children, stepLabel, onBack, bottomButton}: any) => (
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
  return {__esModule: true, default: MockAERLayout};
});

// 5. LiquidGlassCard (named export) — render children only.
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  const LiquidGlassCard = ({children}: any) => (
    <View testID="liquid-glass-card">{children}</View>
  );
  return {LiquidGlassCard};
});

// 6. RowButton (named export) — expose label, value and onPress for assertions.
jest.mock('@/shared/components/common/RowButton', () => {
  const {Text, TouchableOpacity} = require('react-native');
  const RowButton = ({label, value, onPress}: any) => (
    <TouchableOpacity testID={`row-${label}`} onPress={onPress}>
      <Text testID={`row-label-${label}`}>{label}</Text>
      <Text testID={`row-value-${label}`}>{value}</Text>
    </TouchableOpacity>
  );
  return {RowButton};
});

// 7. Separator (named export)
jest.mock('@/shared/components/common/Separator', () => {
  const {View} = require('react-native');
  const Separator = () => <View testID="separator" />;
  return {Separator};
});

// --- Helpers ---

const setupState = (user: any) => {
  mockUseSelector.mockImplementation((selector: any) =>
    selector({auth: {user}}),
  );
};

const renderScreen = () =>
  render(<Step2Screen navigation={mockNavigation} route={{} as any} />);

const rowValue = (utils: any, label: string) =>
  utils.getByTestId(`row-value-${label}`).props.children;

// --- Test Suite ---

describe('Step2Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetParent.mockReturnValue({navigate: mockParentNavigate});
  });

  it('renders the header, title, subtitle, banner and Next button (happy path)', () => {
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

    const utils = renderScreen();
    const {getByText, getByTestId} = utils;

    // Layout wiring
    expect(getByText('Step 2 of 5')).toBeTruthy();
    expect(getByTestId('layout-back')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();

    // Screen copy
    expect(getByText('Who is reporting?')).toBeTruthy();
    expect(getByText(/Prefilled from your account/)).toBeTruthy();

    // Helper banner (globally-mocked Ionicons renders as icon-<name>)
    expect(getByTestId('icon-lock-closed-outline')).toBeTruthy();
    expect(
      getByText('Shared only with the recipients you picked in step 1.'),
    ).toBeTruthy();

    // Mapped row values (left branches of the ?? / ternary logic)
    expect(rowValue(utils, 'First name')).toBe('John');
    expect(rowValue(utils, 'Last name')).toBe('Doe');
    expect(rowValue(utils, 'Phone number')).toBe('123456');
    expect(rowValue(utils, 'Email address')).toBe('john@example.com');
    expect(rowValue(utils, 'Currency')).toBe('GBP');
    expect(rowValue(utils, 'Address')).toBe('123 Main St');
    expect(rowValue(utils, 'City')).toBe('London');
    expect(rowValue(utils, 'State/Province')).toBe('Greater London');
    expect(rowValue(utils, 'Postal code')).toBe('SW1');
    expect(rowValue(utils, 'Country')).toBe('UK');

    // Date is formatted with the exact same options (timezone-independent).
    const expectedDob = new Date('1990-01-01T00:00:00.000Z').toLocaleDateString(
      'en-US',
      {day: '2-digit', month: 'short', year: 'numeric'},
    );
    expect(rowValue(utils, 'Date of birth')).toBe(expectedDob);
    expect(expectedDob.length).toBeGreaterThan(0);
  });

  it('renders a separator between every row except the last (11 rows -> 10 separators)', () => {
    setupState({firstName: 'A'});
    const {getAllByTestId} = renderScreen();
    expect(getAllByTestId('separator')).toHaveLength(10);
  });

  it('falls back to empty strings and the resolved currency when the user is null', () => {
    setupState(null);
    const utils = renderScreen();

    expect(rowValue(utils, 'First name')).toBe('');
    expect(rowValue(utils, 'Last name')).toBe('');
    expect(rowValue(utils, 'Phone number')).toBe('');
    expect(rowValue(utils, 'Email address')).toBe('');
    // With no profile currency and no address, PreferencesContext resolves
    // EUR. This row used to print a hardcoded 'USD' and disagree with the
    // Preferences screen for the same user.
    expect(rowValue(utils, 'Currency')).toBe('EUR');
    expect(rowValue(utils, 'Date of birth')).toBe('');
    expect(rowValue(utils, 'Address')).toBe('');
    expect(rowValue(utils, 'City')).toBe('');
    expect(rowValue(utils, 'State/Province')).toBe('');
    expect(rowValue(utils, 'Postal code')).toBe('');
    expect(rowValue(utils, 'Country')).toBe('');
  });

  it('handles a user present with no address, no currency and no dateOfBirth', () => {
    // Exercises the middle branches: authUser present but address/currency/dob nullish.
    setupState({firstName: 'Jane'});
    const utils = renderScreen();

    expect(rowValue(utils, 'First name')).toBe('Jane');
    // With no profile currency and no address, PreferencesContext resolves
    // EUR. This row used to print a hardcoded 'USD' and disagree with the
    // Preferences screen for the same user.
    expect(rowValue(utils, 'Currency')).toBe('EUR');
    expect(rowValue(utils, 'Date of birth')).toBe('');
    expect(rowValue(utils, 'Address')).toBe('');
    expect(rowValue(utils, 'City')).toBe('');
    expect(rowValue(utils, 'State/Province')).toBe('');
    expect(rowValue(utils, 'Postal code')).toBe('');
    expect(rowValue(utils, 'Country')).toBe('');
  });

  it('navigates back when the layout Back button is pressed', () => {
    setupState({});
    const {getByTestId} = renderScreen();
    fireEvent.press(getByTestId('layout-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to Step3 when the Next button is pressed', () => {
    setupState({});
    const {getByTestId} = renderScreen();
    fireEvent.press(getByTestId('layout-next'));
    expect(mockNavigate).toHaveBeenCalledWith('Step3');
  });

  it('navigates to the parent EditParentOverview when a row is pressed', () => {
    setupState({firstName: 'John'});
    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('row-First name'));

    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'EditParentOverview',
      params: {companionId: 'parent'},
    });
  });

  it('does not crash or navigate when getParent() returns undefined', () => {
    mockGetParent.mockReturnValueOnce(undefined);
    setupState({firstName: 'John'});
    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('row-First name'));

    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).not.toHaveBeenCalled();
  });
});
