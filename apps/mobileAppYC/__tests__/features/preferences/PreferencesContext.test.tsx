import React from 'react';
import {render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Text} from 'react-native';
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

const Consumer: React.FC = () => {
  const {measurementSystem, weightUnit, distanceUnit} = usePreferences();
  return (
    <Text testID="prefs">
      {measurementSystem}|{weightUnit}|{distanceUnit}
    </Text>
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

  it('provides the default context value when used without a Provider', () => {
    const {getByTestId} = render(<Consumer />);
    expect(getByTestId('prefs').props.children.join('')).toBe('metric|kg|km');
  });
});
