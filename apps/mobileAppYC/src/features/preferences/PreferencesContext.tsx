import React, {createContext, use, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {
  getMeasurementSystemFromCountryName,
  getWeightUnit,
  getDistanceUnit,
  type MeasurementSystem,
  type WeightUnit,
  type DistanceUnit,
} from '@/shared/utils/measurementSystem';
import type {CurrencyCode} from '@/shared/utils/currency';
import {
  setWeightOverride,
  setDistanceOverride,
  setCurrencyOverride,
} from './preferencesSlice';

interface PreferencesContextValue {
  measurementSystem: MeasurementSystem;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  currency: CurrencyCode;
  setWeightUnit: (unit: WeightUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setCurrency: (currency: CurrencyCode) => void;
}

const noop = () => {};

const PreferencesContext = createContext<PreferencesContextValue>({
  measurementSystem: 'metric',
  weightUnit: 'kg',
  distanceUnit: 'km',
  currency: 'EUR',
  setWeightUnit: noop,
  setDistanceUnit: noop,
  setCurrency: noop,
});

export const PreferencesProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  // Explicit user selections override the locale-derived defaults. When unset,
  // values follow the account country exactly as before. Overrides live in
  // Redux (persisted via redux-persist) so they survive remounts and restarts.
  const weightOverride = useSelector(
    (state: RootState) => state.preferences.weightOverride,
  );
  const distanceOverride = useSelector(
    (state: RootState) => state.preferences.distanceOverride,
  );
  const currencyOverride = useSelector(
    (state: RootState) => state.preferences.currencyOverride,
  );

  const setWeightUnit = useCallback(
    (unit: WeightUnit) => dispatch(setWeightOverride(unit)),
    [dispatch],
  );
  const setDistanceUnit = useCallback(
    (unit: DistanceUnit) => dispatch(setDistanceOverride(unit)),
    [dispatch],
  );
  const setCurrency = useCallback(
    (currencyCode: CurrencyCode) => dispatch(setCurrencyOverride(currencyCode)),
    [dispatch],
  );

  const value = useMemo(() => {
    const countryName = user?.address?.country;
    const measurementSystem = getMeasurementSystemFromCountryName(countryName);
    const weightUnit = getWeightUnit(measurementSystem);
    const distanceUnit = getDistanceUnit(measurementSystem);
    const currency: CurrencyCode =
      measurementSystem === 'imperial' ? 'USD' : 'EUR';

    return {
      measurementSystem,
      weightUnit: weightOverride ?? weightUnit,
      distanceUnit: distanceOverride ?? distanceUnit,
      currency: currencyOverride ?? currency,
      setWeightUnit,
      setDistanceUnit,
      setCurrency,
    };
  }, [
    user?.address?.country,
    weightOverride,
    distanceOverride,
    currencyOverride,
    setWeightUnit,
    setDistanceUnit,
    setCurrency,
  ]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = use(PreferencesContext);
  /* istanbul ignore next -- createContext always supplies a non-null default, so this guard is unreachable. */
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};
