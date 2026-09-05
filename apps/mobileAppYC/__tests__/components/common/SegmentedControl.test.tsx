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

  // The selected state is carried by the border, not by the fill. The
  // component's own note records why: screen and inset are near-identical, so
  // the background alone conveys nothing, and the card shadow that used to
  // carry it does not read on a dark ground. Deleting borderWidth and
  // borderColor from segmentActive left this suite, PreferencesScreen and
  // Step5Screen all green at 37/37 - the accessibility fix shipped without
  // anything that would notice it going away.
  //
  // borderColor is compared against the mock theme's own token rather than a
  // literal, and the token is in the mock for this assertion to mean anything:
  // without it both sides are undefined and the check passes on a component
  // that names no colour at all.
  it('carries the selected state on the border, not only the fill', () => {
    const {getByTestId} = render(
      <SegmentedControl
        testID="seg"
        options={options}
        value="upcoming"
        onChange={jest.fn()}
      />,
    );
    const activeStyle = StyleSheet.flatten(
      getByTestId('seg-upcoming').props.style,
    );
    const inactiveStyle = StyleSheet.flatten(
      getByTestId('seg-past').props.style,
    );

    expect(activeStyle.borderWidth).toBe(1);
    expect(activeStyle.borderColor).toBe(
      mockTheme.colors.segmentSelectedBorder,
    );
    expect(mockTheme.colors.segmentSelectedBorder).toBeDefined();
    expect(inactiveStyle.borderWidth).toBeUndefined();
    expect(inactiveStyle.borderColor).toBeUndefined();
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
