import {renderHook, waitFor, act} from '@testing-library/react-native';
import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {useLocationPermission} from '../../../../src/features/appointments/hooks/useLocationPermission';

jest.mock('@/localization', () => ({
  t: (key: string) => key,
}));

// Geolocation is mocked via jest.config.js moduleNameMapper → __mocks__/react-native-geolocation.js

const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;
const mockRequestAuthorization = Geolocation.requestAuthorization as jest.Mock;

describe('useLocationPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  describe('iOS', () => {
    it('returns location when permission granted and position succeeds', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      mockGetCurrentPosition.mockImplementation((success: any) =>
        success({coords: {latitude: 51.5, longitude: -0.1}}),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(true);
      expect(result.current.userLocation).toEqual({
        latitude: 51.5,
        longitude: -0.1,
      });
    });

    it('dispatches ERROR when getCurrentPosition fails', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      mockGetCurrentPosition.mockImplementation((_s: any, error: any) =>
        error(new Error('position error')),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(false);
      expect(result.current.userLocation).toBeNull();
    });

    it('returns null for mapCenter and userCoords when userLocation is null', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      mockGetCurrentPosition.mockImplementation((_s: any, error: any) =>
        error(new Error('fail')),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mapCenter).toBeNull();
      expect(result.current.userCoords).toBeNull();
    });

    it('uses userLocation as mapCenter and userCoords when available', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      mockGetCurrentPosition.mockImplementation((success: any) =>
        success({coords: {latitude: 48.8566, longitude: 2.3522}}),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.mapCenter).toEqual({
        latitude: 48.8566,
        longitude: 2.3522,
      });
      expect(result.current.userCoords).toEqual({lat: 48.8566, lng: 2.3522});
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('returns location when permission granted and position succeeds', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((success: any) =>
        success({coords: {latitude: 40.7128, longitude: -74.006}}),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(true);
      expect(result.current.userLocation).toEqual({
        latitude: 40.7128,
        longitude: -74.006,
      });
    });

    it('dispatches DENIED when permission is denied', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(false);
      expect(result.current.userLocation).toBeNull();
    });

    it('dispatches DENIED when permission returns NEVER_ASK_AGAIN', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(false);
    });

    it('dispatches ERROR when getCurrentPosition fails', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
      mockGetCurrentPosition.mockImplementation((_s: any, error: any) =>
        error(new Error('android position error')),
      );

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(false);
    });

    it('dispatches ERROR when PermissionsAndroid.request throws', async () => {
      jest
        .spyOn(PermissionsAndroid, 'request')
        .mockRejectedValue(new Error('permission error'));

      const {result} = renderHook(() => useLocationPermission());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasPermission).toBe(false);
    });
  });

  it('cleanup on unmount does not throw', async () => {
    mockRequestAuthorization.mockImplementation(() => {});
    mockGetCurrentPosition.mockImplementation(() => {});

    const {unmount} = renderHook(() => useLocationPermission());
    expect(() => unmount()).not.toThrow();
  });

  describe('cancellation (component unmounts before async completes)', () => {
    it('ignores GRANTED callback fired after unmount', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      let capturedSuccess: any;
      mockGetCurrentPosition.mockImplementation((success: any) => {
        capturedSuccess = success;
      });

      const {unmount, result} = renderHook(() => useLocationPermission());
      unmount();

      // Fire the position callback after unmount — should be a no-op
      await act(async () => {
        capturedSuccess?.({coords: {latitude: 10, longitude: 20}});
      });

      // State stays at initial (hasPermission=false, isLoading=true)
      expect(result.current.hasPermission).toBe(false);
    });

    it('ignores ERROR callback fired after unmount', async () => {
      mockRequestAuthorization.mockImplementation(() => {});
      let capturedError: any;
      mockGetCurrentPosition.mockImplementation((_s: any, error: any) => {
        capturedError = error;
      });

      const {unmount, result} = renderHook(() => useLocationPermission());
      unmount();

      await act(async () => {
        capturedError?.(new Error('late error'));
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('ignores DENIED dispatch when unmounted before Android permission resolves', async () => {
      Platform.OS = 'android';
      let resolvePermission: any;
      jest.spyOn(PermissionsAndroid, 'request').mockImplementation(
        () =>
          new Promise(resolve => {
            resolvePermission = resolve;
          }),
      );

      const {unmount, result} = renderHook(() => useLocationPermission());
      unmount();

      await act(async () => {
        resolvePermission(PermissionsAndroid.RESULTS.DENIED);
      });

      // DENIED dispatch was skipped — isLoading stays true (not set to false)
      expect(result.current.isLoading).toBe(true);
    });

    it('ignores ERROR dispatch in catch block when unmounted before throw resolves', async () => {
      Platform.OS = 'android';
      let rejectPermission: any;
      jest.spyOn(PermissionsAndroid, 'request').mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectPermission = reject;
          }),
      );

      const {unmount, result} = renderHook(() => useLocationPermission());
      unmount();

      await act(async () => {
        rejectPermission(new Error('late error'));
      });

      expect(result.current.isLoading).toBe(true);
    });
  });
});
