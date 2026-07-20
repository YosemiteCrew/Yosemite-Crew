import type {WeightUnit, DistanceUnit} from '@/shared/utils/measurementSystem';
import type {CurrencyCode} from '@/shared/utils/currency';

export interface PreferencesState {
  weightOverride: WeightUnit | null;
  distanceOverride: DistanceUnit | null;
  currencyOverride: CurrencyCode | null;
}
