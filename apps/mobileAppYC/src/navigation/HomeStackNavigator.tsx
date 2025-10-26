import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {AccountScreen, HomeScreen} from '@/screens';
import {AddCompanionScreen} from '@/screens/companion/AddCompanionScreen';
import {HomeStackParamList} from './types';
import {ProfileOverviewScreen} from '@/screens/companion/ProfileOverviewScreen';
import { CompanionOverviewScreen } from '@/screens/companion/CompanionOverviewScreen';
import { EditParentScreen } from '@/screens/account/EditParentScreen';
import {ExpenseStackNavigator} from './ExpenseStackNavigator';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStackNavigator: React.FC = () => {
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
        name="Home"
        component={HomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddCompanion"
        component={AddCompanionScreen}
        options={{headerShown: false}}
      />
        <Stack.Screen
        name="ProfileOverview"
        component={ProfileOverviewScreen}
        options={{headerShown: false}}
      />

         <Stack.Screen
        name="EditCompanionOverview" // Renamed for clarity in navigation
        component={CompanionOverviewScreen}
        options={{headerShown: false}}
      />

        <Stack.Screen
        name="EditParentOverview" // Renamed for clarity in navigation
        component={EditParentScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ExpensesStack"
        component={ExpenseStackNavigator}
        options={{headerShown: false}}
      />
      
      
    </Stack.Navigator>
  );
};
