import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import * as Redux from 'react-redux';
import MyAppointmentsEmptyScreen from '@/features/appointments/screens/MyAppointmentsEmptyScreen';
import {setSelectedCompanion} from '@/features/companion';

const mockNavigate = jest.fn();
// The companion CTA hops to a sibling stack via getParent(), so the navigation
// double needs it: without getParent the handler throws instead of navigating.
const mockParentNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: () => ({navigate: mockParentNavigate}),
  }),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    addIconDark: {uri: 'add-icon'},
    emptyAppointments: {uri: 'empty-appointments'},
    emptyTasksIllustration: {uri: 'empty-tasks'},
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="liquid-glass-header-screen">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, rightIcon, onRightPress}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        {rightIcon && (
          <TouchableOpacity testID="header-add-btn" onPress={onRightPress}>
            <Text>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      CompanionSelector: ({companions, onSelect}: any) => (
        <View testID="companion-selector">
          {companions.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              testID={`select-${c.id}`}
              onPress={() => onSelect(c.id)}>
              <Text>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
    };
  },
);

const mockDispatch = jest.fn();

describe('MyAppointmentsEmptyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
  });

  it('points at the companion prerequisite when there are no companions', () => {
    jest
      .spyOn(Redux, 'useSelector')
      .mockImplementation((selectorFn: any) =>
        selectorFn({companion: {companions: [], selectedCompanionId: null}}),
      );

    const {getByText, queryByTestId} = render(<MyAppointmentsEmptyScreen />);

    expect(getByText('Add a companion to get started')).toBeTruthy();
    expect(queryByTestId('companion-selector')).toBeNull();
    expect(queryByTestId('header-add-btn')).toBeNull();
  });

  it('offers a way forward rather than a dead end when there are no companions', () => {
    jest
      .spyOn(Redux, 'useSelector')
      .mockImplementation((selectorFn: any) =>
        selectorFn({companion: {companions: [], selectedCompanionId: null}}),
      );

    const {getByText, queryByText} = render(<MyAppointmentsEmptyScreen />);

    expect(
      getByText(
        'Visits are booked for a companion. Add one first to start booking.',
      ),
    ).toBeTruthy();
    // Booking needs a companion, so the CTA points there instead of vanishing.
    expect(queryByText('Book an appointment')).toBeNull();
    expect(getByText('Add a companion')).toBeTruthy();
  });

  // Asserting the CTA renders is not enough: before this, the screen offered no
  // action at all with no companion, so the value is in where pressing it goes.
  it('sends the companion CTA to AddCompanion on the home stack', () => {
    jest
      .spyOn(Redux, 'useSelector')
      .mockImplementation((selectorFn: any) =>
        selectorFn({companion: {companions: [], selectedCompanionId: null}}),
      );

    const {getByText} = render(<MyAppointmentsEmptyScreen />);
    fireEvent.press(getByText('Add a companion'));

    expect(mockParentNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'AddCompanion',
    });
    // It must cross to the parent, not push onto the appointments stack.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the companion selector and add button when companions exist', () => {
    jest.spyOn(Redux, 'useSelector').mockImplementation((selectorFn: any) =>
      selectorFn({
        companion: {
          companions: [{id: 'c1', name: 'Rex'}],
          selectedCompanionId: 'c1',
        },
      }),
    );

    const {getByTestId} = render(<MyAppointmentsEmptyScreen />);

    expect(getByTestId('companion-selector')).toBeTruthy();
    expect(getByTestId('header-add-btn')).toBeTruthy();
  });

  it('navigates to BrowseBusinesses when the add button is pressed', () => {
    jest.spyOn(Redux, 'useSelector').mockImplementation((selectorFn: any) =>
      selectorFn({
        companion: {
          companions: [{id: 'c1', name: 'Rex'}],
          selectedCompanionId: 'c1',
        },
      }),
    );

    const {getByTestId} = render(<MyAppointmentsEmptyScreen />);
    fireEvent.press(getByTestId('header-add-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('BrowseBusinesses');
  });

  it('dispatches setSelectedCompanion when a companion is selected', () => {
    jest.spyOn(Redux, 'useSelector').mockImplementation((selectorFn: any) =>
      selectorFn({
        companion: {
          companions: [{id: 'c1', name: 'Rex'}],
          selectedCompanionId: 'c1',
        },
      }),
    );

    const {getByTestId} = render(<MyAppointmentsEmptyScreen />);
    fireEvent.press(getByTestId('select-c1'));

    expect(mockDispatch).toHaveBeenCalledWith(setSelectedCompanion('c1'));
  });
});
