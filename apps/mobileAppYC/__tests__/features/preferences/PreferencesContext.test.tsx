import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Pressable, Text} from 'react-native';
import {
  PreferencesProvider,
  usePreferences,
} from '@/features/preferences/PreferencesContext';

const createStore = (country?: string | null) =>
  configureStore({
    reducer: {
      auth: (
        state = {user: country === undefined ? null : {address: {country}}},
      ) => state,
    },
  });

// A user object with no `address` key exercises the optional-chaining
// short-circuit on `user?.address?.country`.
const createStoreWithoutAddress = () =>
  configureStore({
    reducer: {
      auth: (state = {user: {}}) => state,
    },
  });

const Consumer: React.FC = () => {
  const {measurementSystem, weightUnit, distanceUnit} = usePreferences();
  return (
    <Text testID="prefs">
      {measurementSystem}|{weightUnit}|{distanceUnit}
    </Text>
  );
};

// Reads every value (including currency) and exposes the setters so tests can
// exercise the override branches and the default no-op setters.
const OverrideConsumer: React.FC = () => {
  const {
    measurementSystem,
    weightUnit,
    distanceUnit,
    currency,
    setWeightUnit,
    setDistanceUnit,
    setCurrency,
  } = usePreferences();
  return (
    <>
      <Text testID="prefs">
        {measurementSystem}|{weightUnit}|{distanceUnit}|{currency}
      </Text>
      <Pressable testID="set-weight" onPress={() => setWeightUnit('lbs')} />
      <Pressable testID="set-distance" onPress={() => setDistanceUnit('mi')} />
      <Pressable testID="set-currency" onPress={() => setCurrency('USD')} />
    </>
  );
};

describe('PreferencesContext', () => {
  it('defaults to metric/kg/km when there is no authenticated user', () => {
    const store = createStore(undefined);
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <Consumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe('metric|kg|km');
  });

  it('defaults to metric when the user has no country set', () => {
    const store = createStore(null);
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <Consumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe('metric|kg|km');
  });

  it('defaults to metric when the user has no address at all', () => {
    const store = createStoreWithoutAddress();
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <Consumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe('metric|kg|km');
  });

  it('resolves imperial distance units (weight stays kg) for imperial countries', () => {
    const store = createStore('United States');
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <Consumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe('imperial|kg|mi');
  });

  it('resolves metric for a non-imperial country', () => {
    const store = createStore('Germany');
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <Consumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe('metric|kg|km');
  });

  it('derives EUR for metric and USD for imperial accounts', () => {
    const metricStore = createStore('Germany');
    const metric = render(
      <Provider store={metricStore}>
        <PreferencesProvider>
          <OverrideConsumer />
        </PreferencesProvider>
      </Provider>,
    );
    expect(metric.getByTestId('prefs').props.children.join('')).toBe(
      'metric|kg|km|EUR',
    );

    const imperialStore = createStore('United States');
    const imperial = render(
      <Provider store={imperialStore}>
        <PreferencesProvider>
          <OverrideConsumer />
        </PreferencesProvider>
      </Provider>,
    );
    expect(imperial.getByTestId('prefs').props.children.join('')).toBe(
      'imperial|kg|mi|USD',
    );
  });

  it('applies explicit weight, distance, and currency overrides over locale defaults', () => {
    const store = createStore('Germany');
    const {getByTestId} = render(
      <Provider store={store}>
        <PreferencesProvider>
          <OverrideConsumer />
        </PreferencesProvider>
      </Provider>,
    );

    expect(getByTestId('prefs').props.children.join('')).toBe(
      'metric|kg|km|EUR',
    );

    fireEvent.press(getByTestId('set-weight'));
    fireEvent.press(getByTestId('set-distance'));
    fireEvent.press(getByTestId('set-currency'));

    // measurementSystem still follows the account country; the unit/currency
    // values now reflect the explicit overrides.
    expect(getByTestId('prefs').props.children.join('')).toBe(
      'metric|lbs|mi|USD',
    );
  });

  it('provides the default context value when used without a Provider', () => {
    const {getByTestId} = render(<OverrideConsumer />);
    expect(getByTestId('prefs').props.children.join('')).toBe(
      'metric|kg|km|EUR',
    );

    // The default context setters are no-ops: pressing must not throw or change
    // the rendered values.
    fireEvent.press(getByTestId('set-weight'));
    fireEvent.press(getByTestId('set-distance'));
    fireEvent.press(getByTestId('set-currency'));

    expect(getByTestId('prefs').props.children.join('')).toBe(
      'metric|kg|km|EUR',
    );
  });
});
