import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {render} from '@testing-library/react-native';

import {PressableOpacity} from '../PressableOpacity';
import {getPressableOpacityStyle} from '../pressableOpacityStyles';

describe('PressableOpacity', () => {
  it('composes object styles with pressed opacity', () => {
    const {getByText} = render(
      <PressableOpacity
        activeOpacity={0.6}
        style={styles.button}
        testID="pressable">
        <Text>Open</Text>
      </PressableOpacity>,
    );
    const pressableStyle = getPressableOpacityStyle({
      activeOpacity: 0.6,
      style: styles.button,
    });

    expect(getByText('Open')).toBeTruthy();
    expect(pressableStyle({pressed: false})).toEqual([styles.button, null]);
    expect(pressableStyle({pressed: true})).toEqual([
      styles.button,
      {opacity: 0.6},
    ]);
  });

  it('composes callback styles and skips opacity while disabled', () => {
    const style = ({pressed}: {pressed: boolean}) => ({
      opacity: pressed ? 0.4 : 1,
    });

    const pressableStyle = getPressableOpacityStyle({
      activeOpacity: 0.2,
      disabled: true,
      style,
    });

    expect(pressableStyle({pressed: true})).toEqual([{opacity: 0.4}, null]);
  });

  it('uses the default active opacity when no style is provided', () => {
    const {getByText} = render(
      <PressableOpacity>
        <Text>Default</Text>
      </PressableOpacity>,
    );
    const pressableStyle = getPressableOpacityStyle({
      activeOpacity: 0.2,
    });

    expect(getByText('Default')).toBeTruthy();
    expect(pressableStyle({pressed: true})).toEqual([
      undefined,
      {opacity: 0.2},
    ]);
  });
});

const styles = StyleSheet.create({
  button: {
    padding: 12,
  },
});
