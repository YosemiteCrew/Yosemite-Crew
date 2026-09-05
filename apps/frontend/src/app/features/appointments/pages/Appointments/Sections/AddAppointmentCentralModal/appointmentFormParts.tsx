/**
 * The add-appointment modal's form pieces: its label/error chrome, the person
 * rows, the time-slot dropdown and its states, the form body and the discard
 * confirmation.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh, and so each of these stays
 * findable on its own instead of sitting inside a 1500-line modal module
 * (react-doctor/only-export-components).
 */
'use client';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import '@/app/ui/primitives/Buttons/ButtonEffects.css';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';
import { Slot } from '@/app/features/appointments/types/appointments';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Datepicker from '@/app/ui/inputs/Datepicker';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';
import AppointmentEstimatePanel from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel';
import { IoIosWarning } from 'react-icons/io';
import { IoAdd, IoArrowForward, IoChevronDown, IoPaw, IoPerson } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { primaryButtonGlowHandlers } from '@/app/ui/primitives/buttonGlowHandlers';
import clsx from 'clsx';

// ─── Design tokens (spec-exact) ────────────────────────────────────────────────
const FONT = 'var(--font-satoshi), sans-serif';
const NEUTRAL_900 = 'var(--color-neutral-900)';
const INPUT_PLACEHOLDER = 'var(--color-input-text-placeholder)';
const INPUT_PLACEHOLDER_ACTIVE = 'var(--color-input-text-placeholder-active)';

// 16-R: values / selected text / input content
const text16R: CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '120%',
  color: 'var(--ink-body)',
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

const VISIT_TYPE_OPTIONS = [
  { label: 'Outpatient', value: 'Outpatient' },
  { label: 'Inpatient', value: 'Inpatient' },
];

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
    className="yc-float-label pointer-events-none absolute left-5 z-10 flex items-center gap-1 bg-neutral-0 px-1 transition-all duration-150"
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

/** Equality guard so the measure-on-every-render layout effect settles instead of looping. */
const isSamePortalStyle = (a: CSSProperties | null, b: CSSProperties | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.left === b.left &&
    a.width === b.width &&
    a.top === b.top &&
    a.bottom === b.bottom);

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

  // Measure position in a layout effect when the menu opens (applied before
  // paint, so no visible delay) — refs must not be read during render
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const next = visibleOpen ? getPortalStyle(triggerRef.current) : null;
    setPortalStyle((cur) => (isSamePortalStyle(cur, next) ? cur : next));
  }, [visibleOpen]);

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
          'relative flex items-center min-h-[46px] border-[1.5px] bg-neutral-0 transition-colors duration-150 cursor-text',
          visibleOpen
            ? 'rounded-t-[12px] border-input-border-active border-b-0'
            : 'rounded-[12px] border-[var(--hairline)]',
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
              className="inline-flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--hairline)] bg-transparent px-3 font-satoshi text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:border-[var(--ink-muted)]"
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
  /** Shown while nothing is chosen; never blank. */
  placeholder?: string;
};

export const TimeSlotTriggerValue = ({
  isLoading,
  selectedLabel,
  placeholder = 'Select a time',
}: TimeSlotTriggerValueProps) => {
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

  // An unchosen slot showed an empty span, so the Time control read as a blank
  // box beside a filled Date. The design requires a placeholder on every select.
  return <span style={{ ...text16R, color: INPUT_PLACEHOLDER }}>{placeholder}</span>;
};

/** Trigger border: open state wins over the error state, which wins over resting. */
const timeSlotTriggerBorderClass = (open: boolean, error?: string): string => {
  if (open) return 'border-[var(--blue)]! shadow-[0_0_0_3px_var(--glow-b10)]';
  if (error) return 'border-[var(--danger)]!';
  return 'border-[var(--hairline)]!';
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
  // Measure position in a layout effect when the menu opens (applied before
  // paint, so no visible delay) — refs must not be read during render
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const next = open ? getPortalStyle(triggerRef.current) : null;
    setPortalStyle((cur) => (isSamePortalStyle(cur, next) ? cur : next));
  }, [open]);

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
    <div ref={containerRef} className="flex w-full flex-col">
      <span className="mb-1.5 block truncate text-[12px] font-semibold text-[var(--ink-soft)]">
        {label}
      </span>
      <button
        type="button"
        ref={triggerRef}
        className={clsx(
          'relative flex h-[44px] w-full items-center rounded-[12px]! border-[1.5px] bg-[var(--field-bg)] px-[13px] pr-9 text-left text-[13px] transition-colors duration-150 select-none focus:shadow-[0_0_0_3px_var(--glow-b10)]',
          timeSlotTriggerBorderClass(open, error)
        )}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={selectedLabel ? `${label}, ${selectedLabel}` : label}
      >
        <span className="flex-1 min-w-0">
          <TimeSlotTriggerValue isLoading={isLoading} selectedLabel={selectedLabel} />
        </span>

        <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <Arrow open={open} />
        </span>
      </button>
      {dropdownMenu}
      <FieldError message={error} />
    </div>
  );
};

// ─── SlotBadge — duration display ──────────────────────────────────────────────
// Matches the shared Datepicker / LabelDropdown field: label above the control,
// h-44, field-bg, rounded-12, hairline border - so it lines up with Date/Type.
export const SlotBadge = ({ label }: { label: string | null }) => (
  <div className="flex w-full flex-col">
    <span className="mb-1.5 block truncate text-[12px] font-semibold text-[var(--ink-soft)]">
      Slot duration
    </span>
    <div className="relative flex h-[44px] w-full items-center rounded-[12px]! border-[1.5px] border-[var(--hairline)]! bg-[var(--field-bg)] px-[13px]">
      <span
        className="text-[13px]"
        style={
          label
            ? { ...text16R, fontSize: 13 }
            : { ...text16R, fontSize: 13, color: INPUT_PLACEHOLDER }
        }
      >
        {label ?? ''}
      </span>
    </div>
  </div>
);

export type AppointmentFormContentProps = {
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
  /**
   * `modal` (default) is the desktop CenterModal layout: a 2-column field grid
   * with an inline Cancel + Book footer. `sheet` is the phone bottom-sheet
   * layout: a single full-width stacked column with no inline footer (the
   * sticky Book button lives in the BottomSheet footer instead).
   */
  variant?: 'modal' | 'sheet';
};

/** Every fallback the form fields render, resolved once so the JSX stays branch-free. */
const getAppointmentFieldValues = (formData: any) => ({
  leadId: formData.lead?.id ?? '',
  supportStaffIds: formData.supportStaff?.map((s: { id?: string }) => s.id ?? '') ?? [],
  specialityId: formData.appointmentType?.speciality?.id ?? '',
  serviceId: formData.appointmentType?.id ?? '',
  concern: formData.concern ?? '',
  isEmergency: formData.isEmergency ?? false,
});

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
  variant = 'modal',
}: AppointmentFormContentProps) => {
  const fieldValues = getAppointmentFieldValues(formData);

  return (
    // Rebind --field-bg to the warm surface so every field (Date/Time/Slot/Type and
    // the person pickers) shares one warm token instead of the cool #fafafa default.
    <div className="relative [--field-bg:var(--color-neutral-0)]">
      <div
        className={
          variant === 'sheet'
            ? 'grid grid-cols-1 gap-y-4'
            : 'grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2'
        }
      >
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
                placeholder="Type of visit"
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
              defaultOption={fieldValues.leadId}
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
            value={fieldValues.supportStaffIds}
            onChange={handleSupportStaffChange}
            portal
            icon={<IoPerson size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
          />
        </div>

        <div className="flex flex-col gap-4">
          <LabelDropdown
            placeholder="Speciality"
            options={SpecialitiesOptions}
            defaultOption={fieldValues.specialityId}
            onSelect={handleSpecialitySelect}
            error={showError('specialityId')}
            searchable
            portal
            icon={<IoAdd size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
          />

          <LabelDropdown
            placeholder="Services / packages"
            options={ServicesOptions}
            defaultOption={fieldValues.serviceId}
            onSelect={handleServiceSelect}
            error={showError('serviceId')}
            searchable
            portal
            icon={<IoAdd size={13} style={{ color: NEUTRAL_900 }} aria-hidden="true" />}
          />

          <FormDesc
            intype="text"
            inlabel="Chief complaint"
            value={fieldValues.concern}
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
                checked={fieldValues.isEmergency}
                onChange={(e) =>
                  setFormData((prev: any) => ({ ...prev, isEmergency: e.target.checked }))
                }
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-text-brand"
                style={{
                  backgroundColor: fieldValues.isEmergency ? 'var(--cta)' : 'var(--divider)',
                }}
              >
                <span
                  /* Fixed white: --screen flips with the theme, so in espresso the
                     knob was #2f271e on a #3a3128 track, a contrast of 1.15. */
                  className="absolute top-[3px] size-[18px] rounded-full bg-white transition-[left] duration-150"
                  style={{ left: fieldValues.isEmergency ? '19px' : '3px' }}
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

      {variant === 'sheet' ? null : (
        <div className="mt-6 flex flex-col gap-3 border-t border-card-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Secondary
            text="Cancel"
            onClick={onCancel}
            isDisabled={formState.loading}
            className="h-10 justify-center px-5 py-0 text-[13.5px] font-semibold"
          />
          <Primary
            text="Book appointment"
            onClick={handleSubmit}
            isDisabled={formState.loading}
            icon={<IoArrowForward aria-hidden="true" />}
            iconPosition="right"
            className="h-10 justify-center gap-[7px] px-5 py-0 text-[13.5px] font-semibold hover:scale-100"
          />
        </div>
      )}
    </div>
  );
};

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
          className="yc-primary-button rounded-2xl! px-5 py-2.5 font-satoshi text-base font-medium leading-[1.2] disabled:cursor-not-allowed disabled:opacity-60"
          {...primaryButtonGlowHandlers}
        >
          Discard
        </button>
      </div>
    </div>
  </CenterModal>
);
