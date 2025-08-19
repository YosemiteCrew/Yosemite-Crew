import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import getScreenOptions from '../helpers/screenOptions';
import PetProfileList from '../screens/Auth/petList';
import {useTranslation} from 'react-i18next';

const Stack = createStackNavigator();

const MyPetStack = ({navigation, route}) => {
  const {t} = useTranslation();
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="PetProfileList"
          component={PetProfileList}
          options={props =>
            getScreenOptions({
              ...props,
              title: t('your_companions_string'),
            })
          }
        />
      </Stack.Navigator>
    </>
  );
};

export default MyPetStack;
