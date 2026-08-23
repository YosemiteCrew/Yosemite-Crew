import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Pressable, Text} from 'react-native';
import {
  PreferencesProvider,
  usePreferences,
} from '@/features/preferences/PreferencesContext';
import preferencesReducer from '@/features/preferences/preferencesSlice';

const createStore = (country?: string | null) =>
  configureStore({
    reducer: {
      auth: (
        state = {user: country === undefined ? null : {address: {country}}},
      ) => state,
      preferences: preferencesReducer,
    },
  });

// A user object with no `address` key exercises the optional-chaining
// short-circuit on `user?.address?.country`.
const createStoreWithoutAddress = () =>
  configureStore({
    reducer: {
      auth: (state = {user: {}}) => state,
      preferences: preferencesReducer,
    },
  });

const createStoreWithProfileCurrency = (
  currency: string | null,
  country = 'Germany',
) =>
  configureStore({
    reducer: {
      auth: (state = {user: {address: {country}, currency}}) => state,
      preferences: preferencesReducer,
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

  describe('currency precedence', () => {
    // Screens used to write `user.currency ?? resolved`, which put the stored
    // profile field ahead of the Preferences picker and left that picker inert
    // for anyone who had ever set one - while its caption promised it drove
    // expenses and invoices. Precedence now lives here alone.
    it('prefers the profile currency over the country default', () => {
      const {getByTestId} = render(
        <Provider store={createStoreWithProfileCurrency('USD')}>
          <PreferencesProvider>
            <OverrideConsumer />
          </PreferencesProvider>
        </Provider>,
      );

      // Germany would otherwise resolve to EUR.
      expect(getByTestId('prefs').props.children.join('')).toContain('USD');
    });

    it('prefers an explicit override over the profile currency', () => {
      const {getByTestId} = render(
        <Provider store={createStoreWithProfileCurrency('EUR')}>
          <PreferencesProvider>
            <OverrideConsumer />
          </PreferencesProvider>
        </Provider>,
      );
      expect(getByTestId('prefs').props.children.join('')).toContain('EUR');

      fireEvent.press(getByTestId('set-currency'));

      expect(getByTestId('prefs').props.children.join('')).toContain('USD');
    });

    it('ignores a profile currency this app cannot render', () => {
      const {getByTestId} = render(
        <Provider store={createStoreWithProfileCurrency('GBP')}>
          <PreferencesProvider>
            <OverrideConsumer />
          </PreferencesProvider>
        </Provider>,
      );

      // Falls through to the country default rather than handing 'GBP' to
      // anything typed CurrencyCode.
      const rendered = getByTestId('prefs').props.children.join('');
      expect(rendered).toContain('EUR');
      expect(rendered).not.toContain('GBP');
    });
  });
});
