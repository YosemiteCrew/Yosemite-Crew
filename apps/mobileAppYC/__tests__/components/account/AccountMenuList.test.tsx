import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Image, ImageSourcePropType} from 'react-native';
import type {ReactTestInstance} from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

import {AccountMenuList} from '@/features/account/components/AccountMenuList';
import {lightTheme} from '@/theme';
import {themeReducer} from '@/features/theme';

const createIcon = (): ImageSourcePropType => 1 as ImageSourcePropType;

const createStore = () =>
  configureStore({
    reducer: {
      theme: themeReducer,
    },
  });

const renderWithStore = (ui: React.ReactElement) =>
  render(<Provider store={createStore()}>{ui}</Provider>);

describe('AccountMenuList', () => {
  it('renders every menu item and calls onItemPress with the tapped id', () => {
    const handlePress = jest.fn();
    const items = [
      {id: 'profile', label: 'Profile', icon: createIcon()},
      {id: 'security', label: 'Security', icon: createIcon()},
    ];

    const {getByLabelText, getByText} = renderWithStore(
      <AccountMenuList items={items} onItemPress={handlePress} />,
    );

    expect(getByText('Profile')).toBeTruthy();
    expect(getByText('Security')).toBeTruthy();

    fireEvent.press(getByLabelText('Security'));
    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(handlePress).toHaveBeenCalledWith('security');
  });

  it('applies danger styles and renders the right arrow when provided', () => {
    const items = [
      {id: 'settings', label: 'Settings', icon: createIcon()},
      {
        id: 'delete',
        label: 'Delete account',
        icon: createIcon(),
        danger: true,
      },
    ];
    const rightArrowIcon = createIcon();

    const {getByText, getByLabelText} = renderWithStore(
      <AccountMenuList
        items={items}
        onItemPress={jest.fn()}
        rightArrowIcon={rightArrowIcon}
      />,
    );

    const dangerLabel = getByText('Delete account');
    const labelStyles = Array.isArray(dangerLabel.props.style)
      ? dangerLabel.props.style
      : [dangerLabel.props.style];
    const hasDangerColor = labelStyles.some(
      style => style?.color === lightTheme.colors.error,
    );
    expect(hasDangerColor).toBe(true);

    const deleteButton = getByLabelText('Delete account') as ReactTestInstance;
    const images = deleteButton.findAllByType(Image);
    expect(images).toHaveLength(2);
    const arrowImage = images[1];
    expect(arrowImage.props.source).toBe(rightArrowIcon);
    const arrowStyles = Array.isArray(arrowImage.props.style)
      ? arrowImage.props.style
      : [arrowImage.props.style];
    const hasDangerTint = arrowStyles.some(
      style => style?.tintColor === lightTheme.colors.error,
    );
    expect(hasDangerTint).toBe(true);
  });

  it('does not render an arrow when rightArrowIcon is not provided', () => {
    const {getByLabelText} = renderWithStore(
      <AccountMenuList
        items={[{id: 'profile', label: 'Profile', icon: createIcon()}]}
        onItemPress={jest.fn()}
      />,
    );

    const profileButton = getByLabelText('Profile') as ReactTestInstance;
    const images = profileButton.findAllByType(Image);
    expect(images).toHaveLength(1);
  });
});
