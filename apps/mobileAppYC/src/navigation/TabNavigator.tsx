import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {TabParamList} from './types';
import AppointmentStackNavigator from './AppointmentStackNavigator';
import {HomeStackNavigator} from './HomeStackNavigator';
import {DocumentStackNavigator} from './DocumentStackNavigator';
import {TaskStackNavigator} from './TaskStackNavigator';
import {FloatingTabBar} from './FloatingTabBar';
import {useTheme} from '../hooks';
import {StackActions} from '@react-navigation/native';
type NestedNavState = {
  key?: string;
  index?: number;
  routes: Array<{ name: string }>;
};

const isNestedState = (s: unknown): s is NestedNavState =>
  !!s && typeof s === 'object' && Array.isArray((s as any).routes);

const Tab = createBottomTabNavigator<TabParamList>();

const renderFloatingTabBar = (props: BottomTabBarProps) => (
  <FloatingTabBar {...props} />
);

const createTabPressListener = (
  navigation: any,
  route: { name: keyof TabParamList }
) => ({
  tabPress: (e: any) => {
    const state = navigation.getState();
    const tabRoute = state.routes.find((r: any) => r.name === route.name);
    const nestedState = tabRoute && 'state' in tabRoute ? tabRoute.state : null;

    // If the nested stack has more than 1 route, pop to the top
    if (isNestedState(nestedState) && nestedState.routes.length > 1) {
      e.preventDefault();
      // Pop to top of the nested stack (target that stack specifically)
      const targetKey = nestedState.key;
      if (targetKey) {
        navigation.dispatch({
          ...StackActions.popToTop(),
          target: targetKey,
        });
      } else {
        navigation.dispatch(
          StackActions.popToTop()
        );
      }
      return;
    }

    // If nested stack has exactly 1 route but it's not the initial screen,
    // navigate to the known initial route for that tab.
    if (isNestedState(nestedState) && nestedState.routes.length === 1) {
      const currentRouteName = nestedState.routes[nestedState.index || 0]?.name;
      // Map of tab name -> initial screen name of its stack
      const initialByTab: Partial<Record<keyof TabParamList, string>> = {
        Tasks: 'TasksMain',
        Appointments: 'MyAppointments',
      };
      const expectedInitial = initialByTab[route.name];
      if (expectedInitial && currentRouteName && currentRouteName !== expectedInitial) {
        e.preventDefault();
        navigation.navigate(route.name, {screen: expectedInitial});
      }
    }
  },
});

export const TabNavigator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <Tab.Navigator
      tabBar={renderFloatingTabBar}
      screenOptions={{
        headerStyle: {backgroundColor: theme.colors.background},
        headerShadowVisible: false,
        headerTintColor: theme.colors.secondary,
        headerTitleStyle: {
          fontFamily: theme.typography.screenTitle.fontFamily,
          fontSize: theme.typography.screenTitle.fontSize,
          fontWeight: theme.typography.screenTitle.fontWeight,
        },
      }}>
      <Tab.Screen
        name="HomeStack"
        component={HomeStackNavigator}
        options={{headerShown: false}}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentStackNavigator}
        options={{headerShown: false}}
        listeners={({navigation, route}) => createTabPressListener(navigation, route)}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentStackNavigator}
        options={{headerShown: false}}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{headerShown: false, unmountOnBlur: true}}
        listeners={({navigation, route}) => createTabPressListener(navigation, route)}
      />
    </Tab.Navigator>
  );
};
