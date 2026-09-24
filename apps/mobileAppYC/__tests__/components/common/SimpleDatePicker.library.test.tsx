import React from 'react';
import {Platform} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {SimpleDatePicker} from '../../../src/shared/components/common/SimpleDatePicker/SimpleDatePicker';

/*
 * SimpleDatePicker.test.tsx fires the picker's props by hand. This file runs the
 * library's own JS instead, stubbing only the native modules, so it proves the
 * listeners we pass are the ones the library calls for each native outcome:
 * a picked date, a dismissal and (Android) the neutral button.
 */

const mockDialog: {result: Record<string, unknown>} = {result: {}};

// A declaration, not a const: jest.mock factories run before module-level
// consts initialise, and a function declaration is hoisted with its body.
function mockNativeModule() {
  return {
    __esModule: true,
    default: {
      open: jest.fn(async () => mockDialog.result),
      dismiss: jest.fn(async () => true),
    },
  };
}

jest.mock(
  '@react-native-community/datetimepicker/src/specs/NativeModuleDatePicker',
  () => mockNativeModule(),
);
jest.mock(
  '@react-native-community/datetimepicker/src/specs/NativeModuleTimePicker',
  () => mockNativeModule(),
);
jest.mock(
  '@react-native-community/datetimepicker/src/specs/NativeModuleMaterialDatePicker',
  () => mockNativeModule(),
);
jest.mock(
  '@react-native-community/datetimepicker/src/specs/NativeModuleMaterialTimePicker',
  () => mockNativeModule(),
);

// Jest resolves './picker' to the iOS file; Android needs its dialog pickers.
jest.mock('@react-native-community/datetimepicker/src/picker', () => {
  const actual = jest.requireActual(
    '@react-native-community/datetimepicker/src/picker',
  );
  const pickers = {
    date: jest.requireActual(
      '@react-native-community/datetimepicker/src/datepicker.android.js',
    ).default,
    time: jest.requireActual(
      '@react-native-community/datetimepicker/src/timepicker.android.js',
    ).default,
  };
  const {Platform: platform} = require('react-native');
  return {
    __esModule: true,
    get default() {
      return platform.OS === 'android' ? pickers : actual.default;
    },
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const react = require('react');
  const {Platform: platform} = require('react-native');
  const ios = jest.requireActual(
    '@react-native-community/datetimepicker/src/datetimepicker.ios.js',
  ).default;
  const android = jest.requireActual(
    '@react-native-community/datetimepicker/src/datetimepicker.android.js',
  ).default;
  return {
    __esModule: true,
    default: (props: object) =>
      react.createElement(platform.OS === 'ios' ? ios : android, props),
  };
});

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {__esModule: true, useTheme: () => ({theme, isDark: false})};
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('@callstack/liquid-glass', () => ({
  __esModule: true,
  LiquidGlassView: 'LiquidGlassView',
  isLiquidGlassSupported: false,
}));

const VALUE = new Date('2026-03-01T10:00:00Z');
const PICKED = new Date('2026-04-15T08:30:00Z');

const renderPicker = () => {
  const calls: Array<[string, Date?]> = [];
  const utils = render(
    <SimpleDatePicker
      value={VALUE}
      show
      onDateChange={date => calls.push(['onDateChange', date])}
      onDismiss={() => calls.push(['onDismiss'])}
    />,
  );
  return {calls, utils};
};

describe('SimpleDatePicker against the datetimepicker library', () => {
  let warn: jest.SpyInstance;

  beforeAll(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    warn.mockRestore();
  });

  describe('Android dialog', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('saves a picked date, then closes', async () => {
      mockDialog.result = {
        action: 'dateSetAction',
        timestamp: PICKED.getTime(),
        utcOffset: 0,
      };
      const {calls} = renderPicker();
      await act(async () => {});

      expect(calls).toEqual([['onDateChange', PICKED], ['onDismiss']]);
    });

    it('closes without saving when the dialog is dismissed', async () => {
      mockDialog.result = {action: 'dismissedAction'};
      const {calls} = renderPicker();
      await act(async () => {});

      expect(calls).toEqual([['onDismiss']]);
    });

    it('closes without saving on the neutral button', async () => {
      mockDialog.result = {action: 'neutralButtonAction'};
      const {calls} = renderPicker();
      await act(async () => {});

      expect(calls).toEqual([['onDismiss']]);
    });
  });

  describe('iOS spinner', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    const nativePicker = (utils: ReturnType<typeof render>) =>
      utils.UNSAFE_root.findAll(
        (node: {type: unknown}) => node.type === 'RNDateTimePicker',
      )[0];

    it('keeps a spun date as a draft until Done', async () => {
      const {calls, utils} = renderPicker();

      await act(async () => {
        nativePicker(utils).props.onChange({
          nativeEvent: {timestamp: PICKED.getTime(), utcOffset: 0},
        });
      });
      expect(calls).toEqual([]);

      fireEvent.press(utils.getByTestId('ios-datetime-picker-done'));
      expect(calls).toEqual([['onDateChange', PICKED], ['onDismiss']]);
    });

    it('ignores a native change that carries no date', async () => {
      const {calls, utils} = renderPicker();

      await act(async () => {
        nativePicker(utils).props.onChange({nativeEvent: {utcOffset: 0}});
      });
      fireEvent.press(utils.getByTestId('ios-datetime-picker-done'));

      expect(calls).toEqual([['onDateChange', VALUE], ['onDismiss']]);
    });

    it('closes without saving when the native picker is dismissed', async () => {
      const {calls, utils} = renderPicker();

      await act(async () => {
        nativePicker(utils).props.onPickerDismiss({nativeEvent: null});
      });

      expect(calls).toEqual([['onDismiss']]);
    });
  });

  // Runs last: the library warns once, on first render, if onChange is passed.
  it('never passes the library its deprecated onChange listener', () => {
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('`onChange` is deprecated'),
    );
  });
});
