import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';
import {useTheme} from '@/shared/hooks/useTheme';
import {Text, TouchableOpacity, View} from 'react-native';

const withProviders = (ui: React.ReactElement) => (
  <Provider store={store}>{ui}</Provider>
);

const Probe: React.FC = () => {
  const {themeMode, isDark, darkModeLocked, setTheme, toggleTheme} = useTheme();
  return (
    <View>
      <Text testID="mode">{themeMode}</Text>
      <Text testID="dark">{String(isDark)}</Text>
      <Text testID="locked">{String(darkModeLocked)}</Text>
      <TouchableOpacity accessibilityLabel="toggle" onPress={toggleTheme}>
        <Text>toggle</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="set-dark"
        onPress={() => setTheme('dark')}>
        <Text>set-dark</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="set-light"
        onPress={() => setTheme('light')}>
        <Text>set-light</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="set-system"
        onPress={() => setTheme('system')}>
        <Text>set-system</Text>
      </TouchableOpacity>
    </View>
  );
};

describe('useTheme (dark mode enabled)', () => {
  it('is unlocked and switches between light and espresso dark', () => {
    const utils = render(withProviders(<Probe />));
    const getText = (id: string) => utils.getByTestId(id).props.children;

    expect(getText('locked')).toBe('false');

    fireEvent.press(utils.getByLabelText('set-dark'));
    expect(getText('mode')).toBe('dark');
    expect(getText('dark')).toBe('true');

    fireEvent.press(utils.getByLabelText('set-light'));
    expect(getText('mode')).toBe('light');
    expect(getText('dark')).toBe('false');

    // Toggle flips light -> dark.
    fireEvent.press(utils.getByLabelText('toggle'));
    expect(getText('dark')).toBe('true');

    // System mode resolves against the OS appearance.
    fireEvent.press(utils.getByLabelText('set-system'));
    expect(getText('mode')).toBe('system');
  });
});
