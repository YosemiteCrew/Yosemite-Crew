import LocationService from '../../src/shared/services/LocationService';
import Geolocation from '@react-native-community/geolocation';
import { Platform, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// --- Mocks ---

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: {
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

describe('LocationService', () => {
  const mockCoords = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    altitudeAccuracy: 5,
    heading: 0,
    speed: 0,
  };

  const mockPosition = {
    coords: mockCoords,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default Platform to iOS
    Platform.OS = 'ios';
    // Use fake timers for retry logic
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkLocationPermission', () => {
    it('checks iOS permission correctly', async () => {
      Platform.OS = 'ios';
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.checkLocationPermission();

      expect(check).toHaveBeenCalledWith(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      expect(result).toBe(true);
    });

    it('checks Android permission correctly', async () => {
      Platform.OS = 'android';
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const result = await LocationService.checkLocationPermission();

      expect(check).toHaveBeenCalledWith(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      expect(result).toBe(false);
    });
  });

  describe('requestLocationPermission', () => {
    it('requests iOS permission and returns true if granted', async () => {
      Platform.OS = 'ios';
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      const result = await LocationService.requestLocationPermission();

      expect(request).toHaveBeenCalledWith(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      expect(result).toBe(true);
    });

    it('requests Android permission and returns false if denied', async () => {
      Platform.OS = 'android';
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      const result = await LocationService.requestLocationPermission();

      expect(request).toHaveBeenCalledWith(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      expect(result).toBe(false);
    });

    it('shows alert and returns false if permission is blocked', async () => {
      (request as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);

      const result = await LocationService.requestLocationPermission();

      expect(Alert.alert).toHaveBeenCalledWith(
        'Location Permission Required',
        expect.stringContaining('enable location access'),
        expect.any(Array),
      );
      expect(result).toBe(false);
    });
  });

  describe('getCurrentPosition', () => {
    it('throws error if permission is denied', async () => {
      // Mock check to fail
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      // Mock request to fail
      (request as jest.Mock).mockResolvedValue(RESULTS.DENIED);

      await expect(LocationService.getCurrentPosition()).rejects.toThrow(
        'Location permission denied',
      );
    });

    it('requests permission if not initially granted, then succeeds', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
      (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success) => success(mockPosition)
      );

      const coords = await LocationService.getCurrentPosition();

      expect(request).toHaveBeenCalled();
      expect(coords).toEqual(mockCoords);
    });

    it('returns coordinates directly if permission already granted', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (success) => success(mockPosition)
      );

      const coords = await LocationService.getCurrentPosition();

      expect(request).not.toHaveBeenCalled();
      expect(coords).toEqual(mockCoords);
    });

    it('handles geolocation errors via reject', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
      const geoError = { code: 1, message: 'User denied location' };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (_success, error) => error(geoError)
      );

      // Spy on console error to suppress it in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(LocationService.getCurrentPosition()).rejects.toThrow(
        'User denied location',
      );

      consoleSpy.mockRestore();
    });

    it('handles non-standard geolocation errors (fallback message)', async () => {
      (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (_success, error) => error({}) // Empty object error
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(LocationService.getCurrentPosition()).rejects.toThrow(
        'Unable to retrieve location',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('watchPosition', () => {
    it('sets watchId and calls onSuccess', () => {
      (Geolocation.watchPosition as jest.Mock).mockImplementation(
        (success) => {
          success(mockPosition);
          return 123; // return watchId
        }
      );

      const successCallback = jest.fn();
      LocationService.watchPosition(successCallback);

      expect(Geolocation.watchPosition).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalledWith(mockCoords);
    });

    it('calls onError on failure', () => {
      const geoError = new Error('Watch failed');
      (Geolocation.watchPosition as jest.Mock).mockImplementation(
        (_success, error) => {
          error(geoError);
          return 123;
        }
      );

      const errorCallback = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      LocationService.watchPosition(jest.fn(), errorCallback);

      expect(errorCallback).toHaveBeenCalledWith(geoError);
      consoleSpy.mockRestore();
    });

    it('calls onError on failure with non-error object', () => {
        // Cover branch: error instanceof Error ? ... : ... inside watchPosition error callback
        const geoError = { message: 'Watch failed generic' };
        (Geolocation.watchPosition as jest.Mock).mockImplementation(
          (_success, error) => {
            error(geoError);
            return 123;
          }
        );

        const errorCallback = jest.fn();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        LocationService.watchPosition(jest.fn(), errorCallback);

        expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({ message: 'Watch failed generic' }));
        consoleSpy.mockRestore();
      });
  });

  describe('stopWatching', () => {
    it('clears watch if watchId exists', () => {
      // First start watching to set the ID
      (Geolocation.watchPosition as jest.Mock).mockReturnValue(555);
      LocationService.watchPosition(jest.fn());

      // Now stop
      LocationService.stopWatching();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(555);
    });

    it('does nothing if no watchId is set', () => {
      // Reset state via stopWatching first just in case
      LocationService.stopWatching();
      (Geolocation.clearWatch as jest.Mock).mockClear();

      // Call again
      LocationService.stopWatching();

      expect(Geolocation.clearWatch).not.toHaveBeenCalled();
    });
  });

  describe('getLocationWithRetry', () => {
    it('returns coordinates immediately on success', async () => {
      // Mock success on first try
      jest.spyOn(LocationService, 'getCurrentPosition').mockResolvedValue(mockCoords);

      const result = await LocationService.getLocationWithRetry();
      expect(result).toEqual(mockCoords);
    });

    it('retries on failure and eventually succeeds', async () => {
      const mockGetCurrentPosition = jest.spyOn(LocationService, 'getCurrentPosition');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Fail once, then succeed
      mockGetCurrentPosition
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockCoords);

      const promise = LocationService.getLocationWithRetry();

      // Fast-forward time for the retry delay
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockCoords);

      consoleSpy.mockRestore();
    });

    it('fails after max retries and shows Alert', async () => {
      const mockGetCurrentPosition = jest.spyOn(LocationService, 'getCurrentPosition');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Always fail
      mockGetCurrentPosition.mockRejectedValue(new Error('Timeout'));

      const promise = LocationService.getLocationWithRetry(3);

      // Advance timers through all 3 retry waits
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(3);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Location Error',
        expect.stringContaining('Unable to get your location'),
        expect.any(Array)
      );
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    // ** CRITICAL TEST for branch coverage **
    // This tests line 138 where the error is NOT an instance of Error
    it('normalizes non-Error objects (string rejection) during retry', async () => {
        const mockGetCurrentPosition = jest.spyOn(LocationService, 'getCurrentPosition');
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        // Fail with a raw string 'Network failure' which is NOT an Error object
        // This triggers the `else` branch: new Error(String(error))
        mockGetCurrentPosition
          .mockRejectedValueOnce('Network failure')
          .mockResolvedValueOnce(mockCoords);

        const promise = LocationService.getLocationWithRetry();

        // Advance timer for retry
        await jest.runAllTimersAsync();

        const result = await promise;

        expect(result).toEqual(mockCoords);

        // Verify that the log contained the string message we passed
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Location attempt 1 failed'),
          // We check if the second arg is an Error object created from our string
          expect.objectContaining({ message: 'Network failure' })
        );

        consoleSpy.mockRestore();
      });
  });
});