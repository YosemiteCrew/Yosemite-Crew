import React from 'react';
import {render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';
import {AppointmentsScreen} from '@/screens/appointments/AppointmentsScreen';

const withProviders = (ui: React.ReactElement) => <Provider store={store}>{ui}</Provider>;

describe('AppointmentsScreen (RNTL)', () => {
  it('renders title and subtitle', () => {
    const {getByText} = render(withProviders(<AppointmentsScreen />));
    expect(getByText('Appointments')).toBeTruthy();
    expect(getByText(/upcoming veterinary visits/i)).toBeTruthy();
  });
});

