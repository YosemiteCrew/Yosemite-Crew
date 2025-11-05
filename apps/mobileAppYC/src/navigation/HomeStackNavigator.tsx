import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {AccountScreen} from '@/features/account/screens/AccountScreen';
import {HomeScreen} from '@/features/home/screens';
import {AddCompanionScreen} from '@/features/companion/screens/AddCompanionScreen';
import {HomeStackParamList} from './types';
import {ProfileOverviewScreen} from '@/features/companion/screens/ProfileOverviewScreen';
import { CompanionOverviewScreen } from '@/features/companion/screens/CompanionOverviewScreen';
import { EditParentScreen } from '@/features/account/screens/EditParentScreen';
import {ExpenseStackNavigator} from './ExpenseStackNavigator';
import {LinkedBusinessesStackNavigator} from './LinkedBusinessesStackNavigator';
import {FAQScreen} from '@/features/support/screens/FAQScreen';
import {ContactUsScreen} from '@/features/support/screens/ContactUsScreen';
import {TermsAndConditionsScreen} from '@/features/legal/screens/TermsAndConditionsScreen';
import {PrivacyPolicyScreen} from '@/features/legal/screens/PrivacyPolicyScreen';
import {CoParentsScreen} from '@/features/coParent/screens/CoParentsScreen/CoParentsScreen';
import {AddCoParentScreen} from '@/features/coParent/screens/AddCoParentScreen/AddCoParentScreen';
import {EditCoParentScreen} from '@/features/coParent/screens/EditCoParentScreen/EditCoParentScreen';
import {CoParentProfileScreen} from '@/features/coParent/screens/CoParentProfileScreen/CoParentProfileScreen';
import {AdverseEventStackNavigator} from './AdverseEventStackNavigator';

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
        name="FAQ"
        component={FAQScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
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
      <Stack.Screen
        name="LinkedBusinesses"
        component={LinkedBusinessesStackNavigator}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AdverseEvent"
        component={AdverseEventStackNavigator}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CoParents"
        component={CoParentsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddCoParent"
        component={AddCoParentScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EditCoParent"
        component={EditCoParentScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CoParentProfile"
        component={CoParentProfileScreen}
        options={{headerShown: false}}
      />

    </Stack.Navigator>
  );
};
