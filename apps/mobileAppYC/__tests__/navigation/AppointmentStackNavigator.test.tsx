import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {render} from '@testing-library/react-native';
import {AppointmentStackNavigator} from '@/navigation/AppointmentStackNavigator';

// --- Mocks ---

// 1. Redux Mock
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// 2. Navigation Mock
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      reset: mockReset,
    }),
    useRoute: () => mockUseRoute(),
  };
});

// 3. Stack Navigator Mock
// FIX: Use require('react-native') inside the factory to avoid hoisting reference errors.
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: any) => {
      const {View} = require('react-native');
      return <View testID="MockNavigator">{children}</View>;
    },
    Screen: ({name, component: Component}: any) => {
      const {View} = require('react-native');
      // Only render "MyAppointments" immediately to test the Entry component logic
      if (name === 'MyAppointments' && Component) {
        return <Component />;
      }
      return <View testID={`Screen-${name}`} />;
    },
  }),
}));

// 4. Screen Component Mocks
// FIX: Use require('react-native') inside all mock factories.

jest.mock('@/features/appointments/screens/MyAppointmentsEmptyScreen', () => ({
  MyAppointmentsEmptyScreen: () => {
    const {View} = require('react-native');
    return <View testID="MyAppointmentsEmptyScreen" />;
  },
}));

jest.mock('@/features/appointments/screens/MyAppointmentsScreen', () => ({
  MyAppointmentsScreen: () => {
    const {View} = require('react-native');
    return <View testID="MyAppointmentsScreen" />;
  },
}));

jest.mock('@/features/appointments/screens/BrowseBusinessesScreen', () => ({
  BrowseBusinessesScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/BusinessDetailsScreen', () => ({
  BusinessDetailsScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/BookingFormScreen', () => ({
  BookingFormScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/ViewAppointmentScreen', () => ({
  ViewAppointmentScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/payments', () => ({
  PaymentInvoiceScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
  PaymentSuccessScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/ReviewScreen', () => ({
  ReviewScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/ChatScreen', () => ({
  ChatScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/chat/screens/ChatChannelScreen', () => ({
  ChatChannelScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/EditAppointmentScreen', () => ({
  EditAppointmentScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

jest.mock('@/features/appointments/screens/BusinessesListScreen', () => ({
  BusinessesListScreen: () => {
    const {View} = require('react-native');
    return <View />;
  },
}));

describe('AppointmentStackNavigator', () => {
  const mockState = {
    companion: {selectedCompanionId: 'comp-123'},
    appointments: {
      items: [
        {id: 'apt-1', companionId: 'comp-123'}, // Match
        {id: 'apt-2', companionId: 'other-456'}, // No Match
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Route params
    mockUseRoute.mockReturnValue({params: {}});

    // Default Selector Logic
    mockUseSelector.mockImplementation(callback => {
      return callback(mockState);
    });
  });

  const renderNavigator = () => {
    return render(
      <NavigationContainer>
        <AppointmentStackNavigator />
      </NavigationContainer>,
    );
  };

  describe('Navigation Configuration', () => {
    it('renders the navigator and defines all screens', () => {
      const {getByTestId} = renderNavigator();
      // The mock navigator renders "MyAppointments" by default logic in mock setup
      // And renders placeholders for others. Checking existence verifies the tree.
      expect(getByTestId('MockNavigator')).toBeTruthy();
    });
  });

  describe('MyAppointmentsEntry (Router Component)', () => {
    it('renders MyAppointmentsScreen when user has appointments for selected companion', () => {
      // State has apt-1 matching comp-123
      renderNavigator();

      expect(mockUseSelector).toHaveBeenCalled();
      // Expect the main screen, NOT the empty screen
      const {queryByTestId} = renderNavigator();
      expect(queryByTestId('MyAppointmentsScreen')).toBeTruthy();
      expect(queryByTestId('MyAppointmentsEmptyScreen')).toBeNull();
    });

    it('renders MyAppointmentsEmptyScreen when user has NO appointments for selected companion', () => {
      // Change selector to return a different ID that matches nothing
      const emptyState = {
        ...mockState,
        companion: {selectedCompanionId: 'comp-999'}, // No matching appointments
      };

      mockUseSelector.mockImplementation(callback => callback(emptyState));

      const {queryByTestId} = renderNavigator();

      expect(queryByTestId('MyAppointmentsEmptyScreen')).toBeTruthy();
      expect(queryByTestId('MyAppointmentsScreen')).toBeNull();
    });

    it('renders MyAppointmentsScreen when NO companion is selected but appointments exist', () => {
      // Case: selectedCompanionId is undefined/null, should check if ANY appointments exist
      const nullCompanionState = {
        ...mockState,
        companion: {selectedCompanionId: null},
      };

      mockUseSelector.mockImplementation(callback =>
        callback(nullCompanionState),
      );

      const {queryByTestId} = renderNavigator();
      expect(queryByTestId('MyAppointmentsScreen')).toBeTruthy();
    });

    it('renders MyAppointmentsEmptyScreen when NO companion selected and NO appointments exist', () => {
      const absoluteEmptyState = {
        companion: {selectedCompanionId: null},
        appointments: {items: []},
      };

      mockUseSelector.mockImplementation(callback =>
        callback(absoluteEmptyState),
      );

      const {queryByTestId} = renderNavigator();
      expect(queryByTestId('MyAppointmentsEmptyScreen')).toBeTruthy();
    });
  });

  describe('Reset Navigation Logic', () => {
    it('resets navigation state when resetKey param is present', () => {
      mockUseRoute.mockReturnValue({
        params: {resetKey: '12345'},
      });

      renderNavigator();

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{name: 'MyAppointments'}],
      });
    });

    it('does NOT reset navigation when resetKey is undefined', () => {
      mockUseRoute.mockReturnValue({
        params: {someOtherParam: 'test'}, // resetKey missing
      });

      renderNavigator();

      expect(mockReset).not.toHaveBeenCalled();
    });

    it('does NOT reset navigation when params object is undefined', () => {
      mockUseRoute.mockReturnValue({
        params: undefined,
      });

      renderNavigator();

      expect(mockReset).not.toHaveBeenCalled();
    });
  });
});
