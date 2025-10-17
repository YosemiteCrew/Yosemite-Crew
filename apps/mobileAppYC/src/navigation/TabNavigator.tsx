import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {TabParamList} from './types';
import {AppointmentsScreen, TasksScreen} from '@/screens';
import {HomeStackNavigator} from './HomeStackNavigator';
import {DocumentStackNavigator} from './DocumentStackNavigator';
import {FloatingTabBar} from './FloatingTabBar';
import {useTheme} from '../hooks';

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
      <Tab.Screen name="Appointments" component={AppointmentsScreen} />
      <Tab.Screen
        name="DocumentStack"
        component={DocumentStackNavigator}
        options={{headerShown: false}}
      />
      <Tab.Screen name="Tasks" component={TasksScreen} />
    </Tab.Navigator>
  );
};
