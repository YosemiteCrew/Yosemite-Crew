'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import AddCompanionCentralModal from '@/app/features/companions/components/AddCompanionCentralModal';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import { hasUnsavedCentralChanges } from '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils';
import { IoIosWarning } from 'react-icons/io';
import { IoAdd, IoArrowForward, IoChevronDown, IoPaw, IoPerson } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import clsx from 'clsx';
import type { AppointmentKind } from '@yosemite-crew/types';

// ─── Design tokens (spec-exact) ────────────────────────────────────────────────
const FONT = 'var(--font-satoshi), sans-serif';
const NEUTRAL_900 = 'var(--color-neutral-900)';
const INPUT_PLACEHOLDER = 'var(--color-input-text-placeholder)';
const INPUT_PLACEHOLDER_ACTIVE = 'var(--color-input-text-placeholder-active)';

// 16-R: values / selected text / input content
const text16R: CSSProperties = {
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// 14-M: labels, checkboxes, emergency
const text14M: CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// 12px floated label — neutral-900 per spec (not blue)
const floatLabelActive: CSSProperties = {
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: '120%',
  color: NEUTRAL_900,
};
// resting placeholder — neutral-700 (input-text-placeholder token)
const floatLabelResting: CSSProperties = {
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '120%',
  color: INPUT_PLACEHOLDER,
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type AddAppointmentCentralModalProps = {
  showModal: boolean;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  setActiveFilter: Dispatch<SetStateAction<string>>;
  setActiveStatus: Dispatch<SetStateAction<string>>;
  prefill?: AppointmentDraftPrefill | null;
  onPrefillConsumed?: () => void;
  /** Pre-selects a companion by ID when the modal opens (e.g. from the companions table). */
  initialCompanionId?: string | null;
};

type ModalUiState = {
  submitAttempted: boolean;
  addCompanionTarget: 'patient' | 'client' | null;
  showDiscardConfirm: boolean;
  isLoadingTimeSlots: boolean;
  pendingAutoSelectCompanionId: string | null;
  patientQuery: string;
  clientQuery: string;
  selectedClientId: string | null;
  prefillDismissed: boolean;
};

type ModalUiAction =
  | { type: 'reset' }
  | { type: 'setSubmitAttempted'; value: boolean }
  | { type: 'setAddCompanionTarget'; value: ModalUiState['addCompanionTarget'] }
  | { type: 'setShowDiscardConfirm'; value: boolean }
  | { type: 'setIsLoadingTimeSlots'; value: boolean }
  | { type: 'setPendingAutoSelectCompanionId'; value: string | null }
  | { type: 'setPatientQuery'; value: string }
  | { type: 'setClientQuery'; value: string }
  | { type: 'setSelectedClientId'; value: string | null }
  | { type: 'dismissPrefill' };

const createInitialModalUiState = (): ModalUiState => ({
  submitAttempted: false,
  addCompanionTarget: null,
  showDiscardConfirm: false,
  isLoadingTimeSlots: false,
  pendingAutoSelectCompanionId: null,
  patientQuery: '',
  clientQuery: '',
  selectedClientId: null,
  prefillDismissed: false,
});

const modalUiReducer = (state: ModalUiState, action: ModalUiAction): ModalUiState => {
  switch (action.type) {
    case 'reset':
      return createInitialModalUiState();
    case 'setSubmitAttempted':
      return { ...state, submitAttempted: action.value };
    case 'setAddCompanionTarget':
      return { ...state, addCompanionTarget: action.value };
    case 'setShowDiscardConfirm':
      return { ...state, showDiscardConfirm: action.value };
    case 'setIsLoadingTimeSlots':
      return { ...state, isLoadingTimeSlots: action.value };
    case 'setPendingAutoSelectCompanionId':
      return { ...state, pendingAutoSelectCompanionId: action.value };
    case 'setPatientQuery':
      return { ...state, patientQuery: action.value };
    case 'setClientQuery':
      return { ...state, clientQuery: action.value };
    case 'setSelectedClientId':
      return { ...state, selectedClientId: action.value };
    case 'dismissPrefill':
      return state.prefillDismissed ? state : { ...state, prefillDismissed: true };
    /* v8 ignore next 2 -- exhaustive ModalUiAction union; the default arm is unreachable */
    default:
      return state;
  }
};

const VISIT_TYPE_OPTIONS = [
  { label: 'Outpatient', value: 'Outpatient' },
  { label: 'Inpatient', value: 'Inpatient' },
];

const visitTypeToAppointmentKind = (visitType: string): AppointmentKind =>
  visitType === 'Inpatient' ? 'INPATIENT' : 'OUTPATIENT';

const appointmentKindToVisitType = (appointmentKind?: AppointmentKind): string =>
  appointmentKind === 'INPATIENT' ? 'Inpatient' : 'Outpatient';

const getDropdownValue = (option: string | { value: string }): string =>
  typeof option === 'string' ? option : option.value;

// ─── Shared arrow icon (spec: solid but light-weight) ─────────────────────────
export const Arrow = ({ open }: { open: boolean }) => (
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
export const FloatLabel = ({ floated, children }: { floated: boolean; children: ReactNode }) => (
  <span
    className="pointer-events-none absolute left-5 z-10 flex items-center gap-1 bg-neutral-0 px-1 transition-all duration-150"
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
export const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="mt-1 flex items-center gap-1 px-4 text-caption-2 text-text-error" role="alert">
      <IoIosWarning className="shrink-0 text-text-error" size={13} aria-hidden="true" />
      <span style={{ ...text14M, color: 'var(--color-text-error, #d32f2f)' }}>{message}</span>
    </div>
  );
};

// ─── Portal position helper ─────────────────────────────────────────────────────
const getPortalStyle = (el: HTMLElement | null): CSSProperties | null => {
  /* v8 ignore next -- defensive null guard: el is triggerRef.current, always attached whenever a dropdown opens */
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
  icon: ReactNode;
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

export const PersonRow = ({
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [options, query]);

  const hasValue = Boolean(selectedName);
  const visibleOpen = open && !hasValue;
  const isFloated = hasValue || visibleOpen;
  const inputValue = hasValue ? selectedName! : query;

  // Read position synchronously from the DOM at render time — no state delay
  const portalStyle = visibleOpen ? getPortalStyle(triggerRef.current) : null;

  const dropdownMenu =
    visibleOpen && portalStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-portal-dropdown
            className={clsx(
              'bg-neutral-0 rounded-b-2xl overflow-y-auto max-h-44 scrollbar-hidden',
              'border-l border-r border-b border-t',
              error ? 'border-input-border-error' : 'border-input-text-placeholder-active'
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
          'relative flex items-center min-h-12 border bg-neutral-0 transition-colors duration-150 cursor-text',
          visibleOpen
            ? 'rounded-t-2xl border-input-border-active border-b-0'
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
                className="flex items-center justify-center size-5 rounded-full text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors text-[11px] shrink-0"
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
  setSelectedSlot: Dispatch<SetStateAction<Slot | null>>;
  isLoading: boolean;
  hasService: boolean;
  noSlotsMessage?: string;
  prefillLabel?: string | null;
  error?: string;
  label?: string;
};

export const TimeSlotLoadingMessage = () => (
  <div className="flex items-center justify-center gap-2 px-5 py-4">
    <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <span style={{ ...text14M, color: INPUT_PLACEHOLDER_ACTIVE }}>Loading slots…</span>
  </div>
);

type TimeSlotMenuContentProps = {
  timeSlots: Slot[];
  selectedSlot: Slot | null;
  hasService: boolean;
  noSlotsMessage?: string;
  setSelectedSlot: Dispatch<SetStateAction<Slot | null>>;
  closeMenu: () => void;
};

export const TimeSlotMenuContent = ({
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

export const TimeSlotTriggerValue = ({ isLoading, selectedLabel }: TimeSlotTriggerValueProps) => {
  if (isLoading) {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        style={{ ...text16R, color: INPUT_PLACEHOLDER_ACTIVE }}
      >
        <svg
          className="animate-spin size-3.5 shrink-0"
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

export const TimeSlotDropdown = ({
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
              'bg-neutral-0 rounded-b-2xl overflow-y-auto max-h-44 scrollbar-hidden',
              'border-l border-r border-b border-t',
              error ? 'border-input-border-error' : 'border-input-text-placeholder-active'
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
          'relative flex w-full items-center min-h-12 border bg-neutral-0 text-left transition-colors duration-150 select-none',
          open
            ? 'rounded-t-2xl border-input-border-active border-b-0'
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
export const SlotBadge = ({ label }: { label: string | null }) => (
  <div className="relative flex items-center min-h-12 border border-input-border-default rounded-2xl bg-neutral-0 px-5 py-3">
    <FloatLabel floated={Boolean(label)}>Slot duration</FloatLabel>
    <span style={label ? text16R : { ...text16R, color: INPUT_PLACEHOLDER }}>{label ?? ''}</span>
  </div>
);

const getNoSlotsMessage = (hasService: boolean, hasSpeciality: boolean): string => {
  if (hasService) return 'No slots available for this date';
  if (hasSpeciality) return 'Select a service first';
  return 'Select a speciality and service first';
};

type AppointmentFormContentProps = {
  patientLabel: string;
  selectedPatientName?: string;
  selectedPatientPhoto?: string;
  patientQuery: string;
  setPatientQuery: (value: string) => void;
  patientOptions: Array<{ value: string; label: string; photoUrl?: string }>;
  handlePatientSelect: (id: string) => void;
  handlePatientClear: () => void;
  selectedClientName?: string;
  clientQuery: string;
  setClientQuery: (value: string) => void;
  clientOptions: Array<{ value: string; label: string }>;
  handleClientSelect: (id: string) => void;
  handleClientClear: () => void;
  setAddCompanionTarget: (target: 'patient' | 'client') => void;
  selectedDate: Date | null;
  handleDateChange: (date: SetStateAction<Date>) => void;
  today: Date;
  timeSlots: Slot[];
  selectedSlot: Slot | null;
  onSlotSelect: (slot: SetStateAction<Slot | null>) => void;
  formState: {
    loadingTimeSlots: boolean;
    loadingSlotScopedOptions: boolean;
    serviceSelected: boolean;
    submitted: boolean;
    loading: boolean;
  };
  noSlotsMessage: string;
  prefillTimeLabel: string | null;
  durationDisplay: string | null;
  visitType: string;
  handleVisitTypeSelect: (opt: string | { label: string; value: string }) => void;
  LeadOptions: Array<{ label: string; value: string }>;
  formData: any;
  formDataErrors: Record<string, string | undefined>;
  handleLeadSelectWithReset: (option: { label: string; value: string }) => void;
  leadEmptyStateMessage?: string;
  supportOptions: Array<{ label: string; value: string }>;
  handleSupportStaffChange: (options: string[]) => void;
  SpecialitiesOptions: Array<{ label: string; value: string }>;
  handleSpecialitySelect: (option: { label: string; value: string }) => void;
  ServicesOptions: Array<{ label: string; value: string }>;
  handleServiceSelect: (option: { label: string; value: string }) => void;
  setFormData: Dispatch<SetStateAction<any>>;
  ServiceInfoData: any;
  showError: (field: string) => string | undefined;
  handleSubmit: () => void;
  onCancel: () => void;
};

export const AppointmentFormContent = ({
  patientLabel,
  selectedPatientName,
  selectedPatientPhoto,
  patientQuery,
  setPatientQuery,
  patientOptions,
  handlePatientSelect,
  handlePatientClear,
  selectedClientName,
  clientQuery,
  setClientQuery,
  clientOptions,
  handleClientSelect,
  handleClientClear,
  setAddCompanionTarget,
  selectedDate,
  handleDateChange,
  today,
  timeSlots,
  selectedSlot,
  onSlotSelect,
  formState,
  noSlotsMessage,
  prefillTimeLabel,
  durationDisplay,
  visitType,
  handleVisitTypeSelect,
  LeadOptions,
  formData,
  formDataErrors,
  handleLeadSelectWithReset,
  leadEmptyStateMessage,
  supportOptions,
  handleSupportStaffChange,
  SpecialitiesOptions,
  handleSpecialitySelect,
  ServicesOptions,
  handleServiceSelect,
  setFormData,
  ServiceInfoData,
  showError,
  handleSubmit,
  onCancel,
}: AppointmentFormContentProps) => (
  <div className="relative">
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
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
              setSelectedSlot={onSlotSelect}
              isLoading={
                (formState.loadingTimeSlots && formState.serviceSelected) ||
                formState.loadingSlotScopedOptions
              }
              hasService={formState.serviceSelected}
              noSlotsMessage={noSlotsMessage}
              prefillLabel={prefillTimeLabel}
              error={showError('slot') ?? showError('duration')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <SlotBadge label={durationDisplay} />
          </div>
          <div className="flex-1">
            <LabelDropdown
              placeholder="Type of Visit"
              options={VISIT_TYPE_OPTIONS}
              defaultOption={visitType}
              onSelect={handleVisitTypeSelect}
              searchable={false}
              portal
            />
          </div>
        </div>

        <div>
          <LabelDropdown
            placeholder="Lead"
            options={LeadOptions}
            defaultOption={formData.lead?.id ?? ''}
            onSelect={handleLeadSelectWithReset}
            error={showError('leadId')}
            searchable
            portal
            icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
            noOptionsMessage={leadEmptyStateMessage}
          />
        </div>

        <MultiSelectDropdown
          placeholder="Support"
          options={supportOptions}
          value={formData.supportStaff?.map((s: { id?: string }) => s.id ?? '') ?? []}
          onChange={handleSupportStaffChange}
          portal
          icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
        />
      </div>

      <div className="flex flex-col gap-4">
        <LabelDropdown
          placeholder="Speciality"
          options={SpecialitiesOptions}
          defaultOption={formData.appointmentType?.speciality?.id ?? ''}
          onSelect={handleSpecialitySelect}
          error={showError('specialityId')}
          searchable
          portal
          icon={<IoAdd size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
        />

        <LabelDropdown
          placeholder="Services / Packages"
          options={ServicesOptions}
          defaultOption={formData.appointmentType?.id ?? ''}
          onSelect={handleServiceSelect}
          error={showError('serviceId')}
          searchable
          portal
          icon={<IoAdd size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
        />

        <FormDesc
          intype="text"
          inlabel="Chief Complaint"
          value={formData.concern ?? ''}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, concern: e.target.value }))}
          error={showError('concern')}
          className="min-h-20"
        />

        <AppointmentEstimatePanel
          cost={ServiceInfoData?.cost}
          maxDiscount={ServiceInfoData?.maxDiscount}
        />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer select-none items-center gap-2.5">
            <input
              type="checkbox"
              aria-label="Mark appointment as emergency"
              checked={formData.isEmergency ?? false}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, isEmergency: e.target.checked }))
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-text-brand"
              style={{
                backgroundColor: (formData.isEmergency ?? false) ? 'var(--cta)' : 'var(--divider)',
              }}
            >
              <span
                className="absolute top-[3px] size-[18px] rounded-full bg-[var(--screen)] transition-all duration-150"
                style={{ left: (formData.isEmergency ?? false) ? '19px' : '3px' }}
              />
            </span>
            <span className="text-[13px] font-semibold text-[var(--ink-body)]">
              Mark as emergency
            </span>
          </label>
          <span className="text-[12.5px] text-[var(--ink-faint)]">
            {selectedClientName?.split(' ')[0] ?? 'The client'} will be notified by push + email
          </span>
        </div>
      </div>
    </div>

    {formState.submitted && formDataErrors.booking && (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-input-border-error px-4 py-3">
        <IoIosWarning className="shrink-0 text-text-error" size={16} aria-hidden="true" />
        <span style={{ ...text14M, color: 'var(--color-text-error, #d32f2f)' }}>
          {formDataErrors.booking}
        </span>
      </div>
    )}

    <div className="mt-6 flex flex-col gap-3 border-t border-card-border pt-4 sm:flex-row sm:items-center sm:justify-end">
      <Secondary text="Cancel" onClick={onCancel} isDisabled={formState.loading} />
      <Primary
        text="Book appointment"
        onClick={handleSubmit}
        isDisabled={formState.loading}
        icon={<IoArrowForward aria-hidden="true" />}
        iconPosition="right"
      />
    </div>
  </div>
);

export const DiscardConfirmationModal = ({
  showModal,
  setShowModal,
  onDiscard,
}: {
  showModal: boolean;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  onDiscard: () => void;
}) => (
  <CenterModal
    showModal={showModal}
    setShowModal={setShowModal}
    containerClassName="shadow-[0_0_40px_0_rgba(0,0,0,0.20)]!"
  >
    <div className="flex flex-col gap-4 p-2">
      <h3 style={{ ...text14M, fontSize: 18 }}>Discard changes?</h3>
      <p style={{ ...text14M, fontWeight: 400 }}>
        You have unsaved changes. Are you sure you want to discard them?
      </p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowModal(false)}
          className="rounded-2xl border border-input-border-default px-5 py-2.5 transition-colors hover:bg-card-hover active:bg-card-hover/80"
          style={text14M}
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="yc-primary-button rounded-2xl! px-5 py-2.5 font-satoshi text-base font-medium leading-[1.2] text-white! disabled:cursor-not-allowed disabled:opacity-60"
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
);

// ─── Main component ────────────────────────────────────────────────────────────

const toIsoOrValue = (value: Date | string | undefined): string | undefined =>
  value instanceof Date ? value.toISOString() : value;

const computePrefillKey = (prefill: AppointmentDraftPrefill | null | undefined): string | null => {
  const prefillForKey = prefill as
    | (AppointmentDraftPrefill & { assignedTo?: string; startTime?: Date | string })
    | null
    | undefined;
  if (!prefillForKey) return null;
  return JSON.stringify({
    date: toIsoOrValue(prefillForKey.date),
    minuteOfDay: prefillForKey.minuteOfDay,
    leadId: prefillForKey.leadId,
    assignedTo: prefillForKey.assignedTo,
    startTime: toIsoOrValue(prefillForKey.startTime),
  });
};

const useAddAppointmentCentralModalView = ({
  showModal,
  setShowModal,
  setActiveFilter,
  setActiveStatus,
  prefill,
  onPrefillConsumed,
  initialCompanionId,
}: AddAppointmentCentralModalProps) => {
  const terminologyText = useCompanionTerminologyText();
  const companions = useCompanionsParentsForPrimaryOrg();
  const [uiState, dispatchUi] = useReducer(modalUiReducer, undefined, createInitialModalUiState);
  const [visitType, setVisitType] = useState('Outpatient');
  const prefillActive = Boolean(prefill) && !uiState.prefillDismissed;
  const calendarSlotFlowActive = false;

  const appointmentForm = useAppointmentForm({
    onSuccess: () => {
      setShowModal(false);
      setActiveFilter('all');
      setActiveStatus('all');
      onPrefillConsumed?.();
    },
    initialPrefill: showModal ? prefill : null,
    calendarSlotFlow: calendarSlotFlowActive,
    appointmentKind: visitTypeToAppointmentKind(visitType),
  });
  const {
    formData,
    formDataErrors,
    selectedDate,
    selectedSlot,
    timeSlots,
    LeadOptions,
    leadEmptyStateMessage,
    TeamOptions,
    SpecialitiesOptions,
    ServicesOptions,
    ServiceInfoData,
    isLoading,
    isLoadingSlotScopedOptions,
    setFormData,
    setFormDataErrors,
    setSelectedDate,
    setSelectedSlot,
    handleCreate,
    handleSpecialitySelect,
    handleServiceSelect,
    handleLeadSelect,
    handleSupportStaffChange,
    resetForm,
    validateForm,
  } = appointmentForm;
  const syncedVisitType = appointmentKindToVisitType(formData.appointmentKind);
  if (visitType !== syncedVisitType) {
    setVisitType(syncedVisitType);
  }
  const prevShowModalRef = useRef(showModal);
  const prevPrefillKeyRef = useRef<string | null>(null);
  const autoSelectKeyRef = useRef<string | null>(null);

  const hasUnsavedChanges = useMemo(
    () => hasUnsavedCentralChanges(formData, selectedSlot),
    [formData, selectedSlot]
  );

  const showAddCompanionModal = Boolean(uiState.addCompanionTarget) && showModal;

  useLayoutEffect(() => {
    if (!showModal && prevShowModalRef.current) {
      dispatchUi({ type: 'reset' });
      resetForm();
    }
    prevShowModalRef.current = showModal;
  }, [resetForm, showModal]);

  const prevServiceIdRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const svcId = formData.appointmentType?.id;
    if (svcId !== prevServiceIdRef.current) {
      prevServiceIdRef.current = svcId;
      if (svcId && !calendarSlotFlowActive) {
        dispatchUi({ type: 'setIsLoadingTimeSlots', value: true });
      }
    }
  }, [formData.appointmentType?.id, calendarSlotFlowActive]);

  useLayoutEffect(() => {
    dispatchUi({ type: 'setIsLoadingTimeSlots', value: false });
  }, [timeSlots]);

  useLayoutEffect(() => {
    if (!uiState.submitAttempted) return;
    const errors = validateForm(true);
    setFormDataErrors(errors);
  }, [formData, selectedSlot, setFormDataErrors, uiState.submitAttempted, validateForm]);

  const prefillKey = computePrefillKey(prefill);
  if (prefillKey !== prevPrefillKeyRef.current) {
    prevPrefillKeyRef.current = prefillKey;
    dispatchUi({ type: 'reset' });
  }

  const patientOptions = useMemo(
    () =>
      companions.reduce<Array<{ value: string; label: string; photoUrl?: string }>>(
        (options, c) => {
          if (uiState.selectedClientId && c.parent.id !== uiState.selectedClientId) return options;
          options.push({
            value: c.companion.id,
            label: formatCompanionNameWithOwnerLastName(c.companion.name, c.parent),
            photoUrl: typeof c.companion.photoUrl === 'string' ? c.companion.photoUrl : undefined,
          });
          return options;
        },
        []
      ),
    [companions, uiState.selectedClientId]
  );

  const clientOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ value: string; label: string }> = [];
    for (const c of companions) {
      const { id: parentId, firstName, lastName } = c.parent;
      if (!seen.has(parentId)) {
        seen.add(parentId);
        const name = [firstName, lastName].filter(Boolean).join(' ');
        result.push({ value: parentId, label: name || parentId });
      }
    }
    return result;
  }, [companions]);

  const handlePatientSelect = useCallback(
    (id: string) => {
      const hit = companions.find((c) => c.companion.id === id);
      /* v8 ignore next -- id always originates from companion-derived options; a miss is unreachable */
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
      dispatchUi({ type: 'setSelectedClientId', value: hit.parent.id });
      if (uiState.submitAttempted)
        setFormDataErrors((prev) => ({ ...prev, companionId: undefined }));
    },
    [companions, setFormData, setFormDataErrors, uiState.submitAttempted]
  );

  const applyAutoSelectKey = (autoSelectKey: string | null) => {
    if (!autoSelectKey) {
      if (!showModal) dispatchUi({ type: 'setPendingAutoSelectCompanionId', value: null });
      return;
    }
    const found = companions.find((c) => c.companion.id === autoSelectKey);
    if (!found) {
      dispatchUi({ type: 'setPendingAutoSelectCompanionId', value: autoSelectKey });
      return;
    }
    handlePatientSelect(found.companion.id);
    dispatchUi({
      type: 'setPatientQuery',
      value: formatCompanionNameWithOwnerLastName(found.companion.name, found.parent),
    });
  };
  const autoSelectKey = showModal ? (initialCompanionId ?? null) : null;
  if (autoSelectKey !== autoSelectKeyRef.current) {
    autoSelectKeyRef.current = autoSelectKey;
    applyAutoSelectKey(autoSelectKey);
  }

  const pendingCompanion = uiState.pendingAutoSelectCompanionId
    ? companions.find((c) => c.companion.id === uiState.pendingAutoSelectCompanionId)
    : undefined;
  if (showModal && pendingCompanion && uiState.pendingAutoSelectCompanionId) {
    handlePatientSelect(pendingCompanion.companion.id);
    dispatchUi({
      type: 'setPatientQuery',
      value: formatCompanionNameWithOwnerLastName(
        pendingCompanion.companion.name,
        pendingCompanion.parent
      ),
    });
    dispatchUi({ type: 'setPendingAutoSelectCompanionId', value: null });
  }

  const handlePatientClear = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      companion: { id: '', name: '', species: '', breed: '', parent: { id: '', name: '' } },
    }));
  }, [setFormData]);

  const handleClientSelect = useCallback(
    (id: string) => {
      dispatchUi({ type: 'setSelectedClientId', value: id });
      if (formData.companion.id && formData.companion.parent?.id !== id) handlePatientClear();
    },
    [formData.companion, handlePatientClear]
  );

  const handleClientClear = useCallback(() => {
    dispatchUi({ type: 'setSelectedClientId', value: null });
  }, []);

  const supportOptions = useMemo(
    () => TeamOptions.filter((o) => o.value !== formData.lead?.id),
    [TeamOptions, formData.lead?.id]
  );

  const canCloseModal = useCallback(() => {
    if (showAddCompanionModal) return false;
    if (isLoading) return false;
    if (!hasUnsavedChanges) return true;
    dispatchUi({ type: 'setShowDiscardConfirm', value: true });
    return false;
  }, [showAddCompanionModal, isLoading, hasUnsavedChanges]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    onPrefillConsumed?.();
  }, [onPrefillConsumed, setShowModal]);

  const handleDiscardAndClose = useCallback(() => {
    dispatchUi({ type: 'setShowDiscardConfirm', value: false });
    closeModal();
  }, [closeModal]);

  // Cancel mirrors the header X: honour the unsaved-changes guard (which opens the
  // discard confirmation) before closing.
  const handleCancel = useCallback(() => {
    if (!canCloseModal()) return;
    closeModal();
  }, [canCloseModal, closeModal]);

  const handleSubmit = async () => {
    dispatchUi({ type: 'setSubmitAttempted', value: true });
    const errors = validateForm(true);
    setFormDataErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    await handleCreate(true);
  };

  const handleAddCompanionClose = (value: SetStateAction<boolean>) => {
    const nextOpen = typeof value === 'function' ? value(showAddCompanionModal) : value;
    if (!nextOpen) {
      dispatchUi({ type: 'setAddCompanionTarget', value: null });
      loadCompanionsForPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
    }
  };

  const handleVisitTypeSelect = useCallback(
    (opt: string | { label: string; value: string }) => {
      const nextVisitType = getDropdownValue(opt);
      setFormData((prev) => ({
        ...prev,
        appointmentKind: visitTypeToAppointmentKind(nextVisitType),
      }));
    },
    [setFormData]
  );

  const showError = (field: keyof typeof formDataErrors) =>
    uiState.submitAttempted ? formDataErrors[field] : undefined;

  const exitPrefillMode = useCallback(() => {
    if (!prefillActive) return;
    dispatchUi({ type: 'dismissPrefill' });
    resetForm();
  }, [prefillActive, resetForm]);

  const handleDateChange = useCallback(
    (date: SetStateAction<Date>) => {
      exitPrefillMode();
      setSelectedDate(date);
    },
    [exitPrefillMode, setSelectedDate]
  );

  const handleLeadSelectWithReset = useCallback(
    (option: { label: string; value: string }) => {
      dispatchUi({ type: 'dismissPrefill' });
      handleLeadSelect(option);
    },
    [handleLeadSelect]
  );

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
    () => clientOptions.find((c) => c.value === uiState.selectedClientId)?.label,
    [clientOptions, uiState.selectedClientId]
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
      <AppointmentCentralModalShell
        showModal={showModal}
        setShowModal={setShowModal}
        title="New appointment"
        canClose={canCloseModal}
        isLoading={isLoading}
      >
        <AppointmentFormContent
          patientLabel={patientLabel}
          selectedPatientName={selectedPatientName}
          selectedPatientPhoto={selectedPatientPhoto}
          patientQuery={uiState.patientQuery}
          setPatientQuery={(value) => dispatchUi({ type: 'setPatientQuery', value })}
          patientOptions={patientOptions}
          handlePatientSelect={handlePatientSelect}
          handlePatientClear={handlePatientClear}
          selectedClientName={selectedClientName}
          clientQuery={uiState.clientQuery}
          setClientQuery={(value) => dispatchUi({ type: 'setClientQuery', value })}
          clientOptions={clientOptions}
          handleClientSelect={handleClientSelect}
          handleClientClear={handleClientClear}
          setAddCompanionTarget={(target) =>
            dispatchUi({ type: 'setAddCompanionTarget', value: target })
          }
          selectedDate={selectedDate}
          handleDateChange={handleDateChange}
          today={today}
          timeSlots={timeSlots}
          selectedSlot={selectedSlot}
          onSlotSelect={(slot) => {
            dispatchUi({ type: 'dismissPrefill' });
            setSelectedSlot(slot);
          }}
          formState={{
            loadingTimeSlots: uiState.isLoadingTimeSlots,
            loadingSlotScopedOptions: isLoadingSlotScopedOptions,
            serviceSelected: hasService,
            submitted: uiState.submitAttempted,
            loading: isLoading,
          }}
          noSlotsMessage={noSlotsMessage}
          prefillTimeLabel={prefillTimeLabel}
          durationDisplay={durationDisplay}
          visitType={visitType}
          handleVisitTypeSelect={handleVisitTypeSelect}
          LeadOptions={LeadOptions}
          formData={formData}
          formDataErrors={formDataErrors}
          handleLeadSelectWithReset={handleLeadSelectWithReset}
          leadEmptyStateMessage={leadEmptyStateMessage}
          supportOptions={supportOptions}
          handleSupportStaffChange={handleSupportStaffChange}
          SpecialitiesOptions={SpecialitiesOptions}
          handleSpecialitySelect={handleSpecialitySelect}
          ServicesOptions={ServicesOptions}
          handleServiceSelect={handleServiceSelect}
          setFormData={setFormData}
          ServiceInfoData={ServiceInfoData}
          showError={(field) => showError(field as keyof typeof formDataErrors)}
          handleSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </AppointmentCentralModalShell>

      <AddCompanionCentralModal
        showModal={showAddCompanionModal}
        setShowModal={handleAddCompanionClose}
        formMode="fasttrack"
        onCompanionCreated={(companionId) => {
          dispatchUi({ type: 'setPendingAutoSelectCompanionId', value: companionId });
          dispatchUi({ type: 'setAddCompanionTarget', value: null });
        }}
        onGoToAppointment={() => dispatchUi({ type: 'setAddCompanionTarget', value: null })}
      />

      <DiscardConfirmationModal
        showModal={uiState.showDiscardConfirm}
        setShowModal={(value) =>
          dispatchUi({
            type: 'setShowDiscardConfirm',
            value: typeof value === 'function' ? value(uiState.showDiscardConfirm) : value,
          })
        }
        onDiscard={handleDiscardAndClose}
      />
    </>
  );
};

const AddAppointmentCentralModal = (props: AddAppointmentCentralModalProps) =>
  useAddAppointmentCentralModalView(props);

export default AddAppointmentCentralModal;
