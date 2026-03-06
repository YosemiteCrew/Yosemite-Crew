import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TabNavigator} from '../../src/navigation/TabNavigator';
import {useSelector} from 'react-redux';
import {Alert, ToastAndroid, Platform} from 'react-native';
import {selectSelectedCompanionId} from '../../src/features/companion';

// --- Mocks ---

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockGetState = jest.fn();

// Mock StackActions explicitly
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: jest.fn(),
    StackActions: {
      popToTop: jest.fn(() => ({type: 'POP_TO_TOP'})),
    },
  };
});

// FIX: Require React and View/Text INSIDE the mock factory to avoid ReferenceError
jest.mock('@react-navigation/bottom-tabs', () => {
  const {View, Text} = require('react-native');

  return {
    createBottomTabNavigator: () => ({
      Navigator: ({children}: any) => <>{children}</>,
      Screen: ({listeners, name}: any) => {
        const onPress = (e: any) => {
          if (listeners) {
            const l = listeners({
              navigation: {
                navigate: mockNavigate,
                dispatch: mockDispatch,
                getState: mockGetState,
              },
              route: {name},
            });
            if (l && l.tabPress) {
              l.tabPress(e);
            }
          }
        };
        return (
          <View testID={`tab-${name}`} onTouchEnd={onPress}>
            <Text>{name}</Text>
          </View>
        );
      },
    }),
  };
});

// Mock child navigators
jest.mock(
  '../..//src/navigation/AppointmentStackNavigator',
  () => 'AppointmentStackNavigator',
);
jest.mock(
  '../../src/navigation/HomeStackNavigator',
  () => 'HomeStackNavigator',
);
jest.mock(
  '../../src/navigation/DocumentStackNavigator',
  () => 'DocumentStackNavigator',
);
jest.mock(
  '../../src/navigation/TaskStackNavigator',
  () => 'TaskStackNavigator',
);
jest.mock('../../src/navigation/FloatingTabBar', () => ({
  FloatingTabBar: () => 'FloatingTabBar',
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

jest.mock('../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {background: 'white', secondary: 'black'},
      typography: {screenTitle: {fontFamily: 'Arial', fontSize: 16}},
    },
  }),
}));

jest.mock('../../src/features/companion', () => ({
  selectSelectedCompanionId: jest.fn(),
}));

jest.spyOn(Alert, 'alert');
jest.spyOn(ToastAndroid, 'show');

describe('TabNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSelector as unknown as jest.Mock).mockImplementation();
  });

  // =========================================================================
  // 1. Rendering
  // =========================================================================
  describe('Rendering', () => {
    it('renders all tab screens', () => {
      const {getByTestId} = render(<TabNavigator />);
      expect(getByTestId('tab-HomeStack')).toBeTruthy();
      expect(getByTestId('tab-Appointments')).toBeTruthy();
      expect(getByTestId('tab-Documents')).toBeTruthy();
      expect(getByTestId('tab-Tasks')).toBeTruthy();
    });
  });

  // =========================================================================
  // 2. Navigation Logic
  // =========================================================================
  describe('Tab Press Navigation Logic', () => {
    const setupDeepStackState = (tabName: string, deep = true) => {
      mockGetState.mockReturnValue({
        index: 0,
        routes: [
          {
            name: tabName,
            state: {
              index: deep ? 1 : 0,
              key: 'stack-key-1',
              routes: [
                {name: 'RootScreen'},
                ...(deep ? [{name: 'DetailScreen'}] : []),
              ],
            },
          },
        ],
      });
    };

    it('pops to top if tab is already focused and stack is deep', () => {
      setupDeepStackState('Tasks', true);
      const {getByTestId} = render(<TabNavigator />);

      const tab = getByTestId('tab-Tasks');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'POP_TO_TOP',
          target: 'stack-key-1',
        }),
      );
    });

    it('navigates to initial screen if tab focused, stack is shallow but wrong screen', () => {
      mockGetState.mockReturnValue({
        index: 0,
        routes: [
          {
            name: 'Tasks',
            state: {
              index: 0,
              routes: [{name: 'SomeOtherScreen'}],
            },
          },
        ],
      });

      const {getByTestId} = render(<TabNavigator />);
      const tab = getByTestId('tab-Tasks');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('Tasks', {screen: 'TasksMain'});
    });

    it('does nothing if navigating to same tab and already at correct root', () => {
      mockGetState.mockReturnValue({
        index: 0,
        routes: [
          {
            name: 'Tasks',
            state: {
              index: 0,
              routes: [{name: 'TasksMain'}],
            },
          },
        ],
      });

      const {getByTestId} = render(<TabNavigator />);
      const tab = getByTestId('tab-Tasks');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Permission Guards
  // =========================================================================
  describe('Permission Guards', () => {
    const mockStateWithPermissions = (permissions: any, role = 'SECONDARY') => {
      (useSelector as unknown as jest.Mock).mockImplementation(
        (selector: any) => {
          const state = {
            companion: {companions: [{id: 'c1'}]},
            coParent: {
              accessByCompanionId: {
                c1: {role, permissions},
              },
              defaultAccess: null,
              lastFetchedRole: null,
              lastFetchedPermissions: null,
            },
          };

          if (selector === selectSelectedCompanionId) {
            return 'c1';
          }

          try {
            return selector(state);
          } catch (error) {
            return null;
          }
        },
      );
    };

    it('allows navigation if user is PRIMARY parent', () => {
      mockStateWithPermissions({}, 'PRIMARY');
      const {getByTestId} = render(<TabNavigator />);

      const tab = getByTestId('tab-Appointments');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('allows navigation if permission is granted', () => {
      mockStateWithPermissions({appointments: true}, 'SECONDARY');
      const {getByTestId} = render(<TabNavigator />);

      const tab = getByTestId('tab-Appointments');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('blocks navigation and shows alert if permission denied (iOS)', () => {
      Platform.OS = 'ios';
      mockStateWithPermissions({appointments: false}, 'SECONDARY');

      const {getByTestId} = render(<TabNavigator />);
      const tab = getByTestId('tab-Appointments');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission needed',
        expect.stringContaining("don't have access to appointments"),
      );
    });

    it('blocks navigation and shows toast if permission denied (Android)', () => {
      Platform.OS = 'android';
      mockStateWithPermissions({tasks: false}, 'SECONDARY');

      const {getByTestId} = render(<TabNavigator />);
      const tab = getByTestId('tab-Tasks');
      const preventDefault = jest.fn();

      fireEvent(tab, 'touchEnd', {preventDefault});

      expect(preventDefault).toHaveBeenCalled();
      expect(ToastAndroid.show).toHaveBeenCalled();
    });
  });
});
