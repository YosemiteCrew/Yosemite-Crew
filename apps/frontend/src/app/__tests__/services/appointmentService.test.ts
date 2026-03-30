// appointmentService.test.ts
import {
  loadAppointmentsForPrimaryOrg,
  createAppointment,
  updateAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
  toSlotsArray,
  acceptAppointment,
  cancelAppointment,
  checkInAppointment,
  rejectAppointment,
  changeAppointmentStatus,
  updateAppointmentPaymentStatus,
  consumeInventory,
  consumeBulkInventory,
} from '@/app/features/appointments/services/appointmentService';

import { getData, patchData, postData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { formatDateLocal } from '@/app/lib/date';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';

import { fromAppointmentRequestDTO, toAppointmentResponseDTO } from '@yosemite-crew/types';

import type { Appointment, AppointmentResponseDTO } from '@yosemite-crew/types';

import type { AvailabilityResponse, Slot } from '@/app/features/appointments/types/appointments';

// --- Mocks ---

// 1. Mock Axios
jest.mock('@/app/services/axios');
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPatchData = patchData as jest.Mock;

// 2. Mock Stores
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({
      user: { getUsername: jest.fn().mockReturnValue('user-1') },
      attributes: {},
    }),
  },
}));

jest.mock('@/app/stores/teamStore', () => ({
  useTeamStore: {
    getState: jest.fn().mockReturnValue({
      getTeamsByOrgId: jest.fn().mockReturnValue([]),
    }),
  },
}));

// 3. Mock Utils
jest.mock('@/app/lib/date', () => ({
  formatDateLocal: jest.fn(),
}));
const mockedFormatDateLocal = formatDateLocal as jest.Mock;

// 4. Mock External DTO mappers
jest.mock('@yosemite-crew/types', () => ({
  fromAppointmentRequestDTO: jest.fn(),
  toAppointmentResponseDTO: jest.fn(),
}));

// 5. Mock inventory service (used by consumeInventory/consumeBulkInventory)
jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn().mockResolvedValue([]),
}));

// 6. Mock appointment status helpers
jest.mock('@/app/lib/appointments', () => ({
  canTransitionAppointmentStatus: jest.fn(),
  getInvalidAppointmentStatusTransitionMessage: jest.fn().mockReturnValue('Invalid transition'),
}));
const mockedFromAppointmentDTO = fromAppointmentRequestDTO as jest.Mock;
const mockedToAppointmentDTO = toAppointmentResponseDTO as jest.Mock;
const mockedFetchInventoryItems = fetchInventoryItems as jest.Mock;

describe('Appointment Service', () => {
  // Store spies
  const mockAppointmentStoreStartLoading = jest.fn();
  const mockAppointmentStoreSetAppointmentsForOrg = jest.fn();
  const mockAppointmentStoreUpsertAppointment = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    // Default Store State Setup
    (useAppointmentStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockAppointmentStoreStartLoading,
      setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      upsertAppointment: mockAppointmentStoreUpsertAppointment,
      status: 'idle',
      appointmentsById: {},
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: 'org-123',
    });

    mockedFormatDateLocal.mockReturnValue('2026-01-06');

    // Default: allow status transitions
    const { canTransitionAppointmentStatus, getInvalidAppointmentStatusTransitionMessage } =
      jest.requireMock('@/app/lib/appointments');
    (canTransitionAppointmentStatus as jest.Mock).mockReturnValue(true);
    (getInvalidAppointmentStatusTransitionMessage as jest.Mock).mockReturnValue(
      'Invalid transition'
    );

    // Re-initialize auth/team store mocks (reset by jest.resetAllMocks)
    const { useAuthStore } = jest.requireMock('@/app/stores/authStore');
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      user: { getUsername: jest.fn().mockReturnValue('user-1') },
      attributes: {},
    });
    const { useTeamStore } = jest.requireMock('@/app/stores/teamStore');
    (useTeamStore.getState as jest.Mock).mockReturnValue({
      getTeamsByOrgId: jest.fn().mockReturnValue([]),
    });
  });

  // --- Helpers ---
  const makeBaseAppointment = (overrides: Partial<Appointment> = {}): Appointment => {
    const now = new Date();
    return {
      id: 'appt-1',
      companion: {
        id: 'comp-1',
        name: 'Mochi',
        species: 'Dog',
        parent: { id: 'parent-1', name: 'Alex' },
      },
      organisationId: 'org-123',
      appointmentDate: now,
      startTime: now,
      timeSlot: '10:00',
      durationMinutes: 30,
      endTime: now,
      status: 'UPCOMING',
      ...overrides,
    };
  };

  // --- Section 1: loadAppointmentsForPrimaryOrg ---
  describe('loadAppointmentsForPrimaryOrg', () => {
    it('warns and returns if no primaryOrgId is selected', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadAppointmentsForPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot load appointments.'
      );
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and not forced", async () => {
      (useAppointmentStore.getState as jest.Mock).mockReturnValue({
        status: 'loaded',
        startLoading: mockAppointmentStoreStartLoading,
        setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      });

      await loadAppointmentsForPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it('fetches if forced even when loaded', async () => {
      (useAppointmentStore.getState as jest.Mock).mockReturnValue({
        status: 'loaded',
        startLoading: mockAppointmentStoreStartLoading,
        setAppointmentsForOrg: mockAppointmentStoreSetAppointmentsForOrg,
      });

      mockedGetData.mockResolvedValue({ data: { data: [] } });

      await loadAppointmentsForPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalledWith('/fhir/v1/appointment/pms/organisation/org-123');
    });

    it('does not trigger startLoading if silent option is true', async () => {
      mockedGetData.mockResolvedValue({ data: { data: [] } });

      await loadAppointmentsForPrimaryOrg({ silent: true });

      expect(mockAppointmentStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith('/fhir/v1/appointment/pms/organisation/org-123');
    });

    it('fetches successfully, maps DTOs, and updates store', async () => {
      const dto1 = { id: 'dto-1' } as any as AppointmentResponseDTO;
      const dto2 = { id: 'dto-2' } as any as AppointmentResponseDTO;

      mockedGetData.mockResolvedValue({ data: { data: [dto1, dto2] } });

      mockedFromAppointmentDTO
        .mockReturnValueOnce(makeBaseAppointment({ id: 'appt-1' }))
        .mockReturnValueOnce(makeBaseAppointment({ id: 'appt-2' }));

      await loadAppointmentsForPrimaryOrg();

      expect(mockAppointmentStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith('/fhir/v1/appointment/pms/organisation/org-123');

      expect(mockedFromAppointmentDTO).toHaveBeenCalledTimes(2);
      expect(mockedFromAppointmentDTO).toHaveBeenNthCalledWith(1, dto1);
      expect(mockedFromAppointmentDTO).toHaveBeenNthCalledWith(2, dto2);

      expect(mockAppointmentStoreSetAppointmentsForOrg).toHaveBeenCalledWith('org-123', [
        expect.any(Object),
        expect.any(Object),
      ]);
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Network Error');
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(loadAppointmentsForPrimaryOrg()).rejects.toThrow('Network Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load appointments:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createAppointment ---
  describe('createAppointment', () => {
    it('warns and returns if no primaryOrgId is selected', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await createAppointment(makeBaseAppointment());

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot create appointment.'
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('posts converted DTO and upserts mapped appointment on success', async () => {
      const appointment = makeBaseAppointment({ organisationId: 'org-will-be-overwritten' });
      const fhirPayload = { fhir: true };
      const returnedDTO = { id: 'returned-dto' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-created' });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPostData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await createAppointment(appointment);

      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(
        expect.objectContaining({ organisationId: 'org-123' })
      );
      expect(mockedPostData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms?createPayment=true',
        fhirPayload
      );
      expect(mockedFromAppointmentDTO).toHaveBeenCalledWith(returnedDTO);
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('handles alternate response shape at data.appointment', async () => {
      const appointment = makeBaseAppointment();
      const returnedDTO = { id: 'returned-dto-alt' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-created-alt' });

      mockedToAppointmentDTO.mockReturnValue({ fhir: true });
      mockedPostData.mockResolvedValue({ data: { appointment: returnedDTO } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await createAppointment(appointment);

      expect(mockedFromAppointmentDTO).toHaveBeenCalledWith(returnedDTO);
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Create Error');
      mockedToAppointmentDTO.mockReturnValue({ fhir: true });
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createAppointment(makeBaseAppointment())).rejects.toThrow('Create Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create appointment:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateAppointment ---
  describe('updateAppointment', () => {
    it('warns and returns if no org id is available from store or payload', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const payload = makeBaseAppointment({ organisationId: undefined });

      await updateAppointment(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot update appointment.'
      );
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('warns and returns if payload is missing appointment.id', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const payload = makeBaseAppointment({ id: undefined });

      await updateAppointment(payload);

      expect(consoleSpy).toHaveBeenCalledWith('updateAppointment: missing appointment.id', payload);
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('patches converted DTO and upserts mapped appointment on success', async () => {
      const payload = makeBaseAppointment({ id: 'appt-10', organisationId: 'org-123' });
      const fhirPayload = { fhir: 'update' };
      const returnedDTO = { id: 'returned-update-dto' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-10', status: 'CHECKED_IN' });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPatchData.mockResolvedValue({ data: { data: returnedDTO } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await updateAppointment(payload);

      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(payload);
      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-10',
        fhirPayload
      );
      expect(mockedFromAppointmentDTO).toHaveBeenCalledWith(returnedDTO);
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('falls back to payload organisationId when store primaryOrgId is null', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const payload = makeBaseAppointment({ id: 'appt-12', organisationId: 'org-fallback' });

      mockedToAppointmentDTO.mockReturnValue({ fhir: 'update' });
      mockedPatchData.mockResolvedValue({ data: {} });

      const result = await updateAppointment(payload);

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-fallback/appt-12',
        { fhir: 'update' }
      );
      expect(result).toBeUndefined();
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Update Error');
      mockedToAppointmentDTO.mockReturnValue({ fhir: 'update' });
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateAppointment(makeBaseAppointment({ id: 'appt-11' }))).rejects.toThrow(
        'Update Error'
      );
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update appointment:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: getSlotsForServiceAndDateForPrimaryOrg + toSlotsArray ---
  describe('Slots', () => {
    it('warns and returns [] if no primaryOrgId', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getSlotsForServiceAndDateForPrimaryOrg('svc-1', new Date());

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'No primary organization selected. Cannot load companions.'
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns [] if serviceId is missing', async () => {
      const result = await getSlotsForServiceAndDateForPrimaryOrg('', new Date());
      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it('returns [] if date is missing', async () => {
      const result = await getSlotsForServiceAndDateForPrimaryOrg('svc-1', null as any);
      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
    });

    it('posts correct payload and returns mapped slots', async () => {
      mockedFormatDateLocal.mockReturnValue('2026-01-06');

      const availability: AvailabilityResponse = {
        success: true,
        data: {
          date: '2026-01-06',
          dayOfWeek: 'TUESDAY' as any,
          windows: [
            { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] } as any,
            { startTime: '10:00', endTime: '10:30', vetIds: ['vet-2', 'vet-3'] } as any,
          ],
        } as any,
      };

      mockedPostData.mockResolvedValue({ data: availability });

      const result = await getSlotsForServiceAndDateForPrimaryOrg('svc-1', new Date());

      expect(mockedPostData).toHaveBeenCalledWith('/fhir/v1/service/bookable-slots', {
        serviceId: 'svc-1',
        organisationId: 'org-123',
        date: '2026-01-06',
      });

      expect(result).toEqual<Slot[]>([
        { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] },
        { startTime: '10:00', endTime: '10:30', vetIds: ['vet-2', 'vet-3'] },
      ]);
    });

    it('toSlotsArray maps windows to Slot[] and handles missing windows', () => {
      const withWindows: AvailabilityResponse = {
        success: true,
        data: {
          windows: [{ startTime: '11:00', endTime: '11:30', vetIds: ['vet-9'] } as any],
        } as any,
      };

      expect(toSlotsArray(withWindows)).toEqual([
        { startTime: '11:00', endTime: '11:30', vetIds: ['vet-9'] },
      ]);

      const noWindows: AvailabilityResponse = { success: true, data: {} as any };
      expect(toSlotsArray(noWindows)).toEqual([]);
    });

    it('logs error and rethrows on slot fetch failure', async () => {
      const error = new Error('Slots Error');
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getSlotsForServiceAndDateForPrimaryOrg('svc-1', new Date())).rejects.toThrow(
        'Slots Error'
      );

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create service:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 5: acceptAppointment ---
  describe('acceptAppointment', () => {
    it('returns if appointment.id is missing', async () => {
      mockedPatchData.mockResolvedValue({});
      await acceptAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPatchData).not.toHaveBeenCalled();
      expect(mockAppointmentStoreUpsertAppointment).not.toHaveBeenCalled();
    });

    it('patches accept route and upserts mapped appointment on success', async () => {
      const appointment = makeBaseAppointment({
        id: 'appt-acc',
        lead: { id: 'vet-1', name: 'Dr Vet' },
      });
      const fhirPayload = { fhir: 'accept' };
      const returnedDTO = { id: 'dto-acc' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-acc', status: 'CHECKED_IN' });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPatchData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await acceptAppointment(appointment);

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-acc/accept',
        fhirPayload
      );
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('autofills lead from current team member when accepting without lead', async () => {
      const { useAuthStore } = jest.requireMock('@/app/stores/authStore');
      const { useTeamStore } = jest.requireMock('@/app/stores/teamStore');
      (useAuthStore.getState as jest.Mock).mockReturnValue({
        user: { getUsername: jest.fn().mockReturnValue('user-1') },
        attributes: { given_name: 'Pat', family_name: 'Lee' },
      });
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        getTeamsByOrgId: jest
          .fn()
          .mockReturnValue([{ _id: 'team-1', practionerId: 'user-1', name: 'Dr Pat' }]),
      });

      mockedToAppointmentDTO.mockReturnValue({ fhir: 'accept-auto' });
      mockedPatchData.mockResolvedValue({ data: {} });

      await acceptAppointment(
        makeBaseAppointment({ id: 'appt-auto', status: 'REQUESTED', lead: { id: '', name: '' } })
      );

      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(
        expect.objectContaining({
          lead: expect.objectContaining({ id: 'user-1', name: 'Dr Pat' }),
        })
      );
    });

    it('throws before patch when accept cannot resolve a valid lead', async () => {
      const { useAuthStore } = jest.requireMock('@/app/stores/authStore');
      const { useTeamStore } = jest.requireMock('@/app/stores/teamStore');
      (useAuthStore.getState as jest.Mock).mockReturnValue({
        user: { getUsername: jest.fn().mockReturnValue('') },
        attributes: {},
      });
      (useTeamStore.getState as jest.Mock).mockReturnValue({
        getTeamsByOrgId: jest.fn().mockReturnValue([]),
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        acceptAppointment(
          makeBaseAppointment({
            id: 'appt-auto-fail',
            status: 'REQUESTED',
            lead: { id: '', name: '' },
          })
        )
      ).rejects.toThrow(
        'Cannot accept appointment without a valid lead. Assign/select a lead first.'
      );

      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Accept Error');
      mockedToAppointmentDTO.mockReturnValue({ fhir: 'accept' });
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        acceptAppointment(
          makeBaseAppointment({
            id: 'appt-acc2',
            lead: { id: 'vet-2', name: 'Dr Vet 2' },
          })
        )
      ).rejects.toThrow('Accept Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to accept appointment:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 6: cancelAppointment ---
  describe('cancelAppointment', () => {
    it('returns if appointment.id is missing', async () => {
      mockedPatchData.mockResolvedValue({});
      await cancelAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPatchData).not.toHaveBeenCalled();
      expect(mockAppointmentStoreUpsertAppointment).not.toHaveBeenCalled();
    });

    it('patches cancel route and upserts mapped appointment on success', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-can' });
      const fhirPayload = { fhir: 'cancel' };
      const returnedDTO = { id: 'dto-can' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-can', status: 'CANCELLED' });

      mockedToAppointmentDTO.mockReturnValue(fhirPayload);
      mockedPatchData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await cancelAppointment(appointment);

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-can/cancel',
        fhirPayload
      );
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Cancel Error');
      mockedToAppointmentDTO.mockReturnValue({ fhir: 'cancel' });
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(cancelAppointment(makeBaseAppointment({ id: 'appt-can2' }))).rejects.toThrow(
        'Cancel Error'
      );
      expect(consoleSpy).toHaveBeenCalledWith('Failed to cancel appointment:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 7: checkInAppointment ---
  describe('checkInAppointment', () => {
    it('calls performAppointmentAction with checkin action', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-ci' });
      const returnedDTO = { id: 'dto-ci' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-ci', status: 'CHECKED_IN' });

      mockedToAppointmentDTO.mockReturnValue({ fhir: 'checkin' });
      mockedPatchData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await checkInAppointment(appointment);

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-ci/checkin',
        expect.any(Object)
      );
      expect(mockAppointmentStoreUpsertAppointment).toHaveBeenCalledWith(returnedAppointment);
    });

    it('returns if appointment.id is missing', async () => {
      await checkInAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPatchData).not.toHaveBeenCalled();
    });
  });

  // --- Section 8: rejectAppointment ---
  describe('rejectAppointment', () => {
    it('calls performAppointmentAction with reject action', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-rej' });
      const returnedDTO = { id: 'dto-rej' } as any as AppointmentResponseDTO;
      const returnedAppointment = makeBaseAppointment({ id: 'appt-rej', status: 'CANCELLED' });

      mockedToAppointmentDTO.mockReturnValue({ fhir: 'reject' });
      mockedPatchData.mockResolvedValue({ data: { data: { appointment: returnedDTO } } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment);

      await rejectAppointment(appointment);

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-rej/reject',
        expect.any(Object)
      );
    });

    it('returns if appointment.id is missing', async () => {
      await rejectAppointment(makeBaseAppointment({ id: undefined }));
      expect(mockedPatchData).not.toHaveBeenCalled();
    });
  });

  // --- Section 9: changeAppointmentStatus ---
  describe('changeAppointmentStatus', () => {
    it('returns appointment unchanged when same status', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-same', status: 'UPCOMING' });
      const result = await changeAppointmentStatus(appointment, 'UPCOMING');
      expect(result).toBe(appointment);
      expect(mockedPatchData).not.toHaveBeenCalled();
    });

    it('throws if transition is not allowed', async () => {
      const { canTransitionAppointmentStatus } = jest.requireMock('@/app/lib/appointments');
      (canTransitionAppointmentStatus as jest.Mock).mockReturnValueOnce(false);
      const appointment = makeBaseAppointment({ id: 'appt-invalid', status: 'UPCOMING' });
      await expect(changeAppointmentStatus(appointment, 'CHECKED_IN')).rejects.toThrow(
        'Invalid transition'
      );
    });

    it('calls checkInAppointment when nextStatus is CHECKED_IN', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-ci2', status: 'UPCOMING' });
      mockedToAppointmentDTO.mockReturnValue({});
      mockedPatchData.mockResolvedValue({
        data: { data: { appointment: { id: 'dto-ci2' } } },
      });
      mockedFromAppointmentDTO.mockReturnValue(
        makeBaseAppointment({ id: 'appt-ci2', status: 'CHECKED_IN' })
      );

      await changeAppointmentStatus(appointment, 'CHECKED_IN');

      expect(mockedPatchData).toHaveBeenCalledWith(
        expect.stringContaining('/checkin'),
        expect.any(Object)
      );
    });

    it('calls acceptAppointment when REQUESTED -> UPCOMING', async () => {
      const appointment = makeBaseAppointment({
        id: 'appt-req',
        status: 'REQUESTED',
        lead: { id: 'vet-1', name: 'Dr. Vet' },
      });
      mockedToAppointmentDTO.mockReturnValue({});
      mockedPatchData.mockResolvedValue({
        data: { data: { appointment: { id: 'dto-req' } } },
      });
      mockedFromAppointmentDTO.mockReturnValue(
        makeBaseAppointment({ id: 'appt-req', status: 'UPCOMING' })
      );

      await changeAppointmentStatus(appointment, 'UPCOMING');

      expect(mockedPatchData).toHaveBeenCalledWith(
        expect.stringContaining('/accept'),
        expect.any(Object)
      );
    });

    it('calls rejectAppointment when REQUESTED -> CANCELLED', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-reqc', status: 'REQUESTED' });
      mockedToAppointmentDTO.mockReturnValue({});
      mockedPatchData.mockResolvedValue({
        data: { data: { appointment: { id: 'dto-reqc' } } },
      });
      mockedFromAppointmentDTO.mockReturnValue(
        makeBaseAppointment({ id: 'appt-reqc', status: 'CANCELLED' })
      );

      await changeAppointmentStatus(appointment, 'CANCELLED');

      expect(mockedPatchData).toHaveBeenCalledWith(
        expect.stringContaining('/reject'),
        expect.any(Object)
      );
    });

    it('calls performStatusUpdate for other valid transitions', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-upd', status: 'UPCOMING' });
      mockedToAppointmentDTO.mockReturnValue({});
      mockedPatchData.mockResolvedValue({
        data: { data: makeBaseAppointment({ id: 'appt-upd', status: 'CANCELLED' }) },
      });
      mockedFromAppointmentDTO.mockReturnValue(
        makeBaseAppointment({ id: 'appt-upd', status: 'CANCELLED' })
      );

      await changeAppointmentStatus(appointment, 'CANCELLED');

      expect(mockedPatchData).toHaveBeenCalledWith(
        expect.stringContaining('/appt-upd'),
        expect.any(Object)
      );
    });
  });

  // --- Section 10: updateAppointmentPaymentStatus ---
  describe('updateAppointmentPaymentStatus', () => {
    it('calls updateAppointment with updated paymentStatus', async () => {
      const appointment = makeBaseAppointment({ id: 'appt-pay', organisationId: 'org-123' });
      const returnedAppointment = { ...appointment, paymentStatus: 'PAID' };

      mockedToAppointmentDTO.mockReturnValue({});
      mockedPatchData.mockResolvedValue({ data: { data: returnedAppointment } });
      mockedFromAppointmentDTO.mockReturnValue(returnedAppointment as Appointment);

      await updateAppointmentPaymentStatus(appointment, 'PAID');

      expect(mockedPatchData).toHaveBeenCalledWith(
        '/fhir/v1/appointment/pms/org-123/appt-pay',
        expect.any(Object)
      );
      expect(mockedToAppointmentDTO).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'PAID' })
      );
    });
  });

  // --- Section 11: consumeInventory ---
  describe('consumeInventory', () => {
    const mockInventory = { appointmentId: 'appt-1', items: [] } as any;

    it('warns and returns early if no primaryOrgId', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await consumeInventory(mockInventory);

      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('posts to consume endpoint and fetches inventory on success', async () => {
      mockedPostData.mockResolvedValue({});

      await consumeInventory(mockInventory);

      expect(mockedPostData).toHaveBeenCalledWith('/v1/inventory/stock/consume', mockInventory);
      expect(mockedFetchInventoryItems).toHaveBeenCalledWith('org-123');
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Consume error');
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(consumeInventory(mockInventory)).rejects.toThrow('Consume error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to consume Inventory:', error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 12: consumeBulkInventory ---
  describe('consumeBulkInventory', () => {
    const mockInventoryList = [{ appointmentId: 'appt-1', items: [] }] as any[];

    it('warns and returns early if no primaryOrgId', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await consumeBulkInventory(mockInventoryList);

      expect(result).toEqual([]);
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('posts bulk consume body and fetches inventory on success', async () => {
      mockedPostData.mockResolvedValue({});

      await consumeBulkInventory(mockInventoryList);

      expect(mockedPostData).toHaveBeenCalledWith('/v1/inventory/stock/consume/bulk', {
        items: mockInventoryList,
      });
      expect(mockedFetchInventoryItems).toHaveBeenCalledWith('org-123');
    });

    it('logs error and rethrows on failure', async () => {
      const error = new Error('Bulk consume error');
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(consumeBulkInventory(mockInventoryList)).rejects.toThrow('Bulk consume error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to consume Inventory:', error);
      consoleSpy.mockRestore();
    });
  });
});
