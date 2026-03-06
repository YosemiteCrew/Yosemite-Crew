import {renderHook, act, waitFor} from '@testing-library/react-native';
import {Alert, Platform, ToastAndroid} from 'react-native';
import {useCheckInHandler} from '@/features/appointments/hooks/useCheckInHandler';
import LocationService from '@/shared/services/LocationService';
import * as Redux from 'react-redux';
import * as appointmentsSlice from '@/features/appointments/appointmentsSlice';
import * as checkInUtils from '@/features/appointments/utils/checkInUtils';

// Mock dependencies
jest.mock('react-redux');
jest.mock('@/shared/services/LocationService');
jest.mock('@/features/appointments/appointmentsSlice');
jest.mock('@/features/appointments/utils/checkInUtils');
jest.mock('@/shared/utils/geoDistance', () => ({
  distanceBetweenCoordsMeters: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockAlert = jest.spyOn(Alert, 'alert');
const mockToastAndroid = jest.spyOn(ToastAndroid, 'show');

describe('useCheckInHandler', () => {
  const mockConfig = {
    appointment: {
      id: 'apt-1',
      date: '2024-01-15',
      time: '10:00',
      companionId: 'comp-1',
    },
    businessCoordinates: {lat: 40.7128, lng: -74.0060},
    onCheckingInChange: jest.fn(),
    hasPermission: true,
    onPermissionDenied: jest.fn(),
  };

  const mockCheckInAppointment = jest.fn();
  const mockFetchAppointmentById = jest.fn();
  const mockFetchAppointmentsForCompanion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (Redux.useDispatch as jest.Mock).mockReturnValue(mockDispatch);

    mockCheckInAppointment.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
    });
    mockFetchAppointmentById.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
    });
    mockFetchAppointmentsForCompanion.mockReturnValue({type: 'appointments/fetch'});

    (appointmentsSlice.checkInAppointment as jest.Mock) = mockCheckInAppointment;
    (appointmentsSlice.fetchAppointmentById as jest.Mock) = mockFetchAppointmentById;
    (appointmentsSlice.fetchAppointmentsForCompanion as jest.Mock) = mockFetchAppointmentsForCompanion;

    (checkInUtils.getCheckInConstants as jest.Mock).mockReturnValue({
      CHECKIN_RADIUS_METERS: 200,
    });
    (checkInUtils.isWithinCheckInWindow as jest.Mock).mockReturnValue(true);
    (checkInUtils.formatCheckInTime as jest.Mock).mockReturnValue('10:00 AM');

    (LocationService.getLocationWithRetry as jest.Mock).mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.0060,
    });

    const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
    distanceBetweenCoordsMeters.mockReturnValue(100);

    mockDispatch.mockImplementation((action: any) => {
      if (action.unwrap) {
        return action;
      }
      return Promise.resolve(action);
    });
  });

  describe('basic functionality', () => {
    it('should return handleCheckIn and CHECKIN_RADIUS_METERS', () => {
      const {result} = renderHook(() => useCheckInHandler());

      expect(result.current.handleCheckIn).toBeInstanceOf(Function);
      expect(result.current.CHECKIN_RADIUS_METERS).toBe(200);
    });
  });

  describe('permission checks', () => {
    it('should call onPermissionDenied when permission is not granted', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          hasPermission: false,
        });
      });

      expect(mockConfig.onPermissionDenied).toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should return early when permission is denied', async () => {
      const {result} = renderHook(() => useCheckInHandler());
      const onPermissionDenied = jest.fn();

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          hasPermission: false,
          onPermissionDenied,
        });
      });

      expect(onPermissionDenied).toHaveBeenCalled();
      expect(mockConfig.onCheckingInChange).not.toHaveBeenCalled();
    });

    it('should not call onPermissionDenied callback if not provided', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          hasPermission: false,
          onPermissionDenied: undefined,
        });
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('time window validation', () => {
    it('should show alert when outside check-in window', async () => {
      (checkInUtils.isWithinCheckInWindow as jest.Mock).mockReturnValue(false);
      (checkInUtils.formatCheckInTime as jest.Mock).mockReturnValue('10:00 AM');

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Too early to check in',
        'You can check in starting 5 minutes before your appointment at 10:00 AM.',
      );
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should format check-in time using formatCheckInTime utility', async () => {
      (checkInUtils.isWithinCheckInWindow as jest.Mock).mockReturnValue(false);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(checkInUtils.formatCheckInTime).toHaveBeenCalledWith('2024-01-15', '10:00');
    });
  });

  describe('location validation', () => {
    it('should show alert when business coordinates are missing', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          businessCoordinates: {lat: null, lng: null},
        });
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Location unavailable',
        'Business location is missing. Please try again later.',
      );
      expect(LocationService.getLocationWithRetry).not.toHaveBeenCalled();
    });

    it('should show alert when business lat is null', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          businessCoordinates: {lat: null, lng: -74.0060},
        });
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Location unavailable',
        'Business location is missing. Please try again later.',
      );
    });

    it('should show alert when business lng is null', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          businessCoordinates: {lat: 40.7128, lng: null},
        });
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Location unavailable',
        'Business location is missing. Please try again later.',
      );
    });

    it('should return early when user location cannot be retrieved', async () => {
      (LocationService.getLocationWithRetry as jest.Mock).mockResolvedValue(null);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(LocationService.getLocationWithRetry).toHaveBeenCalledWith(2);
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should show alert when distance calculation returns null', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      distanceBetweenCoordsMeters.mockReturnValue(null);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Location unavailable',
        'Unable to determine distance for check-in.',
      );
    });

    it('should show alert when user is too far from business', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      distanceBetweenCoordsMeters.mockReturnValue(500);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Too far to check in',
        'Move closer to the business to check in. You are ~500m away.',
      );
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should round distance in alert message', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      distanceBetweenCoordsMeters.mockReturnValue(456.789);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Too far to check in',
        'Move closer to the business to check in. You are ~457m away.',
      );
    });
  });

  describe('successful check-in', () => {
    it('should dispatch check-in actions in correct order', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledTimes(3);
        expect(mockCheckInAppointment).toHaveBeenCalledWith({appointmentId: 'apt-1'});
        expect(mockFetchAppointmentById).toHaveBeenCalledWith({appointmentId: 'apt-1'});
        expect(mockFetchAppointmentsForCompanion).toHaveBeenCalledWith({companionId: 'comp-1'});
      });
    });

    it('should call onCheckingInChange with true before check-in', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockConfig.onCheckingInChange).toHaveBeenCalledWith('apt-1', true);
      });
    });

    it('should call onCheckingInChange with false after check-in', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockConfig.onCheckingInChange).toHaveBeenCalledWith('apt-1', false);
      });
    });

    it('should show Android toast on successful check-in', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockToastAndroid).toHaveBeenCalledWith('Checked in', ToastAndroid.SHORT);
      });

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('should not show toast on iOS', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });

      expect(mockToastAndroid).not.toHaveBeenCalled();

      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });

    it('should not dispatch fetchAppointmentsForCompanion when companionId is missing', async () => {
      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn({
          ...mockConfig,
          appointment: {
            ...mockConfig.appointment,
            companionId: undefined,
          },
        });
      });

      await waitFor(() => {
        expect(mockCheckInAppointment).toHaveBeenCalled();
        expect(mockFetchAppointmentById).toHaveBeenCalled();
        expect(mockFetchAppointmentsForCompanion).not.toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should show alert on check-in failure', async () => {
      const error = new Error('Network error');
      mockCheckInAppointment.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(error),
      });

      const {result} = renderHook(() => useCheckInHandler());
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Check-in failed',
          'Unable to check in right now. Please try again.',
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith('[Appointment] Check-in failed', error);
      });

      consoleWarnSpy.mockRestore();
    });

    it('should call onCheckingInChange with false even on error', async () => {
      mockCheckInAppointment.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('Error')),
      });

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockConfig.onCheckingInChange).toHaveBeenCalledWith('apt-1', false);
      });
    });

    it('should not fetch appointments on error', async () => {
      mockCheckInAppointment.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('Error')),
      });

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Check-in failed',
          'Unable to check in right now. Please try again.',
        );
      });

      expect(mockFetchAppointmentById).not.toHaveBeenCalled();
      expect(mockFetchAppointmentsForCompanion).not.toHaveBeenCalled();
    });
  });

  describe('distance calculation', () => {
    it('should calculate distance with correct coordinates', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      (LocationService.getLocationWithRetry as jest.Mock).mockResolvedValue({
        latitude: 40.7130,
        longitude: -74.0065,
      });

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(distanceBetweenCoordsMeters).toHaveBeenCalledWith(
          40.7130,
          -74.0065,
          40.7128,
          -74.0060,
        );
      });
    });

    it('should allow check-in when distance equals radius', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      distanceBetweenCoordsMeters.mockReturnValue(200);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });
    });

    it('should reject check-in when distance exceeds radius by 1 meter', async () => {
      const {distanceBetweenCoordsMeters} = require('@/shared/utils/geoDistance');
      distanceBetweenCoordsMeters.mockReturnValue(201);

      const {result} = renderHook(() => useCheckInHandler());

      await act(async () => {
        await result.current.handleCheckIn(mockConfig);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Too far to check in',
        'Move closer to the business to check in. You are ~201m away.',
      );
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('hook stability', () => {
    it('should maintain handleCheckIn reference across renders', () => {
      const {result, rerender} = renderHook(() => useCheckInHandler());

      const firstRef = result.current.handleCheckIn;
      rerender();
      const secondRef = result.current.handleCheckIn;

      expect(firstRef).toBe(secondRef);
    });
  });
});
