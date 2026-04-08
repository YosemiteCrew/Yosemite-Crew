import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';

// --- Mock all dependencies ---

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: Object.assign(
    jest.fn((selector: any) =>
      selector({
        servicesById: {},
        serviceIdsByOrgId: {},
        serviceIdsBySpecialityId: {},
        getServicesBySpecialityId: jest.fn(() => []),
      })
    ),
    {
      getState: jest.fn(() => ({
        getServicesBySpecialityId: jest.fn(() => []),
      })),
    }
  ),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  createAppointment: jest.fn(),
  getCalendarPrefillMatchesForPrimaryOrg: jest.fn(() => Promise.resolve(null)),
  loadAppointmentsForPrimaryOrg: jest.fn(() => Promise.resolve()),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/app/lib/date', () => ({
  buildUtcDateFromDateAndTime: jest.fn((date: Date) => date),
  getDurationMinutes: jest.fn(() => 30),
}));

jest.mock('@/app/lib/timezone', () => ({
  isOnPreferredTimeZoneCalendarDay: jest.fn(() => false),
  utcClockTimeToPreferredTimeZoneClock: jest.fn((time: string) => ({
    minutes: 540,
    dayOffset: 0,
  })),
}));

jest.mock('@/app/features/appointments/utils/slotNormalization', () => ({
  normalizeSlotsForSelectedDay: jest.fn(() => []),
  resolveSlotDateTimesForSelectedDay: jest.fn((date: Date, meta: any) => ({
    startTime: date,
    endTime: date,
    durationMinutes: meta.localEndMinute - meta.localStartMinute,
  })),
}));

jest.mock('@/app/hooks/useStripeOnboarding', () => ({
  useSubscriptionCounterUpdate: jest.fn(() => ({ refetch: jest.fn() })),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCanMoreForPrimaryOrg: jest.fn(() => ({ canMore: true, reason: 'ok' })),
  useCurrencyForPrimaryOrg: jest.fn(() => 'USD'),
}));

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  loadInvoicesForOrgPrimaryOrg: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/app/features/appointments/pages/Appointments/Sections/AddAppointment', () => ({
  EMPTY_APPOINTMENT: {
    id: undefined,
    companion: { id: '', name: '', species: '', breed: '', parent: { id: '', name: '' } },
    lead: undefined,
    supportStaff: [],
    room: undefined,
    appointmentType: undefined,
    organisationId: '',
    appointmentDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    timeSlot: '',
    concern: '',
    durationMinutes: 0,
    status: 'REQUESTED',
  },
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: jest.fn(() => (text: string) => text),
}));

const { createAppointment } = jest.requireMock(
  '@/app/features/appointments/services/appointmentService'
);
const { getSlotsForServiceAndDateForPrimaryOrg } = jest.requireMock(
  '@/app/features/appointments/services/appointmentService'
);
const { getCalendarPrefillMatchesForPrimaryOrg } = jest.requireMock(
  '@/app/features/appointments/services/appointmentService'
);
const { loadAppointmentsForPrimaryOrg } = jest.requireMock(
  '@/app/features/appointments/services/appointmentService'
);
const { useCanMoreForPrimaryOrg } = jest.requireMock('@/app/hooks/useBilling');
const { useTeamForPrimaryOrg } = jest.requireMock('@/app/hooks/useTeam');
const { useSpecialitiesForPrimaryOrg } = jest.requireMock('@/app/hooks/useSpecialities');
const { useSubscriptionCounterUpdate } = jest.requireMock('@/app/hooks/useStripeOnboarding');
const { normalizeSlotsForSelectedDay } = jest.requireMock(
  '@/app/features/appointments/utils/slotNormalization'
);
const { resolveSlotDateTimesForSelectedDay } = jest.requireMock(
  '@/app/features/appointments/utils/slotNormalization'
);
const { isOnPreferredTimeZoneCalendarDay, utcClockTimeToPreferredTimeZoneClock } =
  jest.requireMock('@/app/lib/timezone');
const { loadInvoicesForOrgPrimaryOrg } = jest.requireMock(
  '@/app/features/billing/services/invoiceService'
);

describe('useAppointmentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({ canMore: true, reason: 'ok' });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([]);
    jest.requireMock('@/app/stores/serviceStore').useServiceStore.getState.mockReturnValue({
      getServicesBySpecialityId: jest.fn(() => []),
    });
    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch: jest.fn() });
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([]);
    (isOnPreferredTimeZoneCalendarDay as jest.Mock).mockReturnValue(false);
    (utcClockTimeToPreferredTimeZoneClock as jest.Mock).mockReturnValue({
      minutes: 540,
      dayOffset: 0,
    });
    (getCalendarPrefillMatchesForPrimaryOrg as jest.Mock).mockResolvedValue(null);
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([]);
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAppointmentForm());
    expect(result.current.formData).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.timeSlots).toEqual([]);
    expect(result.current.selectedSlot).toBeNull();
  });

  it('resetForm resets all state to defaults', async () => {
    const { result } = renderHook(() => useAppointmentForm());

    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, concern: 'tooth pain' }));
    });

    expect(result.current.formData.concern).toBe('tooth pain');

    await act(async () => {
      result.current.resetForm();
    });

    expect(result.current.formData.concern).toBe('');
  });

  it('handleSpecialitySelect updates appointmentType speciality', async () => {
    const { result } = renderHook(() => useAppointmentForm());

    await act(async () => {
      result.current.handleSpecialitySelect({ label: 'Dental', value: 'spec-dental' });
    });

    expect(result.current.formData.appointmentType?.speciality.id).toBe('spec-dental');
    expect(result.current.formData.appointmentType?.id).toBe('');
  });

  it('handleServiceSelect updates appointmentType service', async () => {
    const { result } = renderHook(() => useAppointmentForm());

    // First set a speciality
    await act(async () => {
      result.current.handleSpecialitySelect({ label: 'Dental', value: 'spec-dental' });
    });

    await act(async () => {
      result.current.handleServiceSelect({ label: 'Cleaning', value: 'svc-clean' });
    });

    expect(result.current.formData.appointmentType?.id).toBe('svc-clean');
    expect(result.current.formData.appointmentType?.name).toBe('Cleaning');
  });

  it('handleLeadSelect sets lead on formData', async () => {
    const { result } = renderHook(() => useAppointmentForm());

    await act(async () => {
      result.current.handleLeadSelect({ label: 'Dr Smith', value: 'lead-1' });
    });

    expect(result.current.formData.lead?.id).toBe('lead-1');
    expect(result.current.formData.lead?.name).toBe('Dr Smith');
  });

  it('handleSupportStaffChange sets supportStaff on formData', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'staff-1', name: 'Alice', practionerId: 'prac-1' },
      { _id: 'staff-2', name: 'Bob', practionerId: 'prac-2' },
    ]);
    const { result } = renderHook(() => useAppointmentForm());

    await act(async () => {
      result.current.handleSupportStaffChange(['prac-1', 'prac-2']);
    });

    expect(result.current.formData.supportStaff ?? []).toHaveLength(2);
    expect(result.current.formData.supportStaff?.[0]?.id).toBe('prac-1');
  });

  it('validateForm returns booking error when canMore is false with limit_reached reason', () => {
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({
      canMore: false,
      reason: 'limit_reached',
    });
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm();
    expect(errors.booking).toContain('upgrade');
  });

  it('validateForm returns booking error for unknown canMore reason', () => {
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({
      canMore: false,
      reason: 'unknown_reason',
    });
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm();
    expect(errors.booking).toContain("couldn't verify");
  });

  it('validateForm requires companion when requireCompanion=true', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm(true);
    expect(errors.companionId).toBeDefined();
  });

  it('validateForm does not require companion when requireCompanion=false', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm(false);
    expect(errors.companionId).toBeUndefined();
  });

  it('validateForm requires speciality and service', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm(false);
    expect(errors.specialityId).toBeDefined();
    expect(errors.serviceId).toBeDefined();
  });

  it('validateForm requires concern', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm(false);
    expect(errors.concern).toBeDefined();
  });

  it('validateForm requires slot selection', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const errors = result.current.validateForm(false);
    expect(errors.slot).toBe('Please select a slot');
  });

  it('handleCreate returns false when validation errors exist', async () => {
    const { result } = renderHook(() => useAppointmentForm());
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.handleCreate();
    });
    expect(returnValue).toBe(false);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('handleCreate returns false on createAppointment error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (createAppointment as jest.Mock).mockRejectedValue(new Error('create failed'));

    // Set enough formData to pass validation
    const { result } = renderHook(() => useAppointmentForm());
    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Fido',
          species: 'Dog',
          breed: 'Lab',
          parent: { id: '', name: '' },
        },
        appointmentType: {
          id: 'svc-1',
          name: 'Checkup',
          speciality: { id: 'spec-1', name: 'General' },
        },
        concern: 'limp',
        durationMinutes: 30,
      }));
      result.current.setSelectedSlot({
        startTime: '09:00',
        endTime: '09:30',
        vetIds: ['vet-1'],
      } as any);
    });

    expect(result.current.formData).toBeDefined();
    consoleSpy.mockRestore();
  });

  it('keeps loading active until appointment refresh work and success callback finish', async () => {
    let resolveCreate: ((value: unknown) => void) | undefined;
    let resolveAppointments: (() => void) | undefined;
    let resolveInvoices: (() => void) | undefined;
    let resolveSuccess: (() => void) | undefined;
    const onSuccess = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSuccess = resolve;
        })
    );
    const refetch = jest.fn().mockResolvedValue(undefined);

    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1' },
    ]);
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      {
        slot: { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] },
        meta: { localStartMinute: 540, localEndMinute: 570, dayOffset: 0 },
      },
    ]);
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] },
    ]);
    (createAppointment as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    (loadAppointmentsForPrimaryOrg as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAppointments = resolve;
        })
    );
    (loadInvoicesForOrgPrimaryOrg as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvoices = resolve;
        })
    );

    const { result } = renderHook(() => useAppointmentForm({ onSuccess }));

    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Fido',
          species: 'Dog',
          breed: 'Lab',
          parent: { id: '', name: '' },
        },
        appointmentType: {
          id: 'svc-1',
          name: 'Checkup',
          speciality: { id: 'spec-1', name: 'General' },
        },
        concern: 'limp',
        durationMinutes: 30,
      }));
      result.current.setSelectedSlot({
        startTime: '09:00',
        endTime: '09:30',
        vetIds: ['vet-1'],
      } as any);
    });

    await waitFor(() => {
      expect(result.current.selectedSlot?.startTime).toBe('09:00');
    });

    let createPromise: Promise<boolean> | undefined;
    await act(async () => {
      createPromise = result.current.handleCreate();
    });

    expect(createAppointment).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate?.({
        id: 'appt-1',
        organisationId: 'org-1',
      });
    });

    expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledWith({ force: true, silent: true });
    expect(refetch).toHaveBeenCalled();
    expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveAppointments?.();
      resolveInvoices?.();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: 'appt-1', organisationId: 'org-1' });
    });

    await act(async () => {
      resolveSuccess?.();
      await createPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('initialPrefill sets pendingPrefill and selectedDate', async () => {
    const prefillDate = new Date('2026-04-01');
    const prefill = { date: prefillDate, minuteOfDay: 600 };
    const { result } = renderHook(() =>
      useAppointmentForm({
        initialPrefill: prefill,
      })
    );

    expect(result.current.selectedDate.toDateString()).toBe(prefillDate.toDateString());
    expect(result.current.selectedSlot).toBeNull();
  });

  it('calendarSlotFlow filters speciality and service options by selected slot + lead', async () => {
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'spec-1', name: 'General' },
      { _id: 'spec-2', name: 'Surgery' },
    ]);
    jest.requireMock('@/app/stores/serviceStore').useServiceStore.getState.mockReturnValue({
      getServicesBySpecialityId: jest.fn((specialityId: string) => {
        if (specialityId === 'spec-1') return [{ id: 'svc-1', name: 'Consult' }];
        if (specialityId === 'spec-2') return [{ id: 'svc-2', name: 'Surgery' }];
        return [];
      }),
    });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1' },
    ]);
    (utcClockTimeToPreferredTimeZoneClock as jest.Mock).mockImplementation((time: string) => ({
      minutes: time === '10:00' ? 600 : 540,
      dayOffset: 0,
    }));
    const svc1Slot = { startTime: '10:00', endTime: '10:30', vetIds: ['vet-1'] };
    const svc2Slot = { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] };
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockImplementation(
      (serviceId: string) => {
        if (serviceId === 'svc-1') return Promise.resolve([svc1Slot]);
        return Promise.resolve([svc2Slot]);
      }
    );
    // normalizeSlotsForSelectedDay is called in the fasttrack resolution path;
    // return the normalized entry that matches minuteOfDay=600 for svc-1.
    (normalizeSlotsForSelectedDay as jest.Mock).mockImplementation((batches: any[]) => {
      const allSlots = batches.flatMap((b: any) => b.slots);
      if (allSlots.some((s: any) => s.startTime === '10:00')) {
        return [{ slot: svc1Slot, meta: { localStartMinute: 600, localEndMinute: 630 } }];
      }
      return [{ slot: svc2Slot, meta: { localStartMinute: 540, localEndMinute: 570 } }];
    });

    const prefill = {
      date: new Date('2026-04-01T00:00:00.000Z'),
      minuteOfDay: 600,
      leadId: 'vet-1',
    };
    const { result } = renderHook(() =>
      useAppointmentForm({
        initialPrefill: prefill,
        calendarSlotFlow: true,
      })
    );

    await waitFor(() => {
      expect(result.current.timeSlots).toHaveLength(1);
      expect(result.current.selectedSlot?.startTime).toBe('10:00');
      expect(result.current.SpecialitiesOptions).toEqual([{ label: 'General', value: 'spec-1' }]);
      expect(result.current.formData.lead?.id).toBe('vet-1');
    });

    await act(async () => {
      result.current.handleSpecialitySelect({ label: 'General', value: 'spec-1' });
    });

    expect(result.current.ServicesOptions).toEqual([{ label: 'Consult', value: 'svc-1' }]);
  });

  it('uses the bulk calendar prefill endpoint when available', async () => {
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'spec-1', name: 'General' },
      { _id: 'spec-2', name: 'Surgery' },
    ]);
    jest.requireMock('@/app/stores/serviceStore').useServiceStore.getState.mockReturnValue({
      getServicesBySpecialityId: jest.fn((specialityId: string) => {
        if (specialityId === 'spec-1') return [{ id: 'svc-1', name: 'Consult' }];
        if (specialityId === 'spec-2') return [{ id: 'svc-2', name: 'Surgery' }];
        return [];
      }),
    });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1' },
    ]);
    (getCalendarPrefillMatchesForPrimaryOrg as jest.Mock).mockResolvedValue([
      {
        serviceId: 'svc-1',
        slot: { startTime: '10:00', endTime: '10:30', vetIds: ['vet-1'] },
        meta: { localStartMinute: 600, localEndMinute: 630 },
      },
    ]);

    const prefill = {
      date: new Date('2026-04-01T00:00:00.000Z'),
      minuteOfDay: 600,
      leadId: 'vet-1',
    };
    const { result } = renderHook(() =>
      useAppointmentForm({
        initialPrefill: prefill,
        calendarSlotFlow: true,
      })
    );

    await waitFor(() => {
      expect(result.current.selectedSlot?.startTime).toBe('10:00');
      expect(result.current.SpecialitiesOptions).toEqual([{ label: 'General', value: 'spec-1' }]);
    });

    expect(getCalendarPrefillMatchesForPrimaryOrg).toHaveBeenCalledWith({
      date: prefill.date,
      minuteOfDay: 600,
      leadId: 'vet-1',
      serviceIds: ['svc-1', 'svc-2'],
    });
    expect(getSlotsForServiceAndDateForPrimaryOrg).not.toHaveBeenCalled();
  });

  it('uses normalized slot metadata for cross-midnight calendar prefills', async () => {
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'spec-1', name: 'General' },
    ]);
    jest.requireMock('@/app/stores/serviceStore').useServiceStore.getState.mockReturnValue({
      getServicesBySpecialityId: jest.fn(() => [{ id: 'svc-1', name: 'Consult' }]),
    });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1' },
    ]);
    const overnightSlot = { startTime: '23:45', endTime: '00:00', vetIds: ['vet-1'] };
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([overnightSlot]);
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      { slot: overnightSlot, meta: { localStartMinute: 1425, localEndMinute: 1440 } },
    ]);

    const prefill = {
      date: new Date('2026-04-01T00:00:00.000Z'),
      minuteOfDay: 1425,
      leadId: 'vet-1',
    };
    const { result } = renderHook(() =>
      useAppointmentForm({
        initialPrefill: prefill,
        calendarSlotFlow: true,
      })
    );

    await waitFor(() => {
      expect(result.current.selectedSlot?.startTime).toBe('23:45');
      expect(resolveSlotDateTimesForSelectedDay).toHaveBeenCalledWith(
        prefill.date,
        expect.objectContaining({
          localStartMinute: 1425,
          localEndMinute: 1440,
        })
      );
      expect(result.current.formData.durationMinutes).toBe(15);
    });
  });

  it('keeps calendar-selected slot when speciality/service changes in calendar flow', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1' },
    ]);
    const slotNine = { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] };
    const slotTen = { startTime: '10:00', endTime: '10:30', vetIds: ['vet-1'] };
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      {
        slot: slotNine,
        meta: { localStartMinute: 540, localEndMinute: 570, dayOffset: 0 },
      },
      {
        slot: slotTen,
        meta: { localStartMinute: 600, localEndMinute: 630, dayOffset: 0 },
      },
    ]);
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([slotNine, slotTen]);

    const { result } = renderHook(() =>
      useAppointmentForm({
        calendarSlotFlow: true,
      })
    );

    await act(async () => {
      result.current.setSelectedDate(new Date('2026-04-01T00:00:00.000Z'));
      result.current.setSelectedSlot(slotTen);
    });

    await act(async () => {
      result.current.handleSpecialitySelect({ label: 'General', value: 'spec-1' });
    });
    expect(result.current.selectedSlot?.startTime).toBe('10:00');

    await act(async () => {
      result.current.handleServiceSelect({ label: 'Consult', value: 'svc-1' });
    });

    await waitFor(() => {
      expect(result.current.selectedSlot?.startTime).toBe('10:00');
    });
  });

  it('ServiceInfoData returns emptyServiceInfo when no serviceId', () => {
    const { result } = renderHook(() => useAppointmentForm());
    const info = result.current.ServiceInfoData;
    expect(info.name).toBe('');
    expect(info.cost).toBe('');
  });

  it('SpecialitiesOptions returns empty when no specialities', () => {
    const { result } = renderHook(() => useAppointmentForm());
    expect(result.current.SpecialitiesOptions).toEqual([]);
  });

  it('TeamOptions returns empty when no teams', () => {
    const { result } = renderHook(() => useAppointmentForm());
    expect(result.current.TeamOptions).toEqual([]);
  });

  it('onSuccess callback is called on successful create', async () => {
    const onSuccess = jest.fn();
    (createAppointment as jest.Mock).mockResolvedValue({});
    const refetch = jest.fn().mockResolvedValue({});
    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch });

    const { result } = renderHook(() => useAppointmentForm({ onSuccess }));

    // Set up valid form data that passes all validations
    // (we need slot + lead to pass validateForm)
    const mockSlot = { startTime: '09:00', endTime: '09:30', vetIds: [] };
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);

    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Buddy',
          species: 'Dog',
          breed: '',
          parent: { id: '', name: '' },
        },
        appointmentType: { id: 'svc-1', name: 'Check', speciality: { id: 'spec-1', name: 'G' } },
        concern: 'pain',
        durationMinutes: 30,
      }));
      result.current.setSelectedSlot(mockSlot as any);
    });

    let created = false;
    await act(async () => {
      created = await result.current.handleCreate(false);
    });

    expect(created).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('loads slots and auto-selects only lead, then create succeeds', async () => {
    const onSuccess = jest.fn();
    const refetch = jest.fn().mockResolvedValue({});
    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch });
    (createAppointment as jest.Mock).mockResolvedValue({});
    (loadAppointmentsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (loadInvoicesForOrgPrimaryOrg as jest.Mock).mockResolvedValue({});
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr Vet', practionerId: 'vet-1', image: 'https://img/1.png' },
    ]);

    const slot = { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1'] };
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([slot]);
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      {
        slot,
        meta: { localStartMinute: 540, localEndMinute: 570, dayOffset: 0 },
      },
    ]);

    const { result } = renderHook(() => useAppointmentForm({ onSuccess }));

    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Buddy',
          species: 'Dog',
          breed: '',
          parent: { id: '', name: '' },
        },
        appointmentType: {
          id: 'svc-1',
          name: 'Check',
          speciality: { id: 'spec-1', name: 'General' },
        },
        concern: 'pain',
        durationMinutes: 30,
      }));
    });

    await waitFor(() => {
      expect(result.current.timeSlots).toHaveLength(1);
      expect(result.current.selectedSlot?.startTime).toBe('09:00');
      expect(result.current.formData.lead?.id).toBe('vet-1');
    });

    let created = false;
    await act(async () => {
      created = await result.current.handleCreate();
    });

    expect(created).toBe(true);
    expect(createAppointment).toHaveBeenCalled();
    expect(loadAppointmentsForPrimaryOrg).toHaveBeenCalledWith({ force: true, silent: true });
    expect(refetch).toHaveBeenCalled();
    expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('validateForm returns lead error when multiple leads are available but none selected', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr A', practionerId: 'vet-1' },
      { _id: 'team-2', name: 'Dr B', practionerId: 'vet-2' },
    ]);
    const slot = { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1', 'vet-2'] };
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([slot]);
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      {
        slot,
        meta: { localStartMinute: 540, localEndMinute: 570, dayOffset: 0 },
      },
    ]);

    const { result } = renderHook(() => useAppointmentForm());
    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Fido',
          species: 'Dog',
          breed: '',
          parent: { id: '', name: '' },
        },
        appointmentType: {
          id: 'svc-1',
          name: 'Checkup',
          speciality: { id: 'spec-1', name: 'General' },
        },
        concern: 'limp',
        durationMinutes: 30,
      }));
    });

    await waitFor(() => {
      expect(result.current.selectedSlot).not.toBeNull();
    });

    const errors = result.current.validateForm();
    expect(errors.leadId).toBe('Multiple leads are available. Please choose a lead.');
  });

  it('clears invalid preset lead for multi-lead slot and only shows lead error on validation', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', name: 'Dr A', practionerId: 'vet-1' },
      { _id: 'team-2', name: 'Dr B', practionerId: 'vet-2' },
    ]);
    const slot = { startTime: '09:00', endTime: '09:30', vetIds: ['vet-1', 'vet-2'] };
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([slot]);
    (normalizeSlotsForSelectedDay as jest.Mock).mockReturnValue([
      {
        slot,
        meta: { localStartMinute: 540, localEndMinute: 570, dayOffset: 0 },
      },
    ]);

    const { result } = renderHook(() => useAppointmentForm());
    await act(async () => {
      result.current.setFormData((prev) => ({
        ...prev,
        companion: {
          id: 'comp-1',
          name: 'Fido',
          species: 'Dog',
          breed: '',
          parent: { id: '', name: '' },
        },
        appointmentType: {
          id: 'svc-1',
          name: 'Checkup',
          speciality: { id: 'spec-1', name: 'General' },
        },
        concern: 'limp',
        durationMinutes: 30,
        lead: { id: 'vet-3', name: 'Dr C' },
      }));
    });

    await waitFor(() => {
      expect(result.current.selectedSlot).not.toBeNull();
    });

    expect(result.current.formData.lead).toBeUndefined();
    expect(result.current.formDataErrors.leadId).toBeUndefined();

    const errors = result.current.validateForm();
    expect(errors.leadId).toBe('Multiple leads are available. Please choose a lead.');
  });
});
