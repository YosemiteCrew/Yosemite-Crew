import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import getScreenOptions from '../helpers/screenOptions';
import PetProfileList from '../screens/Auth/petList';

const Stack = createStackNavigator();

const MyPetStack = ({navigation, route}) => {
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="PetProfileList"
          component={PetProfileList}
          options={props =>
            getScreenOptions({
              ...props,
              headerShown: false,
            })
          }
        />
      </Stack.Navigator>
    </>
  );
};

export default MyPetStack;
