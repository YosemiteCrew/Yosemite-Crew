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

const Tab = createBottomTabNavigator<TabParamList>();

const renderFloatingTabBar = (props: BottomTabBarProps) => (
  <FloatingTabBar {...props} />
);

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
        listeners={({navigation, route}) => ({
          tabPress: e => {
            const state = navigation.getState();
            const tabRoute = state.routes.find(r => r.name === route.name);
            const nestedState = tabRoute && 'state' in tabRoute ? (tabRoute.state as any) : null;
            if (nestedState?.type === 'stack' && nestedState.routes.length > 1) {
              e.preventDefault();
              navigation.dispatch({
                ...StackActions.popToTop(),
                target: nestedState.key,
              });
              navigation.navigate(route.name as any);
            }
          },
        })}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentStackNavigator}
        options={{headerShown: false}}
      />
      <Tab.Screen name="Tasks" component={TaskStackNavigator} options={{headerShown: false}} />
    </Tab.Navigator>
  );
};
