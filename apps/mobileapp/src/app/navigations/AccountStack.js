import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import getScreenOptions from '../helpers/screenOptions';
import Account from '../screens/Home/AccountTab/account';

const Stack = createStackNavigator();

const AccountStack = ({navigation, route}) => {
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="Account"
          component={Account}
          options={props =>
            getScreenOptions({
              ...props,
              title: 'Account',
            })
          }
        />
      </Stack.Navigator>
    </>
  );
};

export default AccountStack;
