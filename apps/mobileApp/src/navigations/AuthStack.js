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
  ConfirmSignUp,
  VerifyOtp,
  CongratulationsScreen,
  AddAddress,
  Terms,
  Privacy,
} from './screens';
import getScreenOptions from '../helpers/screenOptions';
import {useTranslation} from 'react-i18next';

const Stack = createStackNavigator();

const AuthStack = () => {
  const {t} = useTranslation();
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
      name: 'VerifyOtp',
      component: VerifyOtp,
      title: 'Sign In',
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
    {
      name: 'CongratulationsScreen',
      component: CongratulationsScreen,
      title: 'CongratulationsScreen',
      headerShown: false,
    },
    {
      name: 'AddAddress',
      component: AddAddress,
      title: 'Create an account',
    },
    {
      name: 'Terms',
      component: Terms,
      titleKey: 'terms_cond_string',
    },
    {
      name: 'Privacy',
      component: Privacy,
      titleKey: 'privacy_policy_string',
    },
  ];
  return (
    <Stack.Navigator>
      {screens.map(({name, component, title, headerShown, titleKey}) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          // options={{headerShown: false}}
          options={props =>
            getScreenOptions({
              ...props,
              title: titleKey ? t(titleKey) : title || '',
              headerShown: headerShown !== undefined ? headerShown : true,
            })
          }
        />
      ))}
    </Stack.Navigator>
  );
};

export default AuthStack;
