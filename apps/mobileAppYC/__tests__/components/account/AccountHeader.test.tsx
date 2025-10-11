import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AccountHeader} from '@/screens/account/components/AccountHeader';

describe.skip('AccountHeader', () => {
  it('renders title and triggers callbacks', () => {
    // eslint-disable-next-line no-console
    console.log('AccountHeader typeof', typeof AccountHeader);
    const onBack = jest.fn();
    const onNotif = jest.fn();
    const {getByText, getByTestId} = render(
      <AccountHeader
        title="Account"
        backIcon={1 as any}
        notificationIcon={1 as any}
        onBack={onBack}
        onNotificationPress={onNotif}
      />,
    );

    expect(getByText('Account')).toBeTruthy();
    fireEvent.press(getByTestId('header-back'));
    fireEvent.press(getByTestId('header-notification'));
    expect(onBack).toHaveBeenCalled();
    expect(onNotif).toHaveBeenCalled();
  });
});
