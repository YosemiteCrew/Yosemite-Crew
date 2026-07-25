import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {SearchDropdownWithBackdrop} from '@/shared/components/common/SearchDropdownOverlay/SearchDropdownWithBackdrop';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockSearchDropdownOverlay = jest.fn();
jest.mock(
  '@/shared/components/common/SearchDropdownOverlay/SearchDropdownOverlay',
  () => {
    const {View} = require('react-native');
    return {
      SearchDropdownOverlay: (props: any) => {
        mockSearchDropdownOverlay(props);
        return <View testID="search-dropdown-overlay" />;
      },
    };
  },
);

describe('SearchDropdownWithBackdrop', () => {
  const baseProps = {
    visible: true,
    items: [{id: '1', name: 'Item 1'}],
    keyExtractor: (item: any) => item.id,
    onPress: jest.fn(),
    title: (item: any) => item.name,
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when visible is false', () => {
    const {queryByTestId} = render(
      <SearchDropdownWithBackdrop {...baseProps} visible={false} />,
    );
    expect(queryByTestId('search-dropdown-overlay')).toBeNull();
  });

  it('renders the backdrop and overlay when visible is true', () => {
    const {getByTestId} = render(<SearchDropdownWithBackdrop {...baseProps} />);
    expect(getByTestId('search-dropdown-overlay')).toBeTruthy();
  });

  it('calls onDismiss when the backdrop is pressed', () => {
    const {UNSAFE_getByProps} = render(
      <SearchDropdownWithBackdrop {...baseProps} />,
    );
    fireEvent.press(UNSAFE_getByProps({onPress: baseProps.onDismiss}));
    expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('hides the invisible backdrop from screen readers', () => {
    const {UNSAFE_getByProps} = render(
      <SearchDropdownWithBackdrop {...baseProps} />,
    );
    const backdrop = UNSAFE_getByProps({onPress: baseProps.onDismiss});
    expect(backdrop.props.accessible).toBe(false);
  });

  it('merges the dropdown style with a provided containerStyle', () => {
    render(
      <SearchDropdownWithBackdrop
        {...baseProps}
        containerStyle={{marginTop: 10}}
      />,
    );

    expect(mockSearchDropdownOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        containerStyle: expect.objectContaining({marginTop: 10}),
      }),
    );
  });

  it('passes through overlay-only props without onDismiss', () => {
    render(<SearchDropdownWithBackdrop {...baseProps} />);

    const passedProps = mockSearchDropdownOverlay.mock.calls[0][0];
    expect(passedProps.onDismiss).toBeUndefined();
    expect(passedProps.items).toEqual(baseProps.items);
  });
});
