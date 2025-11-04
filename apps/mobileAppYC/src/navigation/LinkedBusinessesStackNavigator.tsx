import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {BusinessSearchScreen} from '@/features/linkedBusinesses/screens/BusinessSearchScreen';
import {BusinessDetailsScreen} from '@/features/linkedBusinesses/screens/BusinessDetailsScreen';
import {QRScannerScreen} from '@/features/linkedBusinesses/screens/QRScannerScreen';
import type {LinkedBusinessStackParamList} from './types';

const Stack = createNativeStackNavigator<LinkedBusinessStackParamList>();

export const LinkedBusinessesStackNavigator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <Stack.Navigator
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
      <Stack.Screen
        name="BusinessSearch"
        component={BusinessSearchScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="BusinessDetails"
        component={BusinessDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};
