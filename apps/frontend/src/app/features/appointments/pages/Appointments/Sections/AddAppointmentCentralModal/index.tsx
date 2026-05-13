'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@/app/ui/primitives/Buttons/ButtonEffects.css';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { formatTimeLabel } from '@/app/lib/forms';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';
import { Slot } from '@/app/features/appointments/types/appointments';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Datepicker from '@/app/ui/inputs/Datepicker';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import AddCompanion from '@/app/features/companions/components/AddCompanion';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import { hasUnsavedCentralChanges } from '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils';
import { IoIosWarning } from 'react-icons/io';
import { IoPaw, IoPerson, IoChevronDown } from 'react-icons/io5';
import { TiPlus } from 'react-icons/ti';
import clsx from 'clsx';

// ─── Design tokens (spec-exact) ────────────────────────────────────────────────
const FONT = 'var(--font-satoshi), sans-serif';
const NEUTRAL_900 = 'var(--color-neutral-900)';
const INPUT_PLACEHOLDER = 'var(--color-input-text-placeholder)';
const INPUT_PLACEHOLDER_ACTIVE = 'var(--color-input-text-placeholder-active)';

// 16-R: values / selected text / input content
const text16R: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// 14-M: labels, checkboxes, emergency
const text14M: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// 12px floated label — neutral-900 per spec (not blue)
const floatLabelActive: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// resting placeholder — neutral-700 (input-text-placeholder token)
const floatLabelResting: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '120%',
  color: INPUT_PLACEHOLDER,
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type AddAppointmentCentralModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
  setActiveStatus: React.Dispatch<React.SetStateAction<string>>;
  prefill?: AppointmentDraftPrefill | null;
  onPrefillConsumed?: () => void;
};

type NotifyChannel = 'app' | 'sms' | 'email';

const NOTIFY_OPTIONS: Array<{ key: NotifyChannel; label: string }> = [
  { key: 'app', label: 'Notify via App' },
  { key: 'sms', label: 'Notify via SMS' },
  { key: 'email', label: 'Notify via Email' },
];

const VISIT_TYPE_OPTIONS = [
  { label: 'Outpatient', value: 'Outpatient' },
  { label: 'Inpatient', value: 'Inpatient' },
];

// ─── Shared arrow icon (spec: solid but light-weight) ─────────────────────────
const Arrow = ({ open }: { open: boolean }) => (
  <IoChevronDown
    size={15}
    aria-hidden="true"
    style={{
      flexShrink: 0,
      color: INPUT_PLACEHOLDER_ACTIVE,
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 150ms ease',
    }}
  />
);

// ─── Floating label ─────────────────────────────────────────────────────────────
const FloatLabel = ({ floated, children }: { floated: boolean; children: React.ReactNode }) => (
  <span
    className="pointer-events-none absolute left-5 z-10 flex items-center gap-1 bg-white px-1 transition-all duration-150"
    style={
      floated
        ? { ...floatLabelActive, top: 0, transform: 'translateY(-50%)' }
        : { ...floatLabelResting, top: '50%', transform: 'translateY(-50%)' }
    }
  >
    {children}
  </span>
);

// ─── Field error ────────────────────────────────────────────────────────────────
const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="mt-1 flex items-center gap-1 px-4 text-caption-2 text-text-error" role="alert">
      <IoIosWarning className="shrink-0 text-text-error" size={13} aria-hidden="true" />
      <span style={{ ...text14M, color: 'var(--color-text-error, #d32f2f)' }}>{message}</span>
    </div>
  );
};

// ─── Portal position helper ─────────────────────────────────────────────────────
const getPortalStyle = (el: HTMLElement | null): React.CSSProperties | null => {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const viewportHeight = globalThis.window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const opensUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  return {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    top: opensUp ? undefined : rect.bottom,
    bottom: opensUp ? viewportHeight - rect.top : undefined,
    zIndex: 1300,
  };
};

// ─── PersonRow ─────────────────────────────────────────────────────────────────
type PersonRowProps = {
  fieldId: string;
  label: string;
  icon: React.ReactNode;
  selectedName?: string;
  selectedPhotoUrl?: string;
  query: string;
  setQuery: (v: string) => void;
  options: Array<{ value: string; label: string; photoUrl?: string }>;
  onSelect: (value: string) => void;
  onClear: () => void;
  onNew: () => void;
  error?: string;
};

const PersonRow = ({
  fieldId,
  label,
  icon,
  selectedName,
  selectedPhotoUrl,
  query,
  setQuery,
  options,
  onSelect,
  onClear,
  onNew,
  error,
}: PersonRowProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPortal = (target as HTMLElement).closest?.('[data-portal-dropdown]');
      if (!inContainer && !inPortal) {
        setOpen(false);
        if (!selectedName) setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedName, setQuery]);

  useEffect(() => {
    if (selectedName) setOpen(false);
  }, [selectedName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [options, query]);

  const hasValue = Boolean(selectedName);
  const isFloated = hasValue || open;
  const inputValue = hasValue && !open ? selectedName! : query;

  // Read position synchronously from the DOM at render time — no state delay
  const portalStyle = open ? getPortalStyle(triggerRef.current) : null;

  const dropdownMenu =
    open && portalStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-portal-dropdown
            className={clsx(
              'bg-white rounded-b-2xl overflow-y-auto max-h-44 scrollbar-hidden',
              'border-l border-r border-b',
              error ? 'border-input-border-error' : 'border-input-border-active'
            )}
            style={portalStyle}
          >
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left text-text-secondary hover:bg-card-hover hover:text-text-primary transition-colors"
                  style={text16R}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <AppointmentAvatar name={opt.label} photoUrl={opt.photoUrl} size={32} />
                  <span className="truncate" style={text16R}>
                    {opt.label}
                  </span>
                </button>
              ))
            ) : (
              <div
                className="px-5 py-3 text-center"
                style={{ ...text14M, color: INPUT_PLACEHOLDER_ACTIVE }}
              >
                {query.trim() ? 'No matches found' : 'No options available'}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef}>
      <div
        ref={triggerRef}
        className={clsx(
          'relative flex items-center min-h-12 border bg-white transition-colors duration-150 cursor-text',
          open
            ? 'rounded-t-2xl border-input-border-active'
            : 'rounded-2xl border-input-border-default',
          error ? 'border-input-border-error!' : ''
        )}
      >
        <FloatLabel floated={isFloated}>
          {icon}
          {label}
        </FloatLabel>

        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          autoComplete="off"
          value={inputValue}
          className="flex-1 min-w-0 pl-5 pr-2 py-3 bg-transparent focus-visible:outline-none"
          style={text16R}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hasValue) setQuery('');
            setOpen(true);
          }}
          aria-label={label}
        />

        {/* Trailing area: avatar + clear OR + New */}
        <div className="flex items-center gap-2 pr-3 shrink-0">
          {hasValue ? (
            <>
              <AppointmentAvatar name={selectedName!} photoUrl={selectedPhotoUrl} size={32} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                  setQuery('');
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="flex items-center justify-center w-5 h-5 rounded-full text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors text-[11px] shrink-0"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setQuery('');
                onNew();
              }}
              className="rounded-full px-3 font-satoshi font-medium text-white whitespace-nowrap shrink-0"
              style={{
                background: 'var(--color-primary-600)',
                fontSize: 13,
                lineHeight: '30px',
                height: 30,
              }}
            >
              + New
            </button>
          )}
        </div>
      </div>
      {dropdownMenu}
      <FieldError message={error} />
    </div>
  );
};

// ─── TimeSlotDropdown ──────────────────────────────────────────────────────────
const isSameSlot = (a: Slot | null, b: Slot) =>
  !!a && a.startTime === b.startTime && a.endTime === b.endTime;

type TimeSlotDropdownProps = {
  timeSlots: Slot[];
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  isLoading: boolean;
  hasService: boolean;
  noSlotsMessage?: string;
  prefillLabel?: string | null;
  error?: string;
  label?: string;
};

const TimeSlotLoadingMessage = () => (
  <div className="flex items-center justify-center gap-2 px-5 py-4">
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <span style={{ ...text14M, color: INPUT_PLACEHOLDER_ACTIVE }}>Loading slots...</span>
  </div>
);

type TimeSlotMenuContentProps = {
  timeSlots: Slot[];
  selectedSlot: Slot | null;
  hasService: boolean;
  noSlotsMessage?: string;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  closeMenu: () => void;
};

const TimeSlotMenuContent = ({
  timeSlots,
  selectedSlot,
  hasService,
  noSlotsMessage,
  setSelectedSlot,
  closeMenu,
}: TimeSlotMenuContentProps) => {
  if (timeSlots.length === 0) {
    const emptyMsg =
      noSlotsMessage ??
      (hasService ? 'No slots for this date' : 'Select a speciality and service first');
    return <div className="text-caption-1 py-3 text-text-primary text-center">{emptyMsg}</div>;
  }

  return timeSlots.map((slot, i) => {
    const selected = isSameSlot(selectedSlot, slot);

    return (
      <button
        key={slot.startTime + i}
        type="button"
        className={clsx(
          'w-full flex items-center px-5 py-2.5 text-left transition-colors',
          selected
            ? 'bg-blue-light text-blue-text font-medium'
            : 'text-text-secondary hover:bg-card-hover hover:text-text-primary'
        )}
        style={text16R}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedSlot(selected ? null : slot);
          closeMenu();
        }}
      >
        {formatUtcTimeToLocalLabel(slot.startTime)}
      </button>
    );
  });
};

type TimeSlotTriggerValueProps = {
  isLoading: boolean;
  selectedLabel: string | null;
};

const TimeSlotTriggerValue = ({ isLoading, selectedLabel }: TimeSlotTriggerValueProps) => {
  if (isLoading) {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        style={{ ...text16R, color: INPUT_PLACEHOLDER_ACTIVE }}
      >
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        {'Loading...'}
      </span>
    );
  }

  if (selectedLabel) {
    return <span style={text16R}>{selectedLabel}</span>;
  }

  return <span style={{ ...text16R, color: INPUT_PLACEHOLDER }} />;
};

const TimeSlotDropdown = ({
  timeSlots,
  selectedSlot,
  setSelectedSlot,
  isLoading,
  hasService,
  noSlotsMessage,
  prefillLabel,
  error,
  label = 'Time',
}: TimeSlotDropdownProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPortal = (target as HTMLElement).closest?.('[data-portal-dropdown]');
      if (!inContainer && !inPortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = selectedSlot
    ? formatUtcTimeToLocalLabel(selectedSlot.startTime)
    : (prefillLabel ?? null);
  const isFloated = Boolean(selectedLabel) || open;

  // Read position synchronously from the DOM at render time — no state delay
  const portalStyle = open ? getPortalStyle(triggerRef.current) : null;

  const dropdownMenu =
    open && portalStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-portal-dropdown
            className={clsx(
              'bg-white rounded-b-2xl overflow-y-auto max-h-44 scrollbar-hidden',
              'border-l border-r border-b',
              error ? 'border-input-border-error' : 'border-input-border-active'
            )}
            style={portalStyle}
          >
            {isLoading ? (
              <TimeSlotLoadingMessage />
            ) : (
              <TimeSlotMenuContent
                timeSlots={timeSlots}
                selectedSlot={selectedSlot}
                hasService={hasService}
                noSlotsMessage={noSlotsMessage}
                setSelectedSlot={setSelectedSlot}
                closeMenu={() => setOpen(false)}
              />
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className={clsx(
          'relative flex w-full items-center min-h-12 border bg-white text-left transition-colors duration-150 select-none',
          open
            ? 'rounded-t-2xl border-input-border-active'
            : 'rounded-2xl border-input-border-default',
          error ? 'border-input-border-error!' : ''
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <FloatLabel floated={isFloated}>{label}</FloatLabel>

        <span className="flex-1 min-w-0 pl-5 pr-11 py-3">
          <TimeSlotTriggerValue isLoading={isLoading} selectedLabel={selectedLabel} />
        </span>

        <span className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <Arrow open={open} />
        </span>
      </button>
      {dropdownMenu}
      <FieldError message={error} />
    </div>
  );
};

// ─── SlotBadge — duration display ──────────────────────────────────────────────
const SlotBadge = ({ label }: { label: string | null }) => (
  <div className="relative flex items-center min-h-12 border border-input-border-default rounded-2xl bg-white px-5 py-3">
    <FloatLabel floated={Boolean(label)}>Slot duration</FloatLabel>
    <span style={label ? text16R : { ...text16R, color: INPUT_PLACEHOLDER }}>{label ?? ''}</span>
  </div>
);

const getNoSlotsMessage = (hasService: boolean, hasSpeciality: boolean): string => {
  if (hasService) return 'No slots available for this date';
  if (hasSpeciality) return 'Select a service first';
  return 'Select a speciality and service first';
};

// ─── Main component ────────────────────────────────────────────────────────────

const AddAppointmentCentralModal = ({
  showModal,
  setShowModal,
  setActiveFilter,
  setActiveStatus,
  prefill,
  onPrefillConsumed,
}: AddAppointmentCentralModalProps) => {
  const terminologyText = useCompanionTerminologyText();
  const companions = useCompanionsParentsForPrimaryOrg();

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [addCompanionTarget, setAddCompanionTarget] = useState<'patient' | 'client' | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);
  const [pendingAutoSelectCompanionId, setPendingAutoSelectCompanionId] = useState<string | null>(
    null
  );
  const [patientQuery, setPatientQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState('Outpatient');
  const [notifyChannels, setNotifyChannels] = useState<Set<NotifyChannel>>(new Set(['app']));
  // prefillActive: true while showing the locked prefill date/time/lead display
  const [prefillActive, setPrefillActive] = useState(Boolean(prefill));
  // calendarSlotFlowActive: kept false so services are NOT filtered by the clicked time slot.
  // Date/time prefill still works via pendingPrefill — the slot-time auto-selects after service pick.
  const [calendarSlotFlowActive, setCalendarSlotFlowActive] = useState(false);

  const {
    formData,
    setFormData,
    formDataErrors,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    timeSlots,
    LeadOptions,
    leadEmptyStateMessage,
    TeamOptions,
    SpecialitiesOptions,
    ServicesOptions,
    ServiceInfoData,
    handleCreate,
    handleSpecialitySelect,
    handleServiceSelect,
    handleLeadSelect,
    handleSupportStaffChange,
    isLoading,
    isLoadingSlotScopedOptions,
    setFormDataErrors,
    validateForm,
    resetForm,
  } = useAppointmentForm({
    onSuccess: () => {
      setShowModal(false);
      setActiveFilter('all');
      setActiveStatus('all');
      onPrefillConsumed?.();
    },
    initialPrefill: showModal ? prefill : null,
    calendarSlotFlow: calendarSlotFlowActive,
  });

  const hasUnsavedChanges = useMemo(
    () => hasUnsavedCentralChanges(formData, selectedSlot),
    [formData, selectedSlot]
  );

  const showAddCompanionModal = Boolean(addCompanionTarget) && showModal;

  // ── Reset on close ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showModal) {
      setSubmitAttempted(false);
      setPatientQuery('');
      setClientQuery('');
      setSelectedClientId(null);
      setVisitType('Outpatient');
      setNotifyChannels(new Set(['app']));
      setPendingAutoSelectCompanionId(null);
      setPrefillActive(Boolean(prefill));
      setCalendarSlotFlowActive(false);
      resetForm();
      onPrefillConsumed?.();
    }
  }, [showModal, resetForm, onPrefillConsumed, prefill]);

  useEffect(() => {
    setPrefillActive(Boolean(prefill));
    setCalendarSlotFlowActive(false);
  }, [prefill]);

  // ── Slot loading indicator (non-prefill flow only) ───────────────────────────
  const prevServiceIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const svcId = formData.appointmentType?.id;
    if (svcId !== prevServiceIdRef.current) {
      prevServiceIdRef.current = svcId;
      if (svcId && !calendarSlotFlowActive) setIsLoadingTimeSlots(true);
    }
  }, [formData.appointmentType?.id, calendarSlotFlowActive]);

  useEffect(() => {
    setIsLoadingTimeSlots(false);
  }, [timeSlots]);

  // ── Revalidate after submit attempt ─────────────────────────────────────────
  useEffect(() => {
    if (!submitAttempted) return;
    const errors = validateForm(true);
    setFormDataErrors(errors);
  }, [formData, selectedSlot, submitAttempted, validateForm, setFormDataErrors]);

  // ── Options ──────────────────────────────────────────────────────────────────
  const patientOptions = useMemo(
    () =>
      companions
        .filter((c) => !selectedClientId || c.parent.id === selectedClientId)
        .map((c) => ({
          value: c.companion.id,
          label: formatCompanionNameWithOwnerLastName(c.companion.name, c.parent),
          photoUrl: typeof c.companion.photoUrl === 'string' ? c.companion.photoUrl : undefined,
        })),
    [companions, selectedClientId]
  );

  const clientOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ value: string; label: string }> = [];
    for (const c of companions) {
      if (!seen.has(c.parent.id)) {
        seen.add(c.parent.id);
        const name = [c.parent.firstName, c.parent.lastName].filter(Boolean).join(' ');
        result.push({ value: c.parent.id, label: name || c.parent.id });
      }
    }
    return result;
  }, [companions]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePatientSelect = useCallback(
    (id: string) => {
      const hit = companions.find((c) => c.companion.id === id);
      if (!hit) return;
      setFormData((prev) => ({
        ...prev,
        companion: {
          id: hit.companion.id,
          name: hit.companion.name,
          species: hit.companion.type,
          breed: hit.companion.breed,
          parent: {
            id: hit.parent.id,
            name: [hit.parent.firstName, hit.parent.lastName].filter(Boolean).join(' '),
          },
        },
      }));
      setSelectedClientId(hit.parent.id);
      if (submitAttempted) setFormDataErrors((prev) => ({ ...prev, companionId: undefined }));
    },
    [companions, setFormData, setFormDataErrors, submitAttempted]
  );

  const handlePatientClear = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      companion: { id: '', name: '', species: '', breed: '', parent: { id: '', name: '' } },
    }));
  }, [setFormData]);

  const handleClientSelect = useCallback(
    (id: string) => {
      setSelectedClientId(id);
      if (formData.companion.id && formData.companion.parent?.id !== id) handlePatientClear();
    },
    [formData.companion, handlePatientClear]
  );

  const handleClientClear = useCallback(() => {
    setSelectedClientId(null);
  }, []);

  useEffect(() => {
    if (!showModal || !pendingAutoSelectCompanionId) return;
    const found = companions.find((c) => c.companion.id === pendingAutoSelectCompanionId);
    if (!found) return;
    handlePatientSelect(found.companion.id);
    setPendingAutoSelectCompanionId(null);
  }, [companions, handlePatientSelect, pendingAutoSelectCompanionId, showModal]);

  const supportOptions = useMemo(
    () => TeamOptions.filter((o) => o.value !== formData.lead?.id),
    [TeamOptions, formData.lead?.id]
  );

  const canCloseModal = useCallback(() => {
    if (isLoading) return false;
    if (!hasUnsavedChanges) return true;
    setShowDiscardConfirm(true);
    return false;
  }, [isLoading, hasUnsavedChanges]);

  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardConfirm(false);
    setShowModal(false);
  }, [setShowModal]);

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    const errors = validateForm(true);
    setFormDataErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    await handleCreate(true);
  };

  const handleAddCompanionClose = (value: React.SetStateAction<boolean>) => {
    const nextOpen = typeof value === 'function' ? value(showAddCompanionModal) : value;
    if (!nextOpen) {
      setAddCompanionTarget(null);
      loadCompanionsForPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
    }
  };

  const toggleNotify = (key: NotifyChannel) => {
    const next = new Set(notifyChannels);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setNotifyChannels(next);
  };

  const showError = (field: keyof typeof formDataErrors) =>
    submitAttempted ? formDataErrors[field] : undefined;

  // Switches from prefill/calendar-slot mode to free-flow mode, preserving the patient/client
  // selections since those aren't prefilled — only date/time/speciality/service/slot/lead reset.
  const exitPrefillMode = useCallback(() => {
    if (!prefillActive && !calendarSlotFlowActive) return;
    setPrefillActive(false);
    setCalendarSlotFlowActive(false);
    // Reset form to clear slot-scoped speciality/service/slot/lead state from the hook
    resetForm();
  }, [prefillActive, calendarSlotFlowActive, resetForm]);

  const handleDateChange = useCallback(
    (date: React.SetStateAction<Date>) => {
      exitPrefillMode();
      setSelectedDate(date);
    },
    [exitPrefillMode, setSelectedDate]
  );

  const handleLeadSelectWithReset = useCallback(
    (option: { label: string; value: string }) => {
      // Only drop the locked-date display — do NOT reset the form.
      // Date/time/speciality/service/slot are all still valid when the user just switches leads.
      setPrefillActive(false);
      handleLeadSelect(option);
    },
    [handleLeadSelect]
  );

  // ── Derived values ────────────────────────────────────────────────────────────
  // Shown in the time dropdown trigger before a real slot is matched (prefill phase).
  const prefillTimeLabel = useMemo(
    () =>
      prefillActive && !selectedSlot && formData.startTime
        ? formatTimeLabel(formData.startTime)
        : null,
    [prefillActive, selectedSlot, formData.startTime]
  );

  // Use the full formatted label (e.g. "Buddy Smith") not just the pet name
  const selectedPatientName = useMemo(() => {
    if (!formData.companion.id) return undefined;
    return (
      patientOptions.find((o) => o.value === formData.companion.id)?.label ||
      formData.companion.name ||
      undefined
    );
  }, [formData.companion.id, formData.companion.name, patientOptions]);
  const selectedPatientPhoto = useMemo(
    () => patientOptions.find((o) => o.value === formData.companion.id)?.photoUrl,
    [formData.companion.id, patientOptions]
  );
  const selectedClientName = useMemo(
    () => clientOptions.find((c) => c.value === selectedClientId)?.label,
    [selectedClientId, clientOptions]
  );

  const durationDisplay = useMemo(() => {
    if (selectedSlot) {
      const mins = Math.round(
        (new Date(selectedSlot.endTime).getTime() - new Date(selectedSlot.startTime).getTime()) /
          60000
      );
      if (mins > 0) return `${mins} mins`;
    }
    if (formData.durationMinutes) return `${formData.durationMinutes} mins`;
    return null;
  }, [selectedSlot, formData.durationMinutes]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hasService = Boolean(formData.appointmentType?.id);
  const hasSpeciality = Boolean(formData.appointmentType?.speciality?.id);
  const noSlotsMessage = getNoSlotsMessage(hasService, hasSpeciality);
  const patientLabel = terminologyText('Patient');

  return (
    <>
      {/* Central modal — hidden (not unmounted) when AddCompanion is open for smooth slide transition */}
      <AppointmentCentralModalShell
        showModal={showModal && !showAddCompanionModal}
        setShowModal={setShowModal}
        title="Appointment details"
        canClose={canCloseModal}
        isLoading={isLoading}
      >
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* ─── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Patient (dynamic terminology) */}
              <PersonRow
                fieldId="central-patient"
                label={patientLabel}
                icon={<IoPaw size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
                selectedName={selectedPatientName}
                selectedPhotoUrl={selectedPatientPhoto}
                query={patientQuery}
                setQuery={setPatientQuery}
                options={patientOptions}
                onSelect={handlePatientSelect}
                onClear={handlePatientClear}
                onNew={() => setAddCompanionTarget('patient')}
                error={showError('companionId')}
              />

              {/* Client */}
              <PersonRow
                fieldId="central-client"
                label="Client"
                icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
                selectedName={selectedClientName}
                query={clientQuery}
                setQuery={setClientQuery}
                options={clientOptions}
                onSelect={handleClientSelect}
                onClear={handleClientClear}
                onNew={() => setAddCompanionTarget('client')}
              />

              {/* Date + Time — 2-col row */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Datepicker
                    currentDate={selectedDate}
                    setCurrentDate={handleDateChange}
                    placeholder="Date"
                    type="input"
                    portal
                    minDate={today}
                  />
                </div>

                <div className="flex-1">
                  <TimeSlotDropdown
                    timeSlots={timeSlots}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={(slot) => {
                      setPrefillActive(false);
                      setSelectedSlot(slot);
                    }}
                    isLoading={(isLoadingTimeSlots && hasService) || isLoadingSlotScopedOptions}
                    hasService={hasService}
                    noSlotsMessage={noSlotsMessage}
                    prefillLabel={prefillTimeLabel}
                    error={showError('slot') ?? showError('duration')}
                  />
                </div>
              </div>

              {/* Slot (duration) + Type of Visit — 2-col row */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <SlotBadge label={durationDisplay} />
                </div>
                <div className="flex-1">
                  <LabelDropdown
                    placeholder="Type of Visit"
                    options={VISIT_TYPE_OPTIONS}
                    defaultOption={visitType}
                    onSelect={(opt) => setVisitType(opt.value)}
                    searchable={false}
                    portal
                  />
                </div>
              </div>

              {/* Lead */}
              <div>
                <LabelDropdown
                  placeholder="Lead"
                  options={LeadOptions}
                  defaultOption={formData.lead?.id}
                  onSelect={handleLeadSelectWithReset}
                  error={showError('leadId')}
                  searchable
                  portal
                  icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
                  noOptionsMessage={leadEmptyStateMessage}
                />
                {calendarSlotFlowActive && isLoadingSlotScopedOptions && (
                  <p
                    className="px-4 mt-1"
                    style={{ ...text14M, fontSize: 12, color: INPUT_PLACEHOLDER_ACTIVE }}
                  >
                    Resolving available leads…
                  </p>
                )}
              </div>

              {/* Support */}
              <MultiSelectDropdown
                placeholder="Support"
                options={supportOptions}
                value={formData.supportStaff?.map((s) => s.id ?? '') ?? []}
                onChange={handleSupportStaffChange}
                portal
                icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              />
            </div>

            {/* ─── RIGHT COLUMN ────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Speciality */}
              <LabelDropdown
                placeholder="Speciality"
                options={SpecialitiesOptions}
                defaultOption={formData.appointmentType?.speciality?.id}
                onSelect={handleSpecialitySelect}
                error={showError('specialityId')}
                searchable
                portal
                icon={<TiPlus size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              />

              {/* Service */}
              <LabelDropdown
                placeholder="Service"
                options={ServicesOptions}
                defaultOption={formData.appointmentType?.id}
                onSelect={handleServiceSelect}
                error={showError('serviceId')}
                searchable
                portal
                icon={<TiPlus size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
              />

              {/* Chief Complaint */}
              <FormDesc
                intype="text"
                inlabel="Chief Complaint"
                value={formData.concern ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, concern: e.target.value }))}
                error={showError('concern')}
                className="min-h-20"
              />

              {/* Estimate — always shown */}
              <AppointmentEstimatePanel
                cost={ServiceInfoData?.cost}
                maxDiscount={ServiceInfoData?.maxDiscount}
              />

              {/* Emergency */}
              <label className="ml-auto flex items-center justify-end gap-2 cursor-pointer select-none mt-auto">
                <input
                  type="checkbox"
                  checked={formData.isEmergency ?? false}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isEmergency: e.target.checked }))
                  }
                  className="w-4 h-4 cursor-pointer shrink-0"
                />
                <span style={text14M}>Is this an Emergency?</span>
              </label>
            </div>
          </div>

          {/* Booking error */}
          {submitAttempted && formDataErrors.booking && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl border border-input-border-error">
              <IoIosWarning className="text-text-error shrink-0" size={16} aria-hidden="true" />
              <span style={{ ...text14M, color: 'var(--color-text-error, #d32f2f)' }}>
                {formDataErrors.booking}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-card-border sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              {NOTIFY_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyChannels.has(key)}
                    onChange={() => toggleNotify(key)}
                    className="w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span style={text14M}>{label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="yc-primary-button flex items-center justify-center gap-2 rounded-2xl! px-6 py-3 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: '120%',
                color: '#ffffff',
              }}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
              }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
              }}
            >
              + Add Appointment
            </button>
          </div>
        </div>
      </AppointmentCentralModalShell>

      {/* AddCompanion slides in over the central modal — smooth transition */}
      <AddCompanion
        showModal={showAddCompanionModal}
        setShowModal={handleAddCompanionClose}
        mode="fasttrack"
        onCompanionCreated={(companionId) => {
          setPendingAutoSelectCompanionId(companionId);
          setAddCompanionTarget(null);
        }}
      />

      {/* Discard confirmation */}
      <CenterModal
        showModal={showDiscardConfirm}
        setShowModal={setShowDiscardConfirm}
        containerClassName="shadow-[0_0_40px_0_rgba(0,0,0,0.20)]!"
      >
        <div className="flex flex-col gap-4 p-2">
          <h3 style={{ ...text14M, fontSize: 18 }}>Discard changes?</h3>
          <p style={{ ...text14M, fontWeight: 400 }}>
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
              className="rounded-2xl border border-input-border-default px-5 py-2.5 hover:bg-card-hover active:bg-card-hover/80 transition-colors"
              style={text14M}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={handleDiscardAndClose}
              className="yc-primary-button rounded-2xl! px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ ...text14M, color: 'white' }}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
              }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--yc-button-x', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--yc-button-y', `${e.clientY - r.top}px`);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      </CenterModal>
    </>
  );
};

export default AddAppointmentCentralModal;
