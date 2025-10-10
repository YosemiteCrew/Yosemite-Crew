import {Platform, Alert} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import LocationService from '../LocationService';

// Mock dependencies
jest.mock('@react-native-community/geolocation');
jest.mock('react-native-permissions');
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

const mockGeolocation = Geolocation as jest.Mocked<typeof Geolocation>;
const mockCheck = check as jest.MockedFunction<typeof check>;
const mockRequest = request as jest.MockedFunction<typeof request>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('LocationService', () => {
  const mockCoords = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    altitudeAccuracy: 2,
    heading: 90,
    speed: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLocationPermission', () => {
    it('should return true when location permission is granted on iOS', async () => {
      Platform.OS = 'ios';
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.checkLocationPermission();

      expect(result).toBe(true);
      expect(mockCheck).toHaveBeenCalledWith(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    });

    it('should return true when location permission is granted on Android', async () => {
      Platform.OS = 'android';
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.checkLocationPermission();

      expect(result).toBe(true);
      expect(mockCheck).toHaveBeenCalledWith(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    });

    it('should return false when location permission is denied', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);

      const result = await LocationService.checkLocationPermission();

      expect(result).toBe(false);
    });

    it('should return false when location permission is blocked', async () => {
      mockCheck.mockResolvedValue(RESULTS.BLOCKED);

      const result = await LocationService.checkLocationPermission();

      expect(result).toBe(false);
    });
  });

  describe('requestLocationPermission', () => {
    it('should return true when permission is granted on iOS', async () => {
      Platform.OS = 'ios';
      mockRequest.mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.requestLocationPermission();

      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    });

    it('should return true when permission is granted on Android', async () => {
      Platform.OS = 'android';
      mockRequest.mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.requestLocationPermission();

      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    });

    it('should return false and show alert when permission is blocked', async () => {
      mockRequest.mockResolvedValue(RESULTS.BLOCKED);

      const result = await LocationService.requestLocationPermission();

      expect(result).toBe(false);
      expect(mockAlert).toHaveBeenCalledWith(
        'Location Permission Required',
        'Please enable location access in your device settings to use this feature.',
        [{text: 'OK'}]
      );
    });

    it('should return false when permission is denied', async () => {
      mockRequest.mockResolvedValue(RESULTS.DENIED);

      const result = await LocationService.requestLocationPermission();

      expect(result).toBe(false);
    });

    it('should return false when permission is unavailable', async () => {
      mockRequest.mockResolvedValue(RESULTS.UNAVAILABLE);

      const result = await LocationService.requestLocationPermission();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentPosition', () => {
    it('should return coordinates when permission is already granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({coords: mockCoords});
      });

      const coords = await LocationService.getCurrentPosition();

      expect(coords).toEqual(mockCoords);
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });

    it('should request permission and return coordinates when permission is not granted', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      mockRequest.mockResolvedValue(RESULTS.GRANTED);
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({coords: mockCoords});
      });

      const coords = await LocationService.getCurrentPosition();

      expect(coords).toEqual(mockCoords);
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should throw error when permission is denied', async () => {
      mockCheck.mockResolvedValue(RESULTS.DENIED);
      mockRequest.mockResolvedValue(RESULTS.DENIED);

      await expect(LocationService.getCurrentPosition()).rejects.toThrow(
        'Location permission denied'
      );
    });

    it('should reject when geolocation fails', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      const locationError = {
        code: 1,
        message: 'Location error',
      };
      mockGeolocation.getCurrentPosition.mockImplementation((success: any, error: any) => {
        error(locationError);
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(LocationService.getCurrentPosition()).rejects.toEqual(locationError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Location error:', locationError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('watchPosition', () => {
    it('should start watching position and call onSuccess callback', () => {
      const onSuccess = jest.fn();
      const onError = jest.fn();
      const mockWatchId = 123;

      mockGeolocation.watchPosition.mockImplementation((success: any) => {
        success({coords: mockCoords});
        return mockWatchId;
      });

      LocationService.watchPosition(onSuccess, onError);

      expect(onSuccess).toHaveBeenCalledWith(mockCoords);
      expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 10000,
          fastestInterval: 5000,
        }
      );
    });

    it('should call onError callback when watch position fails', () => {
      const onSuccess = jest.fn();
      const onError = jest.fn();
      const watchError = {code: 1, message: 'Watch error'};

      mockGeolocation.watchPosition.mockImplementation((success: any, error: any) => {
        error(watchError);
        return 123;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      LocationService.watchPosition(onSuccess, onError);

      expect(onError).toHaveBeenCalledWith(watchError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Watch position error:', watchError);

      consoleErrorSpy.mockRestore();
    });

    it('should not throw when onError is not provided', () => {
      const onSuccess = jest.fn();
      const watchError = {code: 1, message: 'Watch error'};

      mockGeolocation.watchPosition.mockImplementation((success: any, error: any) => {
        error(watchError);
        return 123;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => LocationService.watchPosition(onSuccess)).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('stopWatching', () => {
    it('should clear watch when watchId exists', () => {
      const mockWatchId = 123;
      mockGeolocation.watchPosition.mockReturnValue(mockWatchId);

      LocationService.watchPosition(jest.fn());
      LocationService.stopWatching();

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(mockWatchId);
    });

    it('should not call clearWatch when watchId is null', () => {
      LocationService.stopWatching();

      expect(mockGeolocation.clearWatch).not.toHaveBeenCalled();
    });

    it('should reset watchId to null after stopping', () => {
      const mockWatchId = 123;
      mockGeolocation.watchPosition.mockReturnValue(mockWatchId);

      LocationService.watchPosition(jest.fn());
      LocationService.stopWatching();
      LocationService.stopWatching(); // Second call should not clear watch

      expect(mockGeolocation.clearWatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLocationWithRetry', () => {
    beforeEach(() => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return coordinates on first attempt', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({coords: mockCoords});
      });

      const promise = LocationService.getLocationWithRetry();

      // No need to advance timers since it succeeds immediately
      const coords = await promise;

      expect(coords).toEqual(mockCoords);
    });

    it('should retry and succeed on second attempt', async () => {
      let attemptCount = 0;
      mockGeolocation.getCurrentPosition.mockImplementation((success: any, error: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          error({code: 1, message: 'First attempt failed'});
        } else {
          success({coords: mockCoords});
        }
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const promise = LocationService.getLocationWithRetry();

      // Advance timer for retry delay
      await jest.advanceTimersByTimeAsync(1000);

      const coords = await promise;

      expect(coords).toEqual(mockCoords);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Location attempt 1 failed:',
        expect.any(Object)
      );

      consoleLogSpy.mockRestore();
    });

    it('should retry specified number of times and return null', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any, error: any) => {
        error({code: 1, message: 'Location failed'});
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const promise = LocationService.getLocationWithRetry(3);

      // Advance timers for all retry attempts
      await jest.advanceTimersByTimeAsync(3000);

      const coords = await promise;

      expect(coords).toBeNull();
      expect(mockAlert).toHaveBeenCalledWith(
        'Location Error',
        'Unable to get your location. Please check your GPS settings.',
        [{text: 'OK'}]
      );
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      consoleLogSpy.mockRestore();
    });

    it('should use default maxRetries of 3', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any, error: any) => {
        error({code: 1, message: 'Location failed'});
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const promise = LocationService.getLocationWithRetry();

      await jest.advanceTimersByTimeAsync(3000);

      const coords = await promise;

      expect(coords).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      consoleLogSpy.mockRestore();
    });

    it('should wait 1 second between retries', async () => {
      let attemptCount = 0;
      mockGeolocation.getCurrentPosition.mockImplementation((success: any, error: any) => {
        attemptCount++;
        if (attemptCount < 3) {
          error({code: 1, message: 'Failed'});
        } else {
          success({coords: mockCoords});
        }
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const promise = LocationService.getLocationWithRetry();

      // Advance timers for retry delays
      await jest.advanceTimersByTimeAsync(2000);

      const coords = await promise;

      expect(coords).toEqual(mockCoords);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      consoleLogSpy.mockRestore();
    });
  });
});
