import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AccountMenuList} from '@/screens/account/components/AccountMenuList';

describe.skip('AccountMenuList', () => {
  it('renders items and calls onItemPress', () => {
    const onPress = jest.fn();
    const items = [
      {id: 'faqs', label: 'FAQs', icon: 1 as any},
      {id: 'delete', label: 'Delete Account', icon: 1 as any, danger: true},
    ];

    const {getByText} = render(
      <AccountMenuList items={items} onItemPress={onPress} rightArrowIcon={1 as any} />,
    );

    expect(getByText('FAQs')).toBeTruthy();
    expect(getByText('Delete Account')).toBeTruthy();
    fireEvent.press(getByText('Delete Account'));
    expect(onPress).toHaveBeenCalledWith('delete');
  });
});
