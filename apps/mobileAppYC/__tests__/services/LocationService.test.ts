import LocationService from '@/services/LocationService';
import Geolocation from '@react-native-community/geolocation';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {Alert, Platform} from 'react-native';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: {
    IOS: {LOCATION_WHEN_IN_USE: 'ios-location'},
    ANDROID: {ACCESS_FINE_LOCATION: 'android-location'},
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
}));

const mockCheck = check as jest.Mock;
const mockRequest = request as jest.Mock;
const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;
const mockWatchPosition = Geolocation.watchPosition as jest.Mock;
const mockClearWatch = Geolocation.clearWatch as jest.Mock;

describe('LocationService', () => {
  let alertSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('permission helpers', () => {
    it('checkLocationPermission returns true when granted', async () => {
      mockCheck.mockResolvedValueOnce(RESULTS.GRANTED);
      const granted = await LocationService.checkLocationPermission();
      expect(granted).toBe(true);
      expect(mockCheck).toHaveBeenCalledWith(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    });

    it('checkLocationPermission returns false when denied', async () => {
      mockCheck.mockResolvedValueOnce(RESULTS.DENIED);
      const granted = await LocationService.checkLocationPermission();
      expect(granted).toBe(false);
    });

    it('requestLocationPermission handles blocked state with alert', async () => {
      mockRequest.mockResolvedValueOnce(RESULTS.BLOCKED);
      const granted = await LocationService.requestLocationPermission();
      expect(granted).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith(
        'Location Permission Required',
        'Please enable location access in your device settings to use this feature.',
        [{text: 'OK'}],
      );
    });

    it('requestLocationPermission resolves true when granted', async () => {
      mockRequest.mockResolvedValueOnce(RESULTS.GRANTED);
      const granted = await LocationService.requestLocationPermission();
      expect(granted).toBe(true);
    });

    it('uses Android permission keys when platform is android', async () => {
      Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
      mockCheck.mockResolvedValueOnce(RESULTS.GRANTED);
      await LocationService.checkLocationPermission();
      expect(mockCheck).toHaveBeenCalledWith(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    });
  });

  describe('getCurrentPosition', () => {
    it('returns coordinates when permission granted', async () => {
      const coords = {latitude: 1, longitude: 2, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null};
      mockCheck.mockResolvedValueOnce(RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((success: any) => {
        success({coords});
      });

      await expect(LocationService.getCurrentPosition()).resolves.toEqual(coords);
      expect(mockGetCurrentPosition).toHaveBeenCalled();
    });

    it('requests permission when not granted and rejects if still denied', async () => {
      mockCheck.mockResolvedValueOnce(RESULTS.DENIED);
      mockRequest.mockResolvedValueOnce(RESULTS.DENIED);

      await expect(LocationService.getCurrentPosition()).rejects.toThrow('Location permission denied');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('passes errors from geolocation to rejection', async () => {
      const error = new Error('timeout');
      mockCheck.mockResolvedValueOnce(RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((_success: any, failure: any) => {
        failure(error);
      });

      await expect(LocationService.getCurrentPosition()).rejects.toThrow('timeout');
    });
  });

  describe('watchPosition', () => {
    it('registers watch and forwards updates', () => {
      const coords = {latitude: 1, longitude: 2, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null};
      const success = jest.fn();
      const error = jest.fn();

      mockWatchPosition.mockImplementation((onSuccess: any, onError: any) => {
        onSuccess({coords});
        onError?.(new Error('fail'));
        return 42;
      });

      LocationService.watchPosition(success, error);
      expect(success).toHaveBeenCalledWith(coords);
      expect(error).toHaveBeenCalledWith(expect.any(Error));
      expect(mockWatchPosition).toHaveBeenCalled();
    });

    it('stopWatching clears watch id', () => {
      mockWatchPosition.mockReturnValue(21);
      LocationService.watchPosition(jest.fn());
      LocationService.stopWatching();
      expect(mockClearWatch).toHaveBeenCalledWith(21);
    });
  });

  describe('getLocationWithRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('resolves immediately when first attempt succeeds', async () => {
      const coords = {latitude: 3, longitude: 4, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null};
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((success: any) => success({coords}));

      await expect(LocationService.getLocationWithRetry()).resolves.toEqual(coords);
    });

    it('retries on failure and alerts when all retries exhausted', async () => {
      const error = new Error('fail');
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((_success: any, failure: any) => failure(error));

      const promise = LocationService.getLocationWithRetry(2);
      await jest.runOnlyPendingTimersAsync();
      await jest.runOnlyPendingTimersAsync();

      await expect(promise).resolves.toBeNull();
      expect(alertSpy).toHaveBeenCalledWith(
        'Location Error',
        'Unable to get your location. Please check your GPS settings.',
        [{text: 'OK'}],
      );
    });
  });
});
