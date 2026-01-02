import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {FloatingTabBar} from '../../src/navigation/FloatingTabBar';
import {Platform} from 'react-native';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';

// --- Mocks ---
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 20}),
}));

jest.mock('@callstack/liquid-glass', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassView: (props: any) => (
      <View testID="liquid-glass-view" {...props} />
    ),
    isLiquidGlassSupported: true,
  };
});

jest.mock('@/assets/images', () => ({
  Images: {
    navigation: {
      home: {focused: 1, light: 2},
      appointments: {focused: 3, light: 4},
      documents: {focused: 5, light: 6},
      tasks: {focused: 7, light: 8},
    },
  },
}));

// Mock @react-navigation/native to control getFocusedRouteNameFromRoute
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    getFocusedRouteNameFromRoute: jest.fn(),
  };
});

// Helper to generate props
const createProps = (index = 0, routes: any[] = []) => {
  const defaultRoutes = [
    {key: 'home-key', name: 'HomeStack'},
    {key: 'appt-key', name: 'Appointments'},
  ];

  return {
    state: {
      index,
      routes: routes.length ? routes : defaultRoutes,
      key: 'tab-key',
      routeNames: (routes.length ? routes : defaultRoutes).map(r => r.name),
      type: 'tab',
      stale: false,
      history: [],
    },
    descriptors: {},
    navigation: {
      emit: jest.fn(() => ({defaultPrevented: false})),
      navigate: jest.fn(),
    },
    insets: {top: 0, right: 0, bottom: 0, left: 0},
  };
};

describe('FloatingTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS
  });

  describe('Rendering', () => {
    it('renders all tabs correctly on iOS', () => {
      const props: any = createProps();
      // Mock route name resolution to return root by default so tabs show
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText, queryByTestId} = render(<FloatingTabBar {...props} />);

      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Bookings')).toBeTruthy();
      // iOS should render LiquidGlassView when supported
      expect(queryByTestId('liquid-glass-view')).toBeTruthy();
    });

    it('renders LiquidGlassView on Android if supported', () => {
      Platform.OS = 'android';
      const props: any = createProps();
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {queryByTestId} = render(<FloatingTabBar {...props} />);

      // Android should fall back to View because glass is iOS-only
      expect(queryByTestId('liquid-glass-view')).toBeNull();
    });
  });

  describe('Visibility Logic (shouldHideTabBar)', () => {
    it('is VISIBLE when on root screen of a stack', () => {
      // Case: Appointments tab is active, looking at 'MyAppointments' (Root)
      const route = {
        key: 'appt-key',
        name: 'Appointments',
        state: {
          index: 0,
          routeNames: ['MyAppointments', 'BookingForm'],
          routes: [{key: 'r1', name: 'MyAppointments'}],
        },
      };
      const props: any = createProps(0, [route]);

      // Mock the utility to return 'MyAppointments'
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(
        'MyAppointments',
      );

      const {getByText} = render(<FloatingTabBar {...props} />);
      expect(getByText('Bookings')).toBeTruthy();
    });

    it('is HIDDEN when on non-root screen of a stack', () => {
      // Case: Appointments tab active, looking at 'BookingForm' (Not Root)
      const route = {
        key: 'appt-key',
        name: 'Appointments',
        state: {
          index: 1,
          routes: [
            {key: 'r1', name: 'MyAppointments'},
            {key: 'r2', name: 'BookingForm'},
          ],
        },
      };
      const props: any = createProps(0, [route]);

      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(
        'BookingForm',
      );

      const {queryByText} = render(<FloatingTabBar {...props} />);
      expect(queryByText('Bookings')).toBeNull();
    });

    it('is VISIBLE when route has no state (default assumption)', () => {
      const route = {key: 'home-key', name: 'HomeStack'}; // No child state
      const props: any = createProps(0, [route]);

      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText} = render(<FloatingTabBar {...props} />);
      expect(getByText('Home')).toBeTruthy();
    });

    it('handles param-based nested route name (Hidden case)', () => {
      // Logic: (focusedRoute.params as {screen?: string})?.screen
      const route = {
        key: 'tasks-key',
        name: 'Tasks',
        params: {screen: 'SomeDetailScreen'}, // Not 'TasksMain'
      };
      const props: any = createProps(0, [route]);

      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {queryByText} = render(<FloatingTabBar {...props} />);
      // 'SomeDetailScreen' != 'TasksMain' -> Hidden
      expect(queryByText('Tasks')).toBeNull();
    });

    it('handles param-based nested route name (Root/Visible match)', () => {
      const route = {
        key: 'tasks-key',
        name: 'Tasks',
        params: {screen: 'TasksMain'}, // Matches root
      };
      const props: any = createProps(0, [route]);

      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText} = render(<FloatingTabBar {...props} />);
      expect(getByText('Tasks')).toBeTruthy();
    });

    it('returns false if focusedRoute is undefined (Empty state coverage)', () => {
      const props: any = createProps();
      props.state.routes = []; // Empty
      props.state.index = 0;

      const {toJSON} = render(<FloatingTabBar {...props} />);
      // It renders the wrapper view but with no tabs
      expect(toJSON()).not.toBeNull();
    });

    it('returns false if rootScreenName is not in map (Unknown tab coverage)', () => {
      const route = {key: 'unknown', name: 'UnknownTab'};
      const props: any = createProps(0, [route]);
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText} = render(<FloatingTabBar {...props} />);
      // Should show bar using fallback config
      expect(getByText('UnknownTab')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    beforeEach(() => {
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);
    });

    it('navigates to root screen when inactive tab pressed', () => {
      const props: any = createProps(0); // Index 0 selected (Home)
      const {getByText} = render(<FloatingTabBar {...props} />);

      // Press Appointments (Index 1)
      props.navigation.emit.mockReturnValue({defaultPrevented: false});

      fireEvent.press(getByText('Bookings'));

      expect(props.navigation.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tabPress',
          target: 'appt-key',
        }),
      );

      // Should navigate to Appointments -> MyAppointments (from ROOT_ROUTE_MAP)
      expect(props.navigation.navigate).toHaveBeenCalledWith('Appointments', {
        screen: 'MyAppointments',
      });
    });

    it('navigates to route name only if root screen not defined in map', () => {
      const route = {key: 'other', name: 'Other'}; // Not in ROOT_ROUTE_MAP
      const props: any = createProps(0, [{key: 'h', name: 'HomeStack'}, route]);

      const {getByText} = render(<FloatingTabBar {...props} />);

      props.navigation.emit.mockReturnValue({defaultPrevented: false});
      fireEvent.press(getByText('Other'));

      expect(props.navigation.navigate).toHaveBeenCalledWith('Other');
    });

    it('does NOT navigate if already focused', () => {
      const props: any = createProps(0); // Home focused
      const {getByText} = render(<FloatingTabBar {...props} />);

      fireEvent.press(getByText('Home'));

      expect(props.navigation.emit).toHaveBeenCalled(); // Event emitted
      expect(props.navigation.navigate).not.toHaveBeenCalled(); // No nav
    });

    it('does NOT navigate if event prevented', () => {
      const props: any = createProps(0);
      const {getByText} = render(<FloatingTabBar {...props} />);

      props.navigation.emit.mockReturnValue({defaultPrevented: true});

      fireEvent.press(getByText('Bookings'));

      expect(props.navigation.navigate).not.toHaveBeenCalled();
    });
  });
});
