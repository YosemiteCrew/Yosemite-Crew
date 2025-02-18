import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import Dashboard from '../screens/Home/DashboardTab/dashboard';
import getScreenOptions from '../helpers/screenOptions';

const Stack = createStackNavigator();

const HomeStack = ({navigation, route}) => {
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="DashBoard"
          component={Dashboard}
          options={props =>
            getScreenOptions({
              ...props,
              title: '',
            })
          }
        />
      </Stack.Navigator>
    </>
  );
};

export default HomeStack;
