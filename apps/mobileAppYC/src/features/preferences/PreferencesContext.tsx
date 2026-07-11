import React, {createContext, use, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {
  getMeasurementSystemFromCountryName,
  getWeightUnit,
  getDistanceUnit,
  type MeasurementSystem,
  type WeightUnit,
  type DistanceUnit,
} from '@/shared/utils/measurementSystem';
import type {CurrencyCode} from '@/shared/utils/currency';

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
  const user = useSelector((state: RootState) => state.auth.user);

  // Explicit user selections override the locale-derived defaults. When unset,
  // values follow the account country exactly as before.
  const [weightOverride, setWeightOverride] = useState<WeightUnit | null>(null);
  const [distanceOverride, setDistanceOverride] = useState<DistanceUnit | null>(
    null,
  );
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(
    null,
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
      setWeightUnit: setWeightOverride,
      setDistanceUnit: setDistanceOverride,
      setCurrency: setCurrencyOverride,
    };
  }, [
    user?.address?.country,
    weightOverride,
    distanceOverride,
    currencyOverride,
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
