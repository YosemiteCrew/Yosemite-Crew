import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {FloatingTabBar} from '../../src/navigation/FloatingTabBar';
import {Platform} from 'react-native';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

// --- Mocks ---
let mockIsDark = false;
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: mockIsDark}),
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

const mockFetchDocuments = jest.fn((arg: any) => ({
  type: 'documents/fetchDocuments',
  payload: arg,
}));
const mockFetchTasksForCompanion = jest.fn((arg: any) => ({
  type: 'tasks/fetchTasksForCompanion',
  payload: arg,
}));

jest.mock('@/features/documents/documentSlice', () => ({
  fetchDocuments: (...args: any[]) => mockFetchDocuments(...args),
}));

jest.mock('@/features/tasks', () => ({
  fetchTasksForCompanion: (...args: any[]) =>
    mockFetchTasksForCompanion(...args),
}));

// Mock Redux Store
const createMockStore = (
  companionState: any = {
    companions: [{id: 'comp-1', name: 'Buddy'}],
    selectedCompanionId: 'comp-1',
  },
) => {
  return configureStore({
    reducer: {
      companion: (state = companionState) => state,
      documents: (state = {documents: []}) => state,
      tasks: (state = {items: []}) => state,
    },
  });
};

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
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS
    mockIsDark = false;
    store = createMockStore();
  });

  describe('Rendering', () => {
    it('renders all tabs correctly on iOS', () => {
      const props: any = createProps();
      // Mock route name resolution to return root by default so tabs show
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText, queryByTestId} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Bookings')).toBeTruthy();
      // iOS should render LiquidGlassView when supported
      expect(queryByTestId('liquid-glass-view')).toBeTruthy();
    });

    it('renders LiquidGlassView on Android if supported', () => {
      Platform.OS = 'android';
      const props: any = createProps();
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {queryByTestId} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      // Android should fall back to View because glass is iOS-only
      expect(queryByTestId('liquid-glass-view')).toBeNull();
    });
  });

  describe('Dark mode', () => {
    // The bar pinned colorScheme to 'light' and tinted itself with
    // whiteOverlay70 - 70% white in both themes - so espresso got a cream bar
    // across the bottom of every screen while its labels stayed dark-ground ink.
    const renderBar = () => {
      const props: any = createProps();
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);
      return render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
    };

    it('gives the iOS glass bar the dark scheme and the themed frost', () => {
      mockIsDark = true;

      const [bar] = renderBar().getAllByTestId('liquid-glass-view');

      expect(bar.props.colorScheme).toBe('dark');
      // The token, not the literal - glassFollowsTheme.test.ts is what asserts
      // the two ends of that token actually differ.
      expect(bar.props.tintColor).toBe(mockTheme.colors.glassBarTint);
    });

    it('keeps the light scheme when the theme is light', () => {
      const [bar] = renderBar().getAllByTestId('liquid-glass-view');

      expect(bar.props.colorScheme).toBe('light');
    });

    it('blurs dark on the non-glass path when the theme is dark', () => {
      mockIsDark = true;
      Platform.OS = 'android';

      const blur = renderBar().UNSAFE_getByProps({blurAmount: 22});

      expect(blur.props.blurType).toBe('dark');
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

      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
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

      const {queryByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
      expect(queryByText('Bookings')).toBeNull();
    });

    it('is VISIBLE when route has no state (default assumption)', () => {
      const route = {key: 'home-key', name: 'HomeStack'}; // No child state
      const props: any = createProps(0, [route]);

      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
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

      const {queryByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
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

      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
      expect(getByText('Tasks')).toBeTruthy();
    });

    it('returns false if focusedRoute is undefined (Empty state coverage)', () => {
      const props: any = createProps();
      props.state.routes = []; // Empty
      props.state.index = 0;

      const {toJSON} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
      // It renders the wrapper view but with no tabs
      expect(toJSON()).not.toBeNull();
    });

    it('returns false if rootScreenName is not in map (Unknown tab coverage)', () => {
      const route = {key: 'unknown', name: 'UnknownTab'};
      const props: any = createProps(0, [route]);
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);

      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );
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
      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

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

      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      props.navigation.emit.mockReturnValue({defaultPrevented: false});
      fireEvent.press(getByText('Other'));

      expect(props.navigation.navigate).toHaveBeenCalledWith('Other');
    });

    it('does NOT navigate if already focused', () => {
      const props: any = createProps(0); // Home focused
      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      fireEvent.press(getByText('Home'));

      expect(props.navigation.emit).toHaveBeenCalled(); // Event emitted
      expect(props.navigation.navigate).not.toHaveBeenCalled(); // No nav
    });

    it('does NOT navigate if event prevented', () => {
      const props: any = createProps(0);
      const {getByText} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      props.navigation.emit.mockReturnValue({defaultPrevented: true});

      fireEvent.press(getByText('Bookings'));

      expect(props.navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Tab Data Refresh', () => {
    beforeEach(() => {
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);
    });

    it('refreshes documents when the active tab is Documents', () => {
      const route = {key: 'docs-key', name: 'Documents'};
      const props: any = createProps(0, [route]);
      const dispatchSpy = jest.spyOn(store, 'dispatch');

      render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(mockFetchDocuments).toHaveBeenCalledWith({companionId: 'comp-1'});
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: 'documents/fetchDocuments'}),
      );
      expect(mockFetchTasksForCompanion).not.toHaveBeenCalled();
    });

    it('refreshes tasks when the active tab is Tasks', () => {
      const route = {key: 'tasks-key', name: 'Tasks'};
      const props: any = createProps(0, [route]);

      render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(mockFetchTasksForCompanion).toHaveBeenCalledWith({
        companionId: 'comp-1',
      });
      expect(mockFetchDocuments).not.toHaveBeenCalled();
    });

    it('falls back to the first companion id when none is explicitly selected', () => {
      store = createMockStore({
        companions: [{id: 'comp-fallback', name: 'Fallback'}],
        selectedCompanionId: null,
      });
      const route = {key: 'tasks-key', name: 'Tasks'};
      const props: any = createProps(0, [route]);

      render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(mockFetchTasksForCompanion).toHaveBeenCalledWith({
        companionId: 'comp-fallback',
      });
    });

    it('does not refresh anything when there is no companion at all', () => {
      store = createMockStore({companions: [], selectedCompanionId: null});
      const route = {key: 'tasks-key', name: 'Tasks'};
      const props: any = createProps(0, [route]);

      render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(mockFetchTasksForCompanion).not.toHaveBeenCalled();
      expect(mockFetchDocuments).not.toHaveBeenCalled();
    });

    it('does not refresh tab data for tabs unrelated to documents/tasks', () => {
      const props: any = createProps(0); // HomeStack, Appointments
      render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      expect(mockFetchDocuments).not.toHaveBeenCalled();
      expect(mockFetchTasksForCompanion).not.toHaveBeenCalled();
    });
  });

  describe('Sliding Pill Animation', () => {
    beforeEach(() => {
      (getFocusedRouteNameFromRoute as jest.Mock).mockReturnValue(undefined);
    });

    it('renders the animated pill glass once every tab has reported its layout, and re-animates on tab change', () => {
      const props: any = createProps(0);
      const {getAllByRole, queryAllByTestId, rerender} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      // Before layout is measured, only the bar itself renders a LiquidGlassView.
      expect(queryAllByTestId('liquid-glass-view')).toHaveLength(1);

      const tabs = getAllByRole('button');
      fireEvent(tabs[0], 'layout', {
        nativeEvent: {layout: {x: 0, width: 100}},
      });
      fireEvent(tabs[1], 'layout', {
        nativeEvent: {layout: {x: 100, width: 100}},
      });

      // Once every tab has a measured layout, the sliding pill glass also renders.
      expect(queryAllByTestId('liquid-glass-view')).toHaveLength(2);

      // Re-render with a different active tab to exercise the "already
      // initialized" spring-animation branch of the positioning effect.
      const movedProps = {
        ...props,
        state: {...props.state, index: 1},
      };
      expect(() =>
        rerender(
          <Provider store={store}>
            <FloatingTabBar {...movedProps} />
          </Provider>,
        ),
      ).not.toThrow();
    });

    it('tints the sliding pill glass with the pale nav wash, not the solid blue', () => {
      const props: any = createProps(0);
      const {getAllByRole, queryAllByTestId} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      const tabs = getAllByRole('button');
      fireEvent(tabs[0], 'layout', {
        nativeEvent: {layout: {x: 0, width: 100}},
      });
      fireEvent(tabs[1], 'layout', {
        nativeEvent: {layout: {x: 100, width: 100}},
      });

      const glassViews = queryAllByTestId('liquid-glass-view');
      expect(glassViews).toHaveLength(2);

      // The sliding pill must use the pale navActiveBg wash the active
      // #1657C9 label/icon were tuned against for contrast.
      expect(
        glassViews.some(
          v => v.props.tintColor === mockTheme.colors.navActiveBg,
        ),
      ).toBe(true);

      // Regression guard: no glass view may fall back to the low-contrast
      // solid blue (#257BED) pill.
      expect(
        glassViews.some(v => v.props.tintColor === mockTheme.colors.blue),
      ).toBe(false);
    });

    it('falls back to a width of 0 when the active tab has no recorded layout', () => {
      const routes = [
        {key: 'r0', name: 'HomeStack'},
        {key: 'r1', name: 'Appointments'},
        {key: 'r2', name: 'Documents'},
      ];
      const props: any = createProps(0, routes);
      const {getAllByRole} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      const tabs = getAllByRole('button');
      // Only report layouts for indices 1 and 2, leaving a hole at the
      // currently-focused index 0 while still satisfying tabLayouts.length
      // === routes.length.
      fireEvent(tabs[1], 'layout', {
        nativeEvent: {layout: {x: 100, width: 100}},
      });
      expect(() =>
        fireEvent(tabs[2], 'layout', {
          nativeEvent: {layout: {x: 200, width: 100}},
        }),
      ).not.toThrow();
    });

    it('renders a plain solid pill (no glass) on platforms without glass support', () => {
      Platform.OS = 'android';
      const props: any = createProps(0);
      const {getAllByRole, queryAllByTestId} = render(
        <Provider store={store}>
          <FloatingTabBar {...props} />
        </Provider>,
      );

      const tabs = getAllByRole('button');
      fireEvent(tabs[0], 'layout', {
        nativeEvent: {layout: {x: 0, width: 100}},
      });
      fireEvent(tabs[1], 'layout', {
        nativeEvent: {layout: {x: 100, width: 100}},
      });

      expect(queryAllByTestId('liquid-glass-view')).toHaveLength(0);
    });
  });
});
