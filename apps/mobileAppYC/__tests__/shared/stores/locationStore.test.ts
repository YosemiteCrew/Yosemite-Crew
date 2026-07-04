jest.mock('@/shared/services/LocationService', () => ({
  __esModule: true,
  default: {
    getLocationWithRetry: jest.fn(),
  },
}));

import {renderHook, act} from '@testing-library/react-native';
import LocationService from '@/shared/services/LocationService';
import {useLocationStore} from '@/shared/stores/locationStore';

const mockGetLocation = LocationService.getLocationWithRetry as jest.Mock;

describe('useLocationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves coordinates when LocationService succeeds', async () => {
    mockGetLocation.mockResolvedValue({latitude: 37.77, longitude: -122.43});
    const {result} = renderHook(() => useLocationStore());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toEqual({latitude: 37.77, longitude: -122.43});
  });

  it('does not start LocationService when disabled', () => {
    const {result} = renderHook(() => useLocationStore(false));

    expect(result.current).toBeNull();
    expect(mockGetLocation).not.toHaveBeenCalled();
  });

  it('returns the same value from concurrent hook consumers', () => {
    const {result: r1} = renderHook(() => useLocationStore());
    const {result: r2} = renderHook(() => useLocationStore());
    expect(r1.current).toEqual(r2.current);
  });

  it('unmounts cleanly without throwing', () => {
    const {unmount} = renderHook(() => useLocationStore());
    expect(() => unmount()).not.toThrow();
  });

  it('returns either null or a valid coords object', () => {
    const {result} = renderHook(() => useLocationStore());
    const value = result.current;
    if (value !== null) {
      expect(typeof value.latitude).toBe('number');
      expect(typeof value.longitude).toBe('number');
    }
  });

  it('allows multiple subscribes and unsubscribes without throwing', () => {
    const {unmount: u1} = renderHook(() => useLocationStore());
    const {unmount: u2} = renderHook(() => useLocationStore());
    expect(() => {
      u1();
      u2();
    }).not.toThrow();
  });
});
