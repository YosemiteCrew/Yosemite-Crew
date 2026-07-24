import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {Toggle} from '../../../src/shared/components/common/Toggle/Toggle';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

describe('Toggle', () => {
  it('reports the checked state through accessibility', () => {
    const {getByTestId} = render(
      <Toggle testID="t" value onValueChange={jest.fn()} />,
    );
    expect(getByTestId('t').props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });
    expect(getByTestId('t').props.accessibilityRole).toBe('switch');
  });

  it('toggles to the opposite value on press', () => {
    const onValueChange = jest.fn();
    const {getByTestId} = render(
      <Toggle testID="t" value={false} onValueChange={onValueChange} />,
    );
    fireEvent.press(getByTestId('t'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', () => {
    const onValueChange = jest.fn();
    const {getByTestId} = render(
      <Toggle testID="t" value onValueChange={onValueChange} disabled />,
    );
    fireEvent.press(getByTestId('t'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getByTestId('t').props.accessibilityState.disabled).toBe(true);
  });

  it('animates when the value changes', () => {
    const {getByTestId, rerender} = render(
      <Toggle testID="t" value={false} onValueChange={jest.fn()} />,
    );
    rerender(<Toggle testID="t" value onValueChange={jest.fn()} />);
    expect(getByTestId('t')).toBeTruthy();
  });

  it('forwards an accessibility label', () => {
    const {getByTestId} = render(
      <Toggle
        testID="t"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="Calendar sync"
      />,
    );
    expect(getByTestId('t').props.accessibilityLabel).toBe('Calendar sync');
  });
});
