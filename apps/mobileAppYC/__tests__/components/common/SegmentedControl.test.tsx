import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {
  SegmentedControl,
  type SegmentOption,
} from '../../../src/shared/components/common/SegmentedControl/SegmentedControl';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const options: SegmentOption[] = [
  {label: 'Upcoming', value: 'upcoming'},
  {label: 'Past', value: 'past'},
];

describe('SegmentedControl', () => {
  it('renders every segment', () => {
    const {getByText} = render(
      <SegmentedControl
        options={options}
        value="upcoming"
        onChange={jest.fn()}
      />,
    );
    expect(getByText('Upcoming')).toBeTruthy();
    expect(getByText('Past')).toBeTruthy();
  });

  it('marks the active segment as selected and raises it', () => {
    const {getByTestId} = render(
      <SegmentedControl
        testID="seg"
        options={options}
        value="upcoming"
        onChange={jest.fn()}
      />,
    );
    const active = getByTestId('seg-upcoming');
    const inactive = getByTestId('seg-past');
    expect(active.props.accessibilityState).toEqual({selected: true});
    expect(inactive.props.accessibilityState).toEqual({selected: false});
    expect(StyleSheet.flatten(active.props.style).backgroundColor).toBe(
      mockTheme.colors.screen,
    );
  });

  it('fires onChange with the tapped value', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <SegmentedControl
        testID="seg"
        options={options}
        value="upcoming"
        onChange={onChange}
      />,
    );
    fireEvent.press(getByTestId('seg-past'));
    expect(onChange).toHaveBeenCalledWith('past');
  });

  it('exposes a tablist role', () => {
    const {getByTestId} = render(
      <SegmentedControl
        testID="seg"
        options={options}
        value="past"
        onChange={jest.fn()}
      />,
    );
    expect(getByTestId('seg').props.accessibilityRole).toBe('tablist');
  });
});
