import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {PetStackParamList} from './types';
import {PetListScreen, PetDetailsScreen, AddPetScreen} from '../screens/pets';
import {useTheme} from '../hooks';

const Stack = createNativeStackNavigator<PetStackParamList>();

export const PetNavigator: React.FC = () => {
  const {theme} = useTheme();

  return (
    <Stack.Navigator
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
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="PetList"
        component={PetListScreen}
        options={{
          title: 'My Pets',
        }}
      />
      <Stack.Screen
        name="PetDetails"
        component={PetDetailsScreen}
        options={{
          title: 'Pet Details',
        }}
      />
      <Stack.Screen
        name="AddPet"
        component={AddPetScreen}
        options={{
          title: 'Add Pet',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};