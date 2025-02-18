import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {
  SignupOptions,
  CreateAccount,
  SignIn,
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
  ConfirmSignUp
} from './screens';
import getScreenOptions from '../helpers/screenOptions';

const Stack = createStackNavigator();

const AuthStack = () => {
  const screens = [
    {
      name: 'SignupOptions',
      component: SignupOptions,
      title: 'Signup Options',
      headerShown: false,
    },
    {
      name: 'CreateAccount',
      component: CreateAccount,
      title: 'Create Account',
      headerShown: false,
    },
    {
      name: 'SignIn',
      component: SignIn,
      title: 'Sign In',
      headerShown: false,
    },
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
    {
      name: 'ConfirmSignUp',
      component: ConfirmSignUp,
      title: 'Verify Account',
      headerShown: false,
    },
  ];
  return (
    <Stack.Navigator>
      {screens.map(({name, component, title, headerShown}) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          // options={{headerShown: false}}
          options={props =>
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

export default AuthStack;
