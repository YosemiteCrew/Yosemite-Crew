import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useServiceStore } from '@/app/stores/serviceStore';
import { Slot } from '@/app/features/appointments/types/appointments';
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from '@/app/features/appointments/services/appointmentService';
import { buildUtcDateFromDateAndTime, getDurationMinutes } from '@/app/lib/date';
import {
  isOnPreferredTimeZoneCalendarDay,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import {
  normalizeSlotsForSelectedDay,
  NormalizedSlotMeta,
  resolveSlotDateTimesForSelectedDay,
} from '@/app/features/appointments/utils/slotNormalization';
import { useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import { useCanMoreForPrimaryOrg, useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { loadInvoicesForOrgPrimaryOrg } from '@/app/features/billing/services/invoiceService';
import { EMPTY_APPOINTMENT } from '@/app/features/appointments/pages/Appointments/Sections/AddAppointment';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';

export type AppointmentFormErrors = {
  companionId?: string;
  specialityId?: string;
  serviceId?: string;
  concern?: string;
  leadId?: string;
  duration?: string;
  slot?: string;
  booking?: string;
};

export type UseAppointmentFormOptions = {
  onSuccess?: () => void;
  initialPrefill?: AppointmentDraftPrefill | null;
  calendarSlotFlow?: boolean;
};

export const useAppointmentForm = (options: UseAppointmentFormOptions = {}) => {
  const { onSuccess, initialPrefill, calendarSlotFlow = false } = options;
  const terminologyText = useCompanionTerminologyText();

  const teams = useTeamForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const { canMore, reason } = useCanMoreForPrimaryOrg('appointments');
  const getServicesBySpecialityId = useMemo(
    () => useServiceStore.getState().getServicesBySpecialityId,
    []
  );
  const { refetch: refetchData } = useSubscriptionCounterUpdate();

  const [formData, setFormData] = useState<Appointment>(EMPTY_APPOINTMENT);
  const [formDataErrors, setFormDataErrors] = useState<AppointmentFormErrors>({});
  const currentLeadIdRef = useRef<string>('');
  const selectedSlotRef = useRef<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);
  const slotMetaByRef = useRef<WeakMap<Slot, NormalizedSlotMeta>>(new WeakMap());
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<AppointmentDraftPrefill | null>(null);
  const prefillLeadIdRef = useRef<string>('');
  const [slotScopedSpecialityIds, setSlotScopedSpecialityIds] = useState<string[]>([]);
  const [slotScopedServicesBySpecialityId, setSlotScopedServicesBySpecialityId] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});
  const [isLoadingSlotScopedOptions, setIsLoadingSlotScopedOptions] = useState(false);
  const normalizeId = useCallback(
    (value?: string) =>
      String(value ?? '')
        .trim()
        .split('/')
        .pop()
        ?.toLowerCase() ?? '',
    []
  );
  const getNextSelectedSlot = (
    availableSlots: Slot[],
    previousSlot: Slot | null,
    preserveExistingSelection: boolean = false
  ) => {
    if (!previousSlot) return preserveExistingSelection ? null : (availableSlots[0] ?? null);
    const matchingSlot = availableSlots.find(
      (slot) => slot.startTime === previousSlot.startTime && slot.endTime === previousSlot.endTime
    );
    return matchingSlot ?? (preserveExistingSelection ? null : (availableSlots[0] ?? null));
  };

  const ServiceFields = useMemo(
    () => [
      { label: 'Name', key: 'name', type: 'text' },
      { label: 'Description', key: 'description', type: 'text' },
      { label: 'Duration (mins)', key: 'duration', type: 'text' },
      { label: `Cost (${currency})`, key: 'cost', type: 'text' },
      { label: 'Max discount', key: 'maxDiscount', type: 'text' },
    ],
    [currency]
  );

  const CompanionFields = useMemo(
    () => [
      { label: 'Name', key: 'name', type: 'text' },
      { label: 'Parent name', key: 'parentName', type: 'text' },
      { label: 'Breed', key: 'breed', type: 'text' },
      { label: 'Species', key: 'species', type: 'text' },
    ],
    []
  );

  const getLeadOptionsForSlot = useCallback(
    (slot: Slot | null) => {
      if (!teams?.length || !slot) return [];
      const vetIdSet = new Set(slot.vetIds ?? []);
      if (!vetIdSet.size) return [];
      return teams
        .filter((team) => {
          const teamId = team.practionerId || team._id;
          return teamId ? vetIdSet.has(teamId) : false;
        })
        .map((team) => ({
          label: team.name || team.practionerId || team._id,
          value: team.practionerId || team._id,
        }));
    },
    [teams]
  );
  const getLeadOptionsRef = useRef(getLeadOptionsForSlot);
  getLeadOptionsRef.current = getLeadOptionsForSlot;
  const getLeadProfileUrl = useCallback(
    (leadId: string) => {
      const matchedTeam = teams.find((team) => (team.practionerId || team._id) === leadId);
      return typeof matchedTeam?.image === 'string' ? matchedTeam.image : undefined;
    },
    [teams]
  );
  const getLeadProfileUrlRef = useRef(getLeadProfileUrl);
  getLeadProfileUrlRef.current = getLeadProfileUrl;

  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    const appointmentTypeId = formData.appointmentType?.id;
    if (!appointmentTypeId || !selectedDate) {
      if (calendarSlotFlow && selectedSlotRef.current) {
        return;
      }
      setTimeSlots([]);
      setSelectedSlot(null);
      slotMetaByRef.current = new WeakMap();
      return;
    }
    let cancelled = false;
    const loadTimeSlots = async () => {
      try {
        const previousDate = new Date(selectedDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const [previousDateSlots, selectedDateSlots, nextDateSlots] = await Promise.all([
          getSlotsForServiceAndDateForPrimaryOrg(appointmentTypeId, previousDate),
          getSlotsForServiceAndDateForPrimaryOrg(appointmentTypeId, selectedDate),
          getSlotsForServiceAndDateForPrimaryOrg(appointmentTypeId, nextDate),
        ]);
        if (cancelled) return;
        const normalizedEntries = normalizeSlotsForSelectedDay([
          { dayShift: -1, slots: previousDateSlots },
          { dayShift: 0, slots: selectedDateSlots },
          { dayShift: 1, slots: nextDateSlots },
        ]);
        const nowMs = Date.now();
        const shouldFilterPast = isOnPreferredTimeZoneCalendarDay(new Date(), selectedDate);
        const availableEntries = normalizedEntries.filter((entry) => {
          if (!shouldFilterPast) return true;
          const { startTime } = resolveSlotDateTimesForSelectedDay(selectedDate, entry.meta);
          return startTime.getTime() >= nowMs;
        });
        const slotMetaMap = new WeakMap<Slot, NormalizedSlotMeta>();
        availableEntries.forEach((entry) => slotMetaMap.set(entry.slot, entry.meta));
        slotMetaByRef.current = slotMetaMap;
        const availableSlots = availableEntries.map((entry) => entry.slot);
        setTimeSlots(availableSlots);
        const nextSelectedSlot = getNextSelectedSlot(
          availableSlots,
          selectedSlotRef.current,
          calendarSlotFlow
        );
        setSelectedSlot(nextSelectedSlot);
        if (calendarSlotFlow && selectedSlotRef.current && !nextSelectedSlot) {
          setFormDataErrors((prev) => ({
            ...prev,
            slot: 'Selected calendar slot is unavailable for this service. Please choose another service.',
          }));
        } else {
          setFormDataErrors((prev) => ({ ...prev, slot: undefined }));
        }
      } catch (err) {
        console.log(err);
        if (!cancelled) {
          setTimeSlots([]);
          setSelectedSlot(null);
          slotMetaByRef.current = new WeakMap();
        }
      }
    };
    loadTimeSlots().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [calendarSlotFlow, formData.appointmentType?.id, selectedDate]);

  useEffect(() => {
    if (!initialPrefill) return;
    prefillLeadIdRef.current = initialPrefill.leadId || '';
    setPendingPrefill(initialPrefill);
    setSelectedDate(initialPrefill.date);
    setSelectedSlot(null);
  }, [initialPrefill]);

  useEffect(() => {
    if (!calendarSlotFlow) return;
    if (!pendingPrefill) return;
    if (!specialities.length) return;

    const minute = Math.max(0, Math.min(1435, Math.round(pendingPrefill.minuteOfDay / 5) * 5));
    const normalizedPrefillLeadId = normalizeId(pendingPrefill.leadId);
    const serviceCandidates = specialities.flatMap((speciality) => {
      const specialityId = String(speciality._id ?? '').trim();
      if (!specialityId) return [];
      const servicesForSpeciality = getServicesBySpecialityId(specialityId);
      return servicesForSpeciality.map((service) => ({
        specialityId,
        serviceId: String(service.id ?? '').trim(),
        serviceName: service.name ?? '',
      }));
    });
    if (!serviceCandidates.length) return;

    let cancelled = false;
    setIsLoadingSlotScopedOptions(true);
    const resolveSlotScopedOptions = async () => {
      const resolved = await Promise.all(
        serviceCandidates.map(async (candidate) => {
          if (!candidate.serviceId) return null;
          const slots = await getSlotsForServiceAndDateForPrimaryOrg(
            candidate.serviceId,
            pendingPrefill.date
          );
          const matchingSlot =
            slots.find((slot) => {
              const startClock = utcClockTimeToPreferredTimeZoneClock(slot.startTime);
              if (Math.abs(startClock.minutes - minute) > 5) return false;
              if (!normalizedPrefillLeadId) return true;
              return (slot.vetIds ?? []).some(
                (vetId) => normalizeId(vetId) === normalizedPrefillLeadId
              );
            }) ?? null;
          if (!matchingSlot) return null;
          return { ...candidate, matchingSlot };
        })
      );
      if (cancelled) return;

      const matches = resolved.filter(Boolean) as Array<{
        specialityId: string;
        serviceId: string;
        serviceName: string;
        matchingSlot: Slot;
      }>;

      if (!matches.length) {
        setSlotScopedSpecialityIds([]);
        setSlotScopedServicesBySpecialityId({});
        setTimeSlots([]);
        setSelectedSlot(null);
        setFormDataErrors((prev) => ({
          ...prev,
          slot: 'Selected calendar slot is unavailable. Please choose another slot.',
        }));
        setPendingPrefill(null);
        setIsLoadingSlotScopedOptions(false);
        return;
      }

      const servicesBySpeciality: Record<string, Array<{ label: string; value: string }>> = {};
      const specialityIdSet = new Set<string>();
      matches.forEach((match) => {
        specialityIdSet.add(match.specialityId);
        if (!servicesBySpeciality[match.specialityId]) {
          servicesBySpeciality[match.specialityId] = [];
        }
        const alreadyExists = servicesBySpeciality[match.specialityId].some(
          (option) => option.value === match.serviceId
        );
        if (!alreadyExists) {
          servicesBySpeciality[match.specialityId].push({
            label: match.serviceName,
            value: match.serviceId,
          });
        }
      });

      const preferredMatch =
        (normalizedPrefillLeadId
          ? matches.find((match) =>
              (match.matchingSlot.vetIds ?? []).some(
                (vetId) => normalizeId(vetId) === normalizedPrefillLeadId
              )
            )
          : undefined) ?? matches[0];
      const prefillSlot = preferredMatch?.matchingSlot ?? null;
      if (prefillSlot) {
        setTimeSlots([prefillSlot]);
        setSelectedSlot(prefillSlot);
        const prefillLeadId = pendingPrefill.leadId ?? '';
        if (prefillLeadId) {
          const leadOption = getLeadOptionsForSlot(prefillSlot).find(
            (option) => normalizeId(option.value) === normalizeId(prefillLeadId)
          );
          if (leadOption) {
            setFormData((prev) => ({
              ...prev,
              lead: {
                id: leadOption.value,
                name: leadOption.label,
                profileUrl: getLeadProfileUrlRef.current(leadOption.value),
              },
            }));
          }
        }
      }
      setSlotScopedSpecialityIds(Array.from(specialityIdSet));
      setSlotScopedServicesBySpecialityId(servicesBySpeciality);
      setFormDataErrors((prev) => ({
        ...prev,
        slot: undefined,
      }));
      setPendingPrefill(null);
      setIsLoadingSlotScopedOptions(false);
    };

    resolveSlotScopedOptions().catch(() => {
      if (!cancelled) {
        setSlotScopedSpecialityIds([]);
        setSlotScopedServicesBySpecialityId({});
        setIsLoadingSlotScopedOptions(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    calendarSlotFlow,
    getLeadOptionsForSlot,
    getServicesBySpecialityId,
    normalizeId,
    pendingPrefill,
    specialities,
  ]);

  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;
    const slotMeta = slotMetaByRef.current.get(selectedSlot);
    if (slotMeta) {
      const { startTime, endTime, durationMinutes } = resolveSlotDateTimesForSelectedDay(
        selectedDate,
        slotMeta
      );
      setFormData((prev) => ({
        ...prev,
        startTime,
        endTime,
        appointmentDate: startTime,
        durationMinutes,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      startTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
      endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.endTime),
      appointmentDate: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
      durationMinutes: getDurationMinutes(selectedSlot.startTime, selectedSlot.endTime),
    }));
  }, [selectedSlot, selectedDate]);

  const LeadOptions = useMemo(
    () => getLeadOptionsForSlot(selectedSlot),
    [getLeadOptionsForSlot, selectedSlot]
  );

  useEffect(() => {
    currentLeadIdRef.current = formData.lead?.id || '';
  }, [formData.lead?.id]);

  useEffect(() => {
    if (!selectedSlot) return;
    const options = getLeadOptionsRef.current(selectedSlot);
    const currentLeadId = currentLeadIdRef.current;
    if (options.length === 0) {
      setSelectedSlot(null);
      setFormData((prev) => ({ ...prev, lead: undefined }));
      setFormDataErrors((prev) => ({
        ...prev,
        slot: 'No lead is available for this slot. Please choose another slot.',
        leadId: 'No lead is available for this slot.',
      }));
      return;
    }
    if (options.length === 1) {
      const onlyLead = options[0];
      if (currentLeadId !== onlyLead.value) {
        setFormData((prev) => ({
          ...prev,
          lead: {
            id: onlyLead.value,
            name: onlyLead.label,
            profileUrl: getLeadProfileUrlRef.current(onlyLead.value),
          },
        }));
      }
      setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      return;
    }
    const hasValidLead = options.some((option) => option.value === currentLeadId);
    if (!hasValidLead) {
      if (calendarSlotFlow && prefillLeadIdRef.current) {
        const matchedPrefillLead = options.find(
          (option) => normalizeId(option.value) === normalizeId(prefillLeadIdRef.current)
        );
        if (matchedPrefillLead) {
          setFormData((prev) => ({
            ...prev,
            lead: {
              id: matchedPrefillLead.value,
              name: matchedPrefillLead.label,
              profileUrl: getLeadProfileUrlRef.current(matchedPrefillLead.value),
            },
          }));
          setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
          return;
        }
      }
      setFormData((prev) => ({ ...prev, lead: undefined }));
      setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      return;
    }
    setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
  }, [calendarSlotFlow, normalizeId, selectedSlot]);

  useEffect(() => {
    if (calendarSlotFlow) return;
    if (!pendingPrefill) return;
    if (!formData.appointmentType?.id) return;
    if (!selectedDate || !timeSlots.length) return;

    const minute = Math.max(0, Math.min(1435, Math.round(pendingPrefill.minuteOfDay / 5) * 5));
    const matchingSlot =
      timeSlots.find((slot) => {
        const slotMeta = slotMetaByRef.current.get(slot);
        if (slotMeta) {
          return Math.abs(slotMeta.localStartMinute - minute) <= 5;
        }
        const startClock = utcClockTimeToPreferredTimeZoneClock(slot.startTime);
        return Math.abs(startClock.minutes - minute) <= 5;
      }) ?? null;

    if (!matchingSlot) {
      setFormDataErrors((prev) => ({
        ...prev,
        slot: 'Saved calendar slot is no longer available for this service. Please pick another slot.',
      }));
      setPendingPrefill(null);
      return;
    }

    const leadOptionsForSlot = getLeadOptionsForSlot(matchingSlot);
    setSelectedSlot(matchingSlot);

    if (pendingPrefill.leadId) {
      const selectedLead = leadOptionsForSlot.find(
        (option) => normalizeId(option.value) === normalizeId(pendingPrefill.leadId)
      );
      if (selectedLead) {
        setFormData((prev) => ({
          ...prev,
          lead: {
            id: selectedLead.value,
            name: selectedLead.label,
            profileUrl: getLeadProfileUrl(selectedLead.value),
          },
        }));
        setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      } else {
        setFormData((prev) => ({ ...prev, lead: undefined }));
        setFormDataErrors((prev) => ({
          ...prev,
          leadId: 'Saved lead is unavailable for this slot. Please choose another lead.',
        }));
      }
    }

    setPendingPrefill(null);
  }, [
    calendarSlotFlow,
    formData.appointmentType?.id,
    getLeadProfileUrl,
    getLeadOptionsForSlot,
    normalizeId,
    pendingPrefill,
    selectedDate,
    timeSlots,
  ]);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  const baseSpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities]
  );
  const SpecialitiesOptions = useMemo(() => {
    if (!calendarSlotFlow || !slotScopedSpecialityIds.length) {
      return baseSpecialitiesOptions;
    }
    const allowedSpecialityIds = new Set(slotScopedSpecialityIds);
    return baseSpecialitiesOptions.filter((option) => allowedSpecialityIds.has(option.value));
  }, [baseSpecialitiesOptions, calendarSlotFlow, slotScopedSpecialityIds]);

  const services = useMemo(() => {
    const specialityId = formData.appointmentType?.speciality.id;
    if (!specialityId) {
      return [];
    }
    return getServicesBySpecialityId(specialityId);
  }, [formData.appointmentType?.speciality, getServicesBySpecialityId]);

  const ServicesOptions = useMemo(() => {
    if (calendarSlotFlow) {
      const specialityId = formData.appointmentType?.speciality.id;
      if (!specialityId) return [];
      return slotScopedServicesBySpecialityId[specialityId] ?? [];
    }
    return services?.map((service) => ({
      label: service.name,
      value: service.id,
    }));
  }, [
    calendarSlotFlow,
    formData.appointmentType?.speciality.id,
    services,
    slotScopedServicesBySpecialityId,
  ]);

  useEffect(() => {
    if (!calendarSlotFlow || !slotScopedSpecialityIds.length) return;
    const selectedSpecialityId = formData.appointmentType?.speciality.id;
    if (!selectedSpecialityId) return;
    if (!slotScopedSpecialityIds.includes(selectedSpecialityId)) {
      setFormData((prev) => ({ ...prev, appointmentType: undefined }));
      return;
    }
    const selectedServiceId = formData.appointmentType?.id;
    if (!selectedServiceId) return;
    const allowedServices = slotScopedServicesBySpecialityId[selectedSpecialityId] ?? [];
    const hasService = allowedServices.some((option) => option.value === selectedServiceId);
    if (!hasService) {
      setFormData((prev) => ({
        ...prev,
        appointmentType: {
          ...prev.appointmentType,
          id: '',
          name: '',
          speciality: prev.appointmentType?.speciality ?? { id: '', name: '' },
        },
      }));
    }
  }, [
    calendarSlotFlow,
    formData.appointmentType,
    slotScopedServicesBySpecialityId,
    slotScopedSpecialityIds,
  ]);

  const ServiceInfoData = useMemo(() => {
    const serviceId = formData.appointmentType?.id;
    const emptyServiceInfo = {
      name: '',
      description: '',
      cost: '',
      maxDiscount: '',
      duration: '',
    };
    if (!serviceId) {
      return emptyServiceInfo;
    }
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      return {
        name: service.name ?? '',
        description: service.description ?? '',
        cost: service.cost ?? '',
        maxDiscount: service.maxDiscount ?? '',
        duration: service.durationMinutes ?? '',
      };
    }
    return emptyServiceInfo;
  }, [formData.appointmentType, services]);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_APPOINTMENT);
    setSelectedDate(new Date());
    setTimeSlots([]);
    setSelectedSlot(null);
    slotMetaByRef.current = new WeakMap();
    setPendingPrefill(null);
    prefillLeadIdRef.current = '';
    setSlotScopedSpecialityIds([]);
    setSlotScopedServicesBySpecialityId({});
    setIsLoadingSlotScopedOptions(false);
    setFormDataErrors({});
  }, []);

  const validateForm = useCallback(
    (requireCompanion: boolean = true) => {
      const errors: AppointmentFormErrors = {};
      if (!canMore) {
        errors.booking =
          reason === 'limit_reached'
            ? "You've reached your free appointment limit. Please upgrade to book more."
            : "We couldn't verify your booking limit right now. Please try again.";
      }
      if (requireCompanion && !formData.companion.id)
        errors.companionId = terminologyText('Please select a companion');
      if (!formData.appointmentType?.speciality.id)
        errors.specialityId = 'Please select a speciality';
      if (!formData.appointmentType?.id) errors.serviceId = 'Please select a service';
      if (!formData.concern?.trim()) errors.concern = 'Please describe the concern';
      if (!formData.durationMinutes) errors.duration = 'Please select a duration';
      const slotLeadOptions = getLeadOptionsForSlot(selectedSlot);
      if (!selectedSlot) {
        errors.slot = 'Please select a slot';
      } else if (slotLeadOptions.length === 0) {
        errors.slot = 'No lead is available for this slot. Please choose another slot.';
        errors.leadId = 'No lead is available for this slot.';
      } else if (slotLeadOptions.length > 1 && !formData.lead?.id) {
        errors.leadId = 'Multiple leads are available. Please choose a lead.';
      } else if (
        formData.lead?.id &&
        !slotLeadOptions.some((option) => option.value === formData.lead?.id)
      ) {
        errors.leadId = 'Selected lead is not available for this slot.';
      }
      return errors;
    },
    [canMore, reason, formData, getLeadOptionsForSlot, selectedSlot, terminologyText]
  );

  const handleCreate = useCallback(
    async (requireCompanion: boolean = true) => {
      const errors = validateForm(requireCompanion);
      setFormDataErrors(errors);
      if (Object.keys(errors).length > 0) {
        return false;
      }
      setIsLoading(true);
      try {
        await createAppointment(formData);
        await refetchData();
        await loadInvoicesForOrgPrimaryOrg({ force: true });
        resetForm();
        onSuccess?.();
        return true;
      } catch (error) {
        console.log(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [validateForm, formData, refetchData, resetForm, onSuccess]
  );

  const handleSpecialitySelect = useCallback((option: { label: string; value: string }) => {
    setFormData((prev) => ({
      ...prev,
      appointmentType: {
        id: '',
        name: '',
        speciality: {
          id: option.value,
          name: option.label,
        },
      },
    }));
    setFormDataErrors((prev) => ({ ...prev, specialityId: undefined, serviceId: undefined }));
  }, []);

  const handleServiceSelect = useCallback((option: { label: string; value: string }) => {
    setFormData((prev) => ({
      ...prev,
      appointmentType: {
        id: option.value,
        name: option.label,
        speciality: prev.appointmentType?.speciality ?? {
          id: '',
          name: '',
        },
      },
    }));
    setFormDataErrors((prev) => ({ ...prev, serviceId: undefined, slot: undefined }));
  }, []);

  const handleLeadSelect = useCallback(
    (option: { label: string; value: string }) => {
      setFormData((prev) => ({
        ...prev,
        lead: {
          name: option.label,
          id: option.value,
          profileUrl: getLeadProfileUrl(option.value),
        },
      }));
      setFormDataErrors((prev) => ({ ...prev, leadId: undefined }));
    },
    [getLeadProfileUrl]
  );

  const handleSupportStaffChange = useCallback(
    (ids: string[]) => {
      const map = new Map(
        TeamOptions.map((o) => (typeof o === 'string' ? [o, o] : [o.value, o.label]))
      );
      setFormData((prev) => ({
        ...prev,
        supportStaff: ids.map((id) => ({
          id,
          name: map.get(id) || '',
        })),
      }));
    },
    [TeamOptions]
  );

  return {
    formData,
    setFormData,
    formDataErrors,
    setFormDataErrors,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    timeSlots,
    isLoading,
    currency,
    teams,
    specialities,
    services,
    isLoadingSlotScopedOptions,
    ServiceFields,
    CompanionFields,
    LeadOptions,
    TeamOptions,
    SpecialitiesOptions,
    ServicesOptions,
    ServiceInfoData,
    canMore,
    handleCreate,
    handleSpecialitySelect,
    handleServiceSelect,
    handleLeadSelect,
    handleSupportStaffChange,
    resetForm,
    validateForm,
  };
};
