import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {TabParamList} from './types';
import {HomeScreen} from '../screens/home';
import {PetNavigator} from './PetNavigator';
import {ProfileScreen} from '../screens';
import {useTheme} from '../hooks';

const Tab = createBottomTabNavigator<TabParamList>();

export const TabNavigator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: theme.typography.h4.fontFamily,
          fontSize: theme.typography.h4.fontSize,
          fontWeight: theme.typography.h4.fontWeight,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: theme.typography.labelSmall.fontFamily,
          fontSize: theme.typography.labelSmall.fontSize,
          fontWeight: theme.typography.labelSmall.fontWeight,
        },
        headerShadowVisible: false,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: () => null, // Add your icon component here
        }}
      />
      <Tab.Screen
        name="Pets"
        component={PetNavigator}
        options={{
          title: 'Pets',
          headerShown: false,
          tabBarIcon: () => null, // Add your icon component here
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: () => null, // Add your icon component here
        }}
      />
    </Tab.Navigator>
  );
};