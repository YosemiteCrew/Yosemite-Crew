import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appointment, AppointmentKind, Service } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { Slot, AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import {
  CalendarPrefillSlotMatch,
  createAppointment,
  getCalendarPrefillMatchesForPrimaryOrg,
  loadAppointmentsForPrimaryOrg,
  getSlotsForServiceAndDateForPrimaryOrg,
} from '@/app/features/appointments/services/appointmentService';
import { buildUtcDateFromDateAndTime, getDurationMinutes } from '@/app/lib/date';
import {
  buildDateInPreferredTimeZone,
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
import { EMPTY_APPOINTMENT } from '@/app/features/appointments/constants/emptyAppointment';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { Team } from '@/app/features/organization/types/team';
import { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';
import {
  hasBookableBreakdownItem,
  hasInpatientBreakdownItem,
} from '@/app/features/organization/services/catalogBookable';

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
  onSuccess?: (createdAppointment?: Appointment) => void | Promise<void>;
  initialPrefill?: AppointmentDraftPrefill | null;
  calendarSlotFlow?: boolean;
  appointmentKind?: AppointmentKind;
};

type SlotScopedMatch = {
  specialityId: string;
  serviceId: string;
  serviceName: string;
  matchingSlot: Slot;
  matchingSlotMeta: NormalizedSlotMeta;
};

type LeadOption = { value: string; label: string };
type AppointmentCatalogService = Pick<
  Service,
  'id' | 'name' | 'description' | 'durationMinutes' | 'cost' | 'maxDiscount' | 'specialityId'
> & {
  isBookable?: boolean;
  isInpatientPreferred?: boolean;
  isPackage?: boolean;
};

const mapRevampServiceForAppointment = (service: ServiceRevamp): AppointmentCatalogService => ({
  id: service.id,
  name: service.name,
  description: service.description,
  durationMinutes: service.durationMinutes,
  cost: service.grossAmount,
  maxDiscount: service.maxDiscount,
  specialityId: service.specialityId,
  isBookable: service.isBookable,
  isInpatientPreferred: service.isInpatientPreferred,
});

const mapRevampPackageForAppointment = (pkg: PackageRevamp): AppointmentCatalogService => ({
  id: pkg.id,
  name: pkg.name,
  description: pkg.description,
  durationMinutes: 0,
  cost: pkg.serverFinalAmount ?? 0,
  maxDiscount: undefined,
  specialityId: pkg.specialityId,
  isBookable: pkg.isBookable || hasBookableBreakdownItem(pkg.breakdown),
  isInpatientPreferred: pkg.isInpatientPreferred || hasInpatientBreakdownItem(pkg.breakdown),
  isPackage: true,
});

const isSelectableAppointmentService = (service: AppointmentCatalogService) =>
  service.isBookable !== false;

const resolveServiceAppointmentKind = (
  service: AppointmentCatalogService | undefined,
  fallback: AppointmentKind
): AppointmentKind => {
  if (service?.isInpatientPreferred === true) return 'INPATIENT';
  if (service) return 'OUTPATIENT';
  return fallback;
};

const mergeServicesById = (
  primary: AppointmentCatalogService[],
  fallback: AppointmentCatalogService[]
): AppointmentCatalogService[] => {
  const byId = new Map<string, AppointmentCatalogService>();
  fallback.forEach((service) => {
    if (service.id) byId.set(service.id, service);
  });
  primary.forEach((service) => {
    if (service.id) byId.set(service.id, service);
  });
  return Array.from(byId.values());
};

const getNextSelectedSlot = (
  availableSlots: Slot[],
  previousSlot: Slot | null,
  preserveExistingSelection: boolean = false
) => {
  if (!previousSlot) return preserveExistingSelection ? null : (availableSlots[0] ?? null);
  // Match on startTime only — different services can have different durations so endTime varies.
  const matchingSlot = availableSlots.find((slot) => slot.startTime === previousSlot.startTime);
  return matchingSlot ?? (preserveExistingSelection ? null : (availableSlots[0] ?? null));
};

const validateSlotSelection = (
  selectedSlot: Slot | null,
  leadId: string | undefined,
  slotLeadOptions: LeadOption[]
): AppointmentFormErrors => {
  if (!selectedSlot) {
    return { slot: 'Please select a slot' };
  }
  if (slotLeadOptions.length === 0) {
    return {
      slot: 'No lead is available for this slot. Please choose another slot.',
      leadId: 'No lead is available for this slot.',
    };
  }
  if (slotLeadOptions.length > 1 && !leadId) {
    return { leadId: 'Multiple leads are available. Please choose a lead.' };
  }
  if (leadId && !slotLeadOptions.some((option) => option.value === leadId)) {
    return { leadId: 'Selected lead is not available for this slot.' };
  }
  return {};
};

const hasMatchingLead = (
  slot: Slot,
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
) =>
  !normalizedPrefillLeadId ||
  (slot.vetIds ?? []).some((vetId) => normalizeId(vetId) === normalizedPrefillLeadId);

const matchesPrefillSlot = (
  localStartMinute: number,
  minute: number,
  slot: Slot,
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
) => {
  if (Math.abs(localStartMinute - minute) > 5) return false;
  return hasMatchingLead(slot, normalizedPrefillLeadId, normalizeId);
};

const upsertServiceOptionBySpeciality = (
  servicesBySpeciality: Record<string, Array<{ label: string; value: string }>>,
  match: SlotScopedMatch
) => {
  if (!servicesBySpeciality[match.specialityId]) {
    servicesBySpeciality[match.specialityId] = [];
  }
  const alreadyExists = servicesBySpeciality[match.specialityId].some(
    (option) => option.value === match.serviceId
  );
  if (alreadyExists) return;
  servicesBySpeciality[match.specialityId].push({
    label: match.serviceName,
    value: match.serviceId,
  });
};

const findPreferredSlotMatch = (
  matches: SlotScopedMatch[],
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
) => {
  if (!normalizedPrefillLeadId) return matches[0];
  return (
    matches.find((match) =>
      (match.matchingSlot.vetIds ?? []).some(
        (vetId) => normalizeId(vetId) === normalizedPrefillLeadId
      )
    ) ?? matches[0]
  );
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, limit);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(safeLimit, items.length) }, () => worker()));
  return results;
};

type ThreeDaySlots = {
  previousDateSlots: Slot[];
  selectedDateSlots: Slot[];
  nextDateSlots: Slot[];
};

const fetchThreeDaySlots = async (serviceId: string, date: Date): Promise<ThreeDaySlots> => {
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const [previousDateSlots, selectedDateSlots, nextDateSlots] = await Promise.all([
    getSlotsForServiceAndDateForPrimaryOrg(serviceId, previousDate),
    getSlotsForServiceAndDateForPrimaryOrg(serviceId, date),
    getSlotsForServiceAndDateForPrimaryOrg(serviceId, nextDate),
  ]);
  return { previousDateSlots, selectedDateSlots, nextDateSlots };
};

const resolveSlotScopedMatchForCandidate = (
  candidate: { specialityId: string; serviceId: string; serviceName: string },
  threeDaySlots: ThreeDaySlots,
  minute: number,
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
): SlotScopedMatch | null => {
  const normalizedEntries = normalizeSlotsForSelectedDay([
    { dayShift: -1, slots: threeDaySlots.previousDateSlots },
    { dayShift: 0, slots: threeDaySlots.selectedDateSlots },
    { dayShift: 1, slots: threeDaySlots.nextDateSlots },
  ]);

  const matchingEntry =
    normalizedEntries.find((entry) =>
      matchesPrefillSlot(
        entry.meta.localStartMinute,
        minute,
        entry.slot,
        normalizedPrefillLeadId,
        normalizeId
      )
    ) ?? null;

  if (!matchingEntry) return null;
  return {
    ...candidate,
    matchingSlot: matchingEntry.slot,
    matchingSlotMeta: matchingEntry.meta,
  };
};

type ServiceCandidate = { specialityId: string; serviceId: string; serviceName: string };

const collectUniqueServiceIds = (serviceCandidates: ServiceCandidate[]): string[] => {
  const serviceIds = new Set<string>();
  for (const candidate of serviceCandidates) {
    if (candidate.serviceId) serviceIds.add(candidate.serviceId);
  }
  return [...serviceIds];
};

const collectResolvedMatches = (
  serviceCandidates: ServiceCandidate[],
  matchesByServiceId: Map<string, SlotScopedMatch>
): SlotScopedMatch[] => {
  const matches: SlotScopedMatch[] = [];
  for (const candidate of serviceCandidates) {
    const match = matchesByServiceId.get(candidate.serviceId);
    if (match) matches.push(match);
  }
  return matches;
};

const populateBulkMatches = (
  bulkMatches: CalendarPrefillSlotMatch[],
  serviceCandidates: ServiceCandidate[],
  matchesByServiceId: Map<string, SlotScopedMatch>,
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
) => {
  const candidatesByServiceId = new Map(
    serviceCandidates.map((candidate) => [candidate.serviceId, candidate] as const)
  );
  bulkMatches.forEach((match) => {
    const candidate = candidatesByServiceId.get(match.serviceId);
    if (!candidate) return;
    if (!hasMatchingLead(match.slot, normalizedPrefillLeadId, normalizeId)) return;
    matchesByServiceId.set(match.serviceId, {
      ...candidate,
      matchingSlot: match.slot,
      matchingSlotMeta: match.meta,
    });
  });
};

const populateFallbackMatches = async (
  uniqueServiceIds: string[],
  serviceCandidates: ServiceCandidate[],
  matchesByServiceId: Map<string, SlotScopedMatch>,
  date: Date,
  minute: number,
  normalizedPrefillLeadId: string,
  normalizeId: (value?: string) => string
) => {
  const slotsByServiceId = new Map<string, ThreeDaySlots>();
  await mapWithConcurrency(uniqueServiceIds, 4, async (serviceId) => {
    const slots = await fetchThreeDaySlots(serviceId, date);
    slotsByServiceId.set(serviceId, slots);
    return slots;
  });
  serviceCandidates.forEach((candidate) => {
    const threeDaySlots = slotsByServiceId.get(candidate.serviceId);
    if (!threeDaySlots) return;
    const resolvedMatch = resolveSlotScopedMatchForCandidate(
      candidate,
      threeDaySlots,
      minute,
      normalizedPrefillLeadId,
      normalizeId
    );
    if (!resolvedMatch) return;
    matchesByServiceId.set(candidate.serviceId, resolvedMatch);
  });
};

type ApplyPrefillSlotCtx = {
  setTimeSlots: (slots: Slot[]) => void;
  setSelectedSlot: (slot: Slot | null) => void;
  getLeadOptionsForSlot: (slot: Slot) => LeadOption[];
  normalizeId: (value?: string) => string;
  getLeadProfileUrl: (id: string) => string | undefined;
  setFormData: React.Dispatch<React.SetStateAction<AppointmentWithCompanion>>;
};

const applyPrefillSlot = (
  prefillSlot: Slot,
  preferredMatch: SlotScopedMatch,
  prefillLeadId: string,
  slotMetaByRef: { current: WeakMap<Slot, NormalizedSlotMeta> },
  ctx: ApplyPrefillSlotCtx
) => {
  const slotMetaMap = new WeakMap<Slot, NormalizedSlotMeta>();
  slotMetaMap.set(prefillSlot, preferredMatch.matchingSlotMeta);
  slotMetaByRef.current = slotMetaMap;
  ctx.setTimeSlots([prefillSlot]);
  ctx.setSelectedSlot(prefillSlot);
  if (!prefillLeadId) return;
  const leadOption = ctx
    .getLeadOptionsForSlot(prefillSlot)
    .find((option) => ctx.normalizeId(option.value) === ctx.normalizeId(prefillLeadId));
  if (!leadOption) return;
  ctx.setFormData((prev) => ({
    ...prev,
    lead: {
      id: leadOption.value,
      name: leadOption.label,
      profileUrl: ctx.getLeadProfileUrl(leadOption.value),
    },
  }));
};

type IncomingPrefillCtx = {
  teams: Team[];
  normalizeId: (value?: string) => string;
  getLeadProfileUrl: (leadId: string) => string | undefined;
  setPendingPrefill: React.Dispatch<React.SetStateAction<AppointmentDraftPrefill | null>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  setFormData: React.Dispatch<React.SetStateAction<AppointmentWithCompanion>>;
};

const applyIncomingPrefill = (prefill: AppointmentDraftPrefill, ctx: IncomingPrefillCtx) => {
  ctx.setPendingPrefill(prefill);
  ctx.setSelectedDate(prefill.date);
  ctx.setSelectedSlot(null);
  const prefillStart = buildDateInPreferredTimeZone(prefill.date, prefill.minuteOfDay);

  // Prefill lead immediately from teams — before service/slot are chosen.
  // The pendingPrefill effect re-validates once a slot is matched.
  const prefillLead = prefill.leadId
    ? ctx.teams.find(
        (t) => ctx.normalizeId(t.practionerId || t._id) === ctx.normalizeId(prefill.leadId)
      )
    : undefined;
  const prefillLeadId = prefillLead ? prefillLead.practionerId || prefillLead._id : undefined;
  const prefillLeadName = prefillLead?.name || prefillLead?.practionerId || prefillLead?._id;

  ctx.setFormData((prev) => ({
    ...prev,
    appointmentDate: prefillStart,
    startTime: prefillStart,
    endTime: prefillStart,
    ...(prefillLeadId
      ? {
          lead: {
            id: prefillLeadId,
            name: prefillLeadName ?? '',
            profileUrl: ctx.getLeadProfileUrl(prefillLeadId),
          },
        }
      : {}),
  }));
};

type ServiceKindSyncCtx = {
  appointmentKind: AppointmentKind;
  services: AppointmentCatalogService[];
  setFormData: React.Dispatch<React.SetStateAction<AppointmentWithCompanion>>;
  setFormDataErrors: React.Dispatch<React.SetStateAction<AppointmentFormErrors>>;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  setTimeSlots: React.Dispatch<React.SetStateAction<Slot[]>>;
};

// Align the appointment kind with the selected service's preference, or clear a
// selected service that is no longer bookable.
const syncServiceSelectionWithKind = (
  selectedServiceId: string | undefined,
  ctx: ServiceKindSyncCtx
) => {
  if (!selectedServiceId) return;
  const selectedService = ctx.services.find((service) => service.id === selectedServiceId);
  if (!selectedService) return;
  const serviceAppointmentKind = resolveServiceAppointmentKind(
    selectedService,
    ctx.appointmentKind
  );
  if (serviceAppointmentKind !== ctx.appointmentKind) {
    ctx.setFormData((prev) => ({
      ...prev,
      appointmentKind: serviceAppointmentKind,
    }));
    return;
  }
  if (isSelectableAppointmentService(selectedService)) return;
  ctx.setSelectedSlot(null);
  ctx.setTimeSlots([]);
  ctx.setFormData((prev) => ({
    ...prev,
    appointmentKind: ctx.appointmentKind,
    appointmentType: {
      id: '',
      name: '',
      speciality: prev.appointmentType?.speciality ?? { id: '', name: '' },
    },
    lead: undefined,
  }));
  ctx.setFormDataErrors((prev) => ({
    ...prev,
    serviceId: 'Select a bookable service.',
    slot: undefined,
    leadId: undefined,
  }));
};

type SlotScopePruneCtx = {
  slotScopedSpecialityIds: string[];
  slotScopedServicesBySpecialityId: Record<string, Array<{ label: string; value: string }>>;
  setFormData: React.Dispatch<React.SetStateAction<AppointmentWithCompanion>>;
};

// Empty any speciality/service selection that falls outside the slot-scoped
// options; each correction self-invalidates on the follow-up render.
const pruneSelectionsOutsideSlotScope = (
  appointmentType: AppointmentWithCompanion['appointmentType'],
  ctx: SlotScopePruneCtx
) => {
  const selectedSpecialityId = appointmentType?.speciality.id;
  if (!selectedSpecialityId) return;
  if (!ctx.slotScopedSpecialityIds.includes(selectedSpecialityId)) {
    ctx.setFormData((prev) => ({ ...prev, appointmentType: undefined }));
    return;
  }
  const selectedServiceId = appointmentType?.id;
  if (!selectedServiceId) return;
  const allowedServices = ctx.slotScopedServicesBySpecialityId[selectedSpecialityId] ?? [];
  const hasService = allowedServices.some((option) => option.value === selectedServiceId);
  if (hasService) return;
  ctx.setFormData((prev) => ({
    ...prev,
    appointmentType: {
      ...prev.appointmentType,
      id: '',
      name: '',
      speciality: prev.appointmentType?.speciality ?? { id: '', name: '' },
    },
  }));
};

export const useAppointmentForm = (options: UseAppointmentFormOptions = {}) => {
  const {
    onSuccess,
    initialPrefill,
    calendarSlotFlow = false,
    appointmentKind = 'OUTPATIENT',
  } = options;
  const terminologyText = useCompanionTerminologyText();

  const teams = useTeamForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const revampServices = useRevampCatalogStore((state) => state.services);
  const revampPackages = useRevampCatalogStore((state) => state.packages);
  const loadSpecialityCatalog = useRevampCatalogStore((state) => state.loadSpecialityCatalog);
  const { canMore, reason } = useCanMoreForPrimaryOrg('appointments');
  const { refetch: refetchData } = useSubscriptionCounterUpdate();

  const [formData, setFormData] = useState<AppointmentWithCompanion>(
    EMPTY_APPOINTMENT as AppointmentWithCompanion
  );
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
  const getAppointmentServicesBySpecialityId = useCallback(
    (specialityId: string): AppointmentCatalogService[] => {
      const legacyServices = useServiceStore.getState().getServicesBySpecialityId(specialityId);
      const catalogEntries: AppointmentCatalogService[] = [];
      for (const service of revampServices) {
        if (
          service.specialityId === specialityId &&
          service.status === 'ACTIVE' &&
          service.organisationId === primaryOrgId
        ) {
          catalogEntries.push(mapRevampServiceForAppointment(service));
        }
      }
      for (const pkg of revampPackages) {
        if (
          pkg.specialityId === specialityId &&
          pkg.status === 'ACTIVE' &&
          pkg.organisationId === primaryOrgId
        ) {
          catalogEntries.push(mapRevampPackageForAppointment(pkg));
        }
      }
      return mergeServicesById(catalogEntries, legacyServices);
    },
    [primaryOrgId, revampPackages, revampServices]
  );

  const ServiceFields = useMemo(
    () => [
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
      const vetIdSet = new Set((slot.vetIds ?? []).map((vetId) => normalizeId(vetId)));
      if (!vetIdSet.size) return [];
      const leadOptions = [];
      for (const team of teams) {
        const teamId = team.practionerId || team._id;
        if (!teamId || !vetIdSet.has(normalizeId(teamId))) continue;
        leadOptions.push({
          label: team.name || team.practionerId || team._id,
          value: team.practionerId || team._id,
        });
      }
      return leadOptions;
    },
    [normalizeId, teams]
  );
  const getLeadOptionsRef = useRef(getLeadOptionsForSlot);
  useEffect(() => {
    getLeadOptionsRef.current = getLeadOptionsForSlot;
  });
  const getLeadProfileUrl = useCallback(
    (leadId: string) => {
      const matchedTeam = teams.find((team) => (team.practionerId || team._id) === leadId);
      return typeof matchedTeam?.image === 'string' ? matchedTeam.image : undefined;
    },
    [teams]
  );
  const getLeadProfileUrlRef = useRef(getLeadProfileUrl);
  useEffect(() => {
    getLeadProfileUrlRef.current = getLeadProfileUrl;
  });

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

  // Apply an incoming prefill during render, guarded by the previous prefill
  // identity so teams updates (or unrelated renders) don't wipe user edits.
  const [prevInitialPrefill, setPrevInitialPrefill] = useState<
    AppointmentDraftPrefill | null | undefined
  >(undefined);
  if (prevInitialPrefill !== initialPrefill) {
    setPrevInitialPrefill(initialPrefill);
    if (initialPrefill) {
      applyIncomingPrefill(initialPrefill, {
        teams,
        normalizeId,
        getLeadProfileUrl,
        setPendingPrefill,
        setSelectedDate,
        setSelectedSlot,
        setFormData,
      });
    }
  }

  // Stamp the prefill lead id where later effects (slot/lead reconciliation)
  // can read it without re-triggering on teams changes.
  useEffect(() => {
    if (!initialPrefill) return;
    prefillLeadIdRef.current = initialPrefill.leadId || '';
  }, [initialPrefill]);

  useEffect(() => {
    const specialityId = formData.appointmentType?.speciality.id;
    if (!primaryOrgId || !specialityId) return;
    loadSpecialityCatalog(primaryOrgId, specialityId).catch((error: unknown) => {
      console.error('Failed to load services for speciality:', error);
    });
  }, [formData.appointmentType?.speciality.id, loadSpecialityCatalog, primaryOrgId]);

  useEffect(() => {
    if (!calendarSlotFlow || !pendingPrefill || !primaryOrgId || !specialities.length) return;
    const specialityIds: string[] = [];
    for (const speciality of specialities) {
      const specialityId = String(speciality._id ?? '').trim();
      if (specialityId) specialityIds.push(specialityId);
    }
    Promise.all(
      specialityIds.map((specialityId) => loadSpecialityCatalog(primaryOrgId, specialityId))
    ).catch((error: unknown) => {
      console.error('Failed to load calendar slot services:', error);
    });
  }, [calendarSlotFlow, loadSpecialityCatalog, pendingPrefill, primaryOrgId, specialities]);

  useEffect(() => {
    if (!calendarSlotFlow) return;
    if (!pendingPrefill) return;
    if (!specialities.length) return;

    const minute = Math.max(0, Math.min(1435, Math.round(pendingPrefill.minuteOfDay / 5) * 5));
    const normalizedPrefillLeadId = normalizeId(pendingPrefill.leadId);
    const serviceCandidates = specialities.flatMap((speciality) => {
      const specialityId = String(speciality._id ?? '').trim();
      if (!specialityId) return [];
      const servicesForSpeciality = getAppointmentServicesBySpecialityId(specialityId);
      return servicesForSpeciality.map((service) => ({
        specialityId,
        serviceId: String(service.id ?? '').trim(),
        serviceName: service.name ?? '',
      }));
    });
    if (!serviceCandidates.length) return;

    let cancelled = false;
    const resolveSlotScopedOptions = async () => {
      setIsLoadingSlotScopedOptions(true);
      const uniqueServiceIds = collectUniqueServiceIds(serviceCandidates);
      const matchesByServiceId = new Map<string, SlotScopedMatch>();
      let bulkMatches = await getCalendarPrefillMatchesForPrimaryOrg({
        date: pendingPrefill.date,
        minuteOfDay: minute,
        leadId: pendingPrefill.leadId,
        serviceIds: uniqueServiceIds,
      });
      if (cancelled) return;

      if (bulkMatches?.length === 0 && normalizedPrefillLeadId) {
        bulkMatches = await getCalendarPrefillMatchesForPrimaryOrg({
          date: pendingPrefill.date,
          minuteOfDay: minute,
          leadId: undefined,
          serviceIds: uniqueServiceIds,
        });
        if (cancelled) return;
      }

      if (bulkMatches) {
        populateBulkMatches(
          bulkMatches,
          serviceCandidates,
          matchesByServiceId,
          normalizedPrefillLeadId,
          normalizeId
        );
      } else {
        // Fallback path until the backend bulk endpoint is deployed.
        await populateFallbackMatches(
          uniqueServiceIds,
          serviceCandidates,
          matchesByServiceId,
          pendingPrefill.date,
          minute,
          normalizedPrefillLeadId,
          normalizeId
        );
        if (cancelled) return;
      }
      if (cancelled) return;

      const matches = collectResolvedMatches(serviceCandidates, matchesByServiceId);

      if (!matches.length) {
        setSlotScopedSpecialityIds([]);
        setSlotScopedServicesBySpecialityId({});
        setTimeSlots([]);
        setSelectedSlot(null);
        slotMetaByRef.current = new WeakMap();
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
        upsertServiceOptionBySpeciality(servicesBySpeciality, match);
      });

      const preferredMatch = findPreferredSlotMatch(matches, normalizedPrefillLeadId, normalizeId);
      const prefillSlot = preferredMatch?.matchingSlot ?? null;
      if (prefillSlot) {
        applyPrefillSlot(prefillSlot, preferredMatch, pendingPrefill.leadId ?? '', slotMetaByRef, {
          setTimeSlots,
          setSelectedSlot,
          getLeadOptionsForSlot,
          normalizeId,
          getLeadProfileUrl: getLeadProfileUrlRef.current,
          setFormData,
        });
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
    getAppointmentServicesBySpecialityId,
    getLeadOptionsForSlot,
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

  // When no slot is selected yet (e.g. prefill just opened, service not chosen), the slot-derived
  // lead options are empty. But if formData.lead is already set (from prefill), surface it as a
  // single option so the dropdown can display the name and the user sees the prefill immediately.
  // Once a slot loads, this falls back to the real slot-scoped options automatically.
  const slotLeadOptions = useMemo(
    () => getLeadOptionsForSlot(selectedSlot),
    [getLeadOptionsForSlot, selectedSlot]
  );
  const formLeadId = formData.lead?.id;
  const formLeadName = formData.lead?.name;
  const LeadOptions = useMemo((): LeadOption[] => {
    if (slotLeadOptions.length > 0) return slotLeadOptions;
    if (formLeadId && formLeadName) {
      return [{ value: formLeadId, label: formLeadName }];
    }
    return slotLeadOptions;
  }, [slotLeadOptions, formLeadId, formLeadName]);

  // Context-aware message for the lead field empty state.
  const leadEmptyStateMessage = useMemo((): string => {
    if (formData.appointmentType?.id) return 'No leads available for this slot';
    if (formData.appointmentType?.speciality?.id) return 'Select a service to see available leads';
    return 'Select a speciality and service first';
  }, [formData.appointmentType?.id, formData.appointmentType?.speciality?.id]);

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
      // Try to match the prefill lead regardless of flow mode.
      if (prefillLeadIdRef.current) {
        const matchedPrefillLead = options.find(
          (option) => normalizeId(option.value) === normalizeId(prefillLeadIdRef.current)
        );
        if (matchedPrefillLead) {
          currentLeadIdRef.current = matchedPrefillLead.value;
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
    const getSlotStartMinute = (slot: Slot): number => {
      const slotMeta = slotMetaByRef.current.get(slot);
      if (slotMeta) return slotMeta.localStartMinute;
      return utcClockTimeToPreferredTimeZoneClock(slot.startTime).minutes;
    };
    const matchingSlot = timeSlots.reduce<Slot | null>((best, slot) => {
      const diff = Math.abs(getSlotStartMinute(slot) - minute);
      if (!best) return diff <= 240 ? slot : null;
      return diff < Math.abs(getSlotStartMinute(best) - minute) ? slot : best;
    }, null);

    if (!matchingSlot) {
      setPendingPrefill(null);
      return;
    }

    const leadOptionsForSlot = getLeadOptionsForSlot(matchingSlot);

    if (pendingPrefill.leadId) {
      const prefillLeadOption = leadOptionsForSlot.find(
        (option) => normalizeId(option.value) === normalizeId(pendingPrefill.leadId)
      );
      if (prefillLeadOption) {
        // Prefill lead supports this slot — keep it. Stamp ref so selectedSlot effect
        // sees it as already committed and does not clear it.
        currentLeadIdRef.current = prefillLeadOption.value;
        setFormData((prev) => ({
          ...prev,
          lead: {
            id: prefillLeadOption.value,
            name: prefillLeadOption.label,
            profileUrl: getLeadProfileUrl(prefillLeadOption.value),
          },
        }));
        setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      } else if (leadOptionsForSlot.length === 1) {
        // Prefill lead not available for this service/slot, but only one other lead is —
        // auto-select that one and clear the prefill lead.
        const onlyLead = leadOptionsForSlot[0];
        currentLeadIdRef.current = onlyLead.value;
        setFormData((prev) => ({
          ...prev,
          lead: {
            id: onlyLead.value,
            name: onlyLead.label,
            profileUrl: getLeadProfileUrl(onlyLead.value),
          },
        }));
        setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
      } else {
        // Prefill lead not available and multiple other leads exist — clear prefill lead,
        // require manual selection.
        currentLeadIdRef.current = '';
        setFormData((prev) => ({ ...prev, lead: undefined }));
        setFormDataErrors((prev) => ({
          ...prev,
          leadId:
            leadOptionsForSlot.length > 1
              ? 'Multiple leads are available for this service. Please choose a lead.'
              : 'No lead is available for this slot. Please choose another slot.',
        }));
      }
    } else if (leadOptionsForSlot.length === 1) {
      // No prefill lead — auto-select if only one available.
      const onlyLead = leadOptionsForSlot[0];
      currentLeadIdRef.current = onlyLead.value;
      setFormData((prev) => ({
        ...prev,
        lead: {
          id: onlyLead.value,
          name: onlyLead.label,
          profileUrl: getLeadProfileUrl(onlyLead.value),
        },
      }));
      setFormDataErrors((prev) => ({ ...prev, slot: undefined, leadId: undefined }));
    }

    setSelectedSlot(matchingSlot);
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
    return getAppointmentServicesBySpecialityId(specialityId);
  }, [formData.appointmentType?.speciality.id, getAppointmentServicesBySpecialityId]);

  const ServicesOptions = useMemo(() => {
    if (calendarSlotFlow) {
      const specialityId = formData.appointmentType?.speciality.id;
      if (!specialityId) return [];
      return slotScopedServicesBySpecialityId[specialityId] ?? [];
    }
    const options = [];
    for (const service of services) {
      if (!isSelectableAppointmentService(service)) continue;
      options.push({
        label: service.name,
        value: service.id,
        badge: service.isPackage ? 'Package' : undefined,
      });
    }
    return options;
  }, [
    calendarSlotFlow,
    formData.appointmentType?.speciality.id,
    services,
    slotScopedServicesBySpecialityId,
  ]);

  // Reconcile the selected service with the appointment kind during render,
  // guarded by the previous inputs so the adjustment runs once per change.
  // slotMetaByRef is not cleared here: its keys are held weakly and every slot
  // load replaces the map wholesale, so stale entries are unreachable.
  const [prevServiceKindSync, setPrevServiceKindSync] = useState<{
    appointmentKind: AppointmentKind;
    serviceId: string | undefined;
    services: AppointmentCatalogService[];
  } | null>(null);
  if (
    prevServiceKindSync?.appointmentKind !== appointmentKind ||
    prevServiceKindSync?.serviceId !== formData.appointmentType?.id ||
    prevServiceKindSync?.services !== services
  ) {
    setPrevServiceKindSync({
      appointmentKind,
      serviceId: formData.appointmentType?.id,
      services,
    });
    syncServiceSelectionWithKind(formData.appointmentType?.id, {
      appointmentKind,
      services,
      setFormData,
      setFormDataErrors,
      setSelectedSlot,
      setTimeSlots,
    });
  }

  // Prune selections that fall outside the slot-scoped options during render.
  // Each correction empties the offending selection, so the condition
  // self-invalidates on the follow-up render.
  if (calendarSlotFlow && slotScopedSpecialityIds.length) {
    pruneSelectionsOutsideSlotScope(formData.appointmentType, {
      slotScopedSpecialityIds,
      slotScopedServicesBySpecialityId,
      setFormData,
    });
  }

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
    setFormData(EMPTY_APPOINTMENT as AppointmentWithCompanion);
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
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (selectedDate < todayStart) {
        errors.slot = 'Appointments cannot be booked for past dates.';
      }
      if (requireCompanion && !formData.companion.id) {
        errors.companionId = terminologyText('Please select a companion');
      }
      if (!formData.appointmentType?.speciality.id) {
        errors.specialityId = 'Please select a speciality';
      }
      if (!formData.appointmentType?.id?.trim()) {
        errors.serviceId = 'Please select a service';
      } else {
        const selectedService = services.find(
          (service) => service.id === formData.appointmentType?.id
        );
        if (selectedService && !isSelectableAppointmentService(selectedService)) {
          errors.serviceId = 'Select a bookable service.';
        }
      }
      if (!formData.concern?.trim()) {
        errors.concern = 'Please describe the concern';
      }
      if (!formData.durationMinutes) {
        errors.duration = 'Please select a duration';
      }
      const slotLeadOptions = getLeadOptionsForSlot(selectedSlot);
      Object.assign(
        errors,
        validateSlotSelection(selectedSlot, formData.lead?.id, slotLeadOptions)
      );
      return errors;
    },
    [
      canMore,
      reason,
      formData,
      getLeadOptionsForSlot,
      selectedDate,
      selectedSlot,
      services,
      terminologyText,
    ]
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
        const createdAppointment = await createAppointment(formData);
        const syncResults = await Promise.allSettled([
          loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
          refetchData(),
          loadInvoicesForOrgPrimaryOrg({ force: true }),
        ]);
        const rejectedSync = syncResults.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );
        if (rejectedSync) {
          console.error('Appointment created but follow-up refresh failed:', rejectedSync.reason);
        }
        if (createdAppointment?.id) {
          useAppointmentStore.getState().upsertAppointment(createdAppointment);
        }
        if (onSuccess) {
          await onSuccess(createdAppointment);
        } else {
          resetForm();
        }
        return true;
      } catch (error) {
        console.error('Failed to create appointment:', error);
        setFormDataErrors((prev) => ({
          ...prev,
          booking: 'Unable to book appointment. Please try again.',
        }));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [validateForm, formData, refetchData, resetForm, onSuccess]
  );

  const handleSpecialitySelect = useCallback(
    (option: { label: string; value: string }) => {
      setFormData((prev) => ({
        ...prev,
        appointmentKind,
        // Clear any slot-derived duration so the badge follows the new speciality.
        durationMinutes: 0,
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
    },
    [appointmentKind]
  );

  const handleServiceSelect = useCallback(
    (option: { label: string; value: string }) => {
      const selectedService = services.find((service) => service.id === option.value);
      const serviceAppointmentKind = resolveServiceAppointmentKind(
        selectedService,
        appointmentKind
      );
      if (selectedService && !isSelectableAppointmentService(selectedService)) {
        setFormDataErrors((prev) => ({
          ...prev,
          serviceId: 'Select a bookable service.',
        }));
        return;
      }
      setFormData((prev) => ({
        ...prev,
        appointmentKind: serviceAppointmentKind,
        // Clear any slot-derived duration so the badge follows the new service - but only when the
        // service actually changes. Re-selecting the same service does not re-run the slot-load
        // effect, so zeroing here would strand durationMinutes at 0 and block booking with
        // "Please select a duration".
        durationMinutes: prev.appointmentType?.id === option.value ? prev.durationMinutes : 0,
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
    },
    [appointmentKind, services]
  );

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
    leadEmptyStateMessage,
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
