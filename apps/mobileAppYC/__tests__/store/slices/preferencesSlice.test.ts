import preferencesReducer, {
  setWeightOverride,
  setDistanceOverride,
  setCurrencyOverride,
} from '@/features/preferences/preferencesSlice';
import type {PreferencesState} from '@/features/preferences/types';

describe('preferencesSlice', () => {
  const initialState: PreferencesState = {
    weightOverride: null,
    distanceOverride: null,
    currencyOverride: null,
  };

  it('should return the initial state', () => {
    const state = preferencesReducer(undefined, {type: 'unknown'});
    expect(state).toEqual(initialState);
  });

  describe('setWeightOverride reducer', () => {
    it('sets an explicit weight override', () => {
      const state = preferencesReducer(initialState, setWeightOverride('lbs'));
      expect(state.weightOverride).toBe('lbs');
    });

    it('clears the weight override', () => {
      const state = preferencesReducer(
        {...initialState, weightOverride: 'lbs'},
        setWeightOverride(null),
      );
      expect(state.weightOverride).toBeNull();
    });
  });

  describe('setDistanceOverride reducer', () => {
    it('sets an explicit distance override', () => {
      const state = preferencesReducer(initialState, setDistanceOverride('mi'));
      expect(state.distanceOverride).toBe('mi');
    });

    it('clears the distance override', () => {
      const state = preferencesReducer(
        {...initialState, distanceOverride: 'mi'},
        setDistanceOverride(null),
      );
      expect(state.distanceOverride).toBeNull();
    });
  });

  describe('setCurrencyOverride reducer', () => {
    it('sets an explicit currency override', () => {
      const state = preferencesReducer(
        initialState,
        setCurrencyOverride('USD'),
      );
      expect(state.currencyOverride).toBe('USD');
    });

    it('clears the currency override', () => {
      const state = preferencesReducer(
        {...initialState, currencyOverride: 'USD'},
        setCurrencyOverride(null),
      );
      expect(state.currencyOverride).toBeNull();
    });
  });

  it('does not mutate unrelated fields when one override changes', () => {
    const state = preferencesReducer(
      {weightOverride: 'lbs', distanceOverride: 'mi', currencyOverride: 'USD'},
      setCurrencyOverride('EUR'),
    );
    expect(state).toEqual({
      weightOverride: 'lbs',
      distanceOverride: 'mi',
      currencyOverride: 'EUR',
    });
  });
});
