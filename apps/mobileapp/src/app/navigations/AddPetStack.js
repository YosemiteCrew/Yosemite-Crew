import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  CreatePetProfile,
  ChooseYourPet,
  AddPetDetails,
  MorePetDetails,
  PetProfileList,
  PetSummary,
  AddBreederDetails,
  GroomerDetails,
  PetBoardingDetails,
  VeterinaryDetails,
} from './screens';
import getScreenOptions from '../helpers/screenOptions';

const Stack = createStackNavigator();

const AddPetStack = () => {
  const screens = [
    {
      name: 'CreatePetProfile',
      component: CreatePetProfile,
      title: 'Create Pet Profile',
      headerShown: false,
    },
    {
      name: 'ChooseYourPet',
      component: ChooseYourPet,
      title: '',
    },
    {
      name: 'AddPetDetails',
      component: AddPetDetails,
      title: 'Add Pet Details',
      headerShown: false,
    },
    {
      name: 'MorePetDetails',
      component: MorePetDetails,
      title: 'More Pet Details',
      headerShown: false,
    },
    {
      name: 'PetProfileList',
      component: PetProfileList,
      title: 'Pet Profile List',
      headerShown: false,
    },
    {
      name: 'PetSummary',
      component: PetSummary,
      title: 'Pet Summary',
      headerShown: false,
    },
    {
      name: 'AddBreederDetails',
      component: AddBreederDetails,
      title: 'Add Breeder Details',
      headerShown: false,
    },
    {
      name: 'GroomerDetails',
      component: GroomerDetails,
      title: 'Groomer Details',
      headerShown: false,
    },
    {
      name: 'PetBoardingDetails',
      component: PetBoardingDetails,
      title: 'Pet Boarding Details',
      headerShown: false,
    },
    {
      name: 'VeterinaryDetails',
      component: VeterinaryDetails,
      title: 'Veterinary Details',
      headerShown: false,
    },
  ];
  return (
    <Stack.Navigator>
      {screens.map(({ name, component, title, headerShown }) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          // options={{headerShown: false}}
          options={(props) =>
            getScreenOptions({
              ...props,
              title: title || '',
              headerShown: headerShown !== undefined ? headerShown : true,
            })
          }
        />
      ))}
    </Stack.Navigator>
  );
};

export default AddPetStack;
