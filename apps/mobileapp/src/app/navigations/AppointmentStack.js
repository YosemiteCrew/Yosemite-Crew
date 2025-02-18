import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import getScreenOptions from '../helpers/screenOptions';
import AppointmentHistory from '../screens/Home/DashboardTab/bookAppointment/appointmentHistory';

const Stack = createStackNavigator();

const AppointmentStack = ({navigation, route}) => {
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="AppointmentHistory"
          component={AppointmentHistory}
          options={props =>
            getScreenOptions({
              ...props,
              title: 'Appointments',
            })
          }
        />
      </Stack.Navigator>
    </>
  );
};

export default AppointmentStack;
