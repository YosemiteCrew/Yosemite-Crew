import React, {createContext, useContext, useMemo} from 'react';
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

interface PreferencesContextValue {
  measurementSystem: MeasurementSystem;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  measurementSystem: 'metric',
  weightUnit: 'kg',
  distanceUnit: 'km',
});

export const PreferencesProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);

  const value = useMemo(() => {
    const countryName = user?.address?.country;
    const measurementSystem = getMeasurementSystemFromCountryName(countryName);
    const weightUnit = getWeightUnit(measurementSystem);
    const distanceUnit = getDistanceUnit(measurementSystem);

    return {
      measurementSystem,
      weightUnit,
      distanceUnit,
    };
  }, [user?.address?.country]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};
