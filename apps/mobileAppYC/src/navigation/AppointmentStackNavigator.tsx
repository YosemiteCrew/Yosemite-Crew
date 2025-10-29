import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from './types';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {MyAppointmentsEmptyScreen} from '@/features/appointments/screens/MyAppointmentsEmptyScreen';
import {MyAppointmentsScreen} from '@/features/appointments/screens/MyAppointmentsScreen';
import {BrowseBusinessesScreen} from '@/features/appointments/screens/BrowseBusinessesScreen';
import {BusinessDetailsScreen} from '@/features/appointments/screens/BusinessDetailsScreen';
import {BookingFormScreen} from '@/features/appointments/screens/BookingFormScreen';
import {ViewAppointmentScreen} from '@/features/appointments/screens/ViewAppointmentScreen';
import {PaymentInvoiceScreen, PaymentSuccessScreen} from '@/features/payments';
import {ReviewScreen} from '@/features/appointments/screens/ReviewScreen';
import {ChatScreen} from '@/features/appointments/screens/ChatScreen';
import {EditAppointmentScreen} from '@/features/appointments/screens/EditAppointmentScreen';
import {BusinessesListScreen} from '@/features/appointments/screens/BusinessesListScreen';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

const Stack = createNativeStackNavigator<AppointmentStackParamList>();

// A small router deciding whether to show empty or list
const MyAppointmentsEntry: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentStackParamList>>();
  const route = useRoute<RouteProp<AppointmentStackParamList, 'MyAppointments'>>();
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const hasAny = useSelector((state: RootState) =>
    state.appointments.items.some(a =>
      selectedCompanionId ? a.companionId === selectedCompanionId : true,
    ),
  );
  const resetKey = route.params?.resetKey;

  React.useEffect(() => {
    if (resetKey !== undefined) {
      navigation.reset({
        index: 0,
        routes: [{name: 'MyAppointments'}],
      });
    }
  }, [navigation, resetKey]);

  return hasAny ? <MyAppointmentsScreen /> : <MyAppointmentsEmptyScreen />;
};

export const AppointmentStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MyAppointments" component={MyAppointmentsEntry} />
      <Stack.Screen name="MyAppointmentsEmpty" component={MyAppointmentsEmptyScreen} />
      <Stack.Screen name="BrowseBusinesses" component={BrowseBusinessesScreen} />
      <Stack.Screen name="BusinessDetails" component={BusinessDetailsScreen} />
      <Stack.Screen name="BookingForm" component={BookingFormScreen} />
      <Stack.Screen name="ViewAppointment" component={ViewAppointmentScreen} />
      <Stack.Screen name="PaymentInvoice" component={PaymentInvoiceScreen} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EditAppointment" component={EditAppointmentScreen} />
      <Stack.Screen name="BusinessesList" component={BusinessesListScreen} />
    </Stack.Navigator>
  );
};

export default AppointmentStackNavigator;
