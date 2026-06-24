'use client';
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { IoClose, IoPencilOutline, IoInformationCircleOutline } from 'react-icons/io5';
import { IoIosWarning } from 'react-icons/io';
import { FiPlus, FiCheck } from 'react-icons/fi';
import { MdPets } from 'react-icons/md';
import { FaUser } from 'react-icons/fa';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Datepicker from '@/app/ui/inputs/Datepicker';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useNotify } from '@/app/hooks/useNotify';
import { useFilteredOptions } from '@/app/hooks/useDropdown';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import {
  searchParent,
  createCompanion,
  createParent,
  getCompanionForParent,
  linkCompanion,
  updateCompanion,
  updateParent,
} from '@/app/features/companions/services/companionService';
import {
  fetchBreedCodeEntries,
  fetchSpeciesCodeEntries,
  BreedCodeEntry,
} from '@/app/features/companions/services/codeEntriesService';
import {
  StoredCompanion,
  StoredParent,
  CompanionParent,
} from '@/app/features/companions/pages/Companions/types';
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  CompanionAlert,
  CompanionFormData,
  fromStoredCompanionAlerts,
  toStoredCompanionAlerts,
  AlertPriority,
  ALERT_PRIORITY_CONFIG,
  CountryDialCodeOptions,
  CountryDialCodeOption,
  findPhoneData,
  getDigitsOnly,
  InsuredOptions,
  CountriesOptions,
  OriginOptions,
} from '@/app/features/companions/components/AddCompanion/type';
import {
  getEmailValidationError,
  normalizeEmail,
  validatePhone,
  toTitleCase,
} from '@/app/lib/validators';
import { CompanionType, RecordStatus, Gender, SourceType } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { formatDisplayDate, getAgeInYears } from '@/app/lib/date';
import { getCompanionStatusStyle } from '@/app/ui/tables/tableUtils';
import clsx from 'clsx';

// ─── Species / breed constants ────────────────────────────────────────────────

type SpeciesOption = {
  value: string;
  label: string;
  type: CompanionType;
  speciesCode: string;
  speciesQuery: string;
};
type BreedOption = { value: string; label: string; breedCode: string; speciesCode: string };

const DEFAULT_SPECIES_OPTIONS: SpeciesOption[] = [
  { label: 'Canine', value: 'dog', type: 'dog', speciesCode: '', speciesQuery: 'canine' },
  { label: 'Feline', value: 'cat', type: 'cat', speciesCode: '', speciesQuery: 'feline' },
  { label: 'Equine', value: 'horse', type: 'horse', speciesCode: '', speciesQuery: 'equine' },
];

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const BLOOD_GROUP_OPTIONS_BY_SPECIES: Record<CompanionType, { value: string; label: string }[]> = {
  cat: ['A', 'B', 'AB', 'Unknown'].map((g) => ({ value: g, label: g })),
  dog: [
    'DEA 1.1 Positive',
    'DEA 1.1 Negative',
    'DEA 1.2 Positive',
    'DEA 1.2 Negative',
    'DEA 3 Positive',
    'DEA 3 Negative',
    'DEA 4 Positive',
    'DEA 4 Negative',
    'DEA 5 Positive',
    'DEA 5 Negative',
    'DEA 7 Positive',
    'DEA 7 Negative',
    'Universal Donor',
    'Unknown',
  ].map((g) => ({ value: g, label: g })),
  horse: ['Aa', 'Ca', 'Da', 'Ka', 'Pa', 'Qa', 'Ua', 'Universal Donor', 'Unknown'].map((g) => ({
    value: g,
    label: g,
  })),
  other: [{ value: 'Unknown', label: 'Unknown' }],
};

const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

// Gender + neuter combined into one dropdown
type GenderNeuter = { gender: string; neutered: boolean };

const GENDER_NEUTER_OPTIONS: { value: string; label: string; data: GenderNeuter }[] = [
  { value: 'male-intact', label: 'Male', data: { gender: 'male', neutered: false } },
  { value: 'male-neutered', label: 'Male Neutered', data: { gender: 'male', neutered: true } },
  { value: 'female-intact', label: 'Female', data: { gender: 'female', neutered: false } },
  { value: 'female-spayed', label: 'Female Spayed', data: { gender: 'female', neutered: true } },
  { value: 'unknown-intact', label: 'Unknown', data: { gender: 'unknown', neutered: false } },
];

const getGenderNeuterValue = (gender: string, neutered: boolean): string => {
  const match = GENDER_NEUTER_OPTIONS.find(
    (o) => o.data.gender === gender && o.data.neutered === neutered
  );
  return match?.value ?? 'unknown-intact';
};

const toNonNegativeNumber = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat((value ?? '').toString());
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(0, parsed);
};

const MAX_LOCAL_PHONE_LENGTH = 15;

const ALERT_PRIORITY_OPTIONS: { value: AlertPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const buildFullName = (firstName: string, lastName?: string | null): string =>
  lastName ? `${firstName} ${lastName}` : firstName;

const deduplicateBreedEntries = (
  entries: BreedCodeEntry[],
  fallbackSpeciesCode: string
): BreedOption[] => {
  const seen = new Set<string>();
  return entries.reduce<BreedOption[]>((acc, e) => {
    if (!seen.has(e.display)) {
      seen.add(e.display);
      acc.push({
        value: e.display,
        label: e.display,
        breedCode: e.code,
        speciesCode: e.meta?.speciesCode ?? fallbackSpeciesCode,
      });
    }
    return acc;
  }, []);
};

const loadBreedOptions = async (
  speciesOptions: SpeciesOption[],
  companionType: string,
  setBreedOptions: (opts: BreedOption[]) => void,
  signal: { cancelled: boolean }
) => {
  const sel = speciesOptions.find((o) => o.type === companionType);
  if (!sel) {
    setBreedOptions([]);
    return;
  }
  try {
    const entries = await fetchBreedCodeEntries(sel.speciesQuery);
    if (!signal.cancelled) setBreedOptions(deduplicateBreedEntries(entries, sel.speciesCode));
  } catch {
    if (!signal.cancelled) setBreedOptions([]);
  }
};

const fmtDate = (v?: Date | string) => {
  if (!v) return '-';
  return formatDisplayDate(v, '-');
};

const fmtAge = (dob?: Date | string) => {
  if (!dob) return '-';
  const age = getAgeInYears(dob);
  if (!Number.isFinite(age) || age < 0) return '-';
  return `${age} ${age === 1 ? 'Yr' : 'Yrs'}`;
};

const fmt = (v?: string | number | null) => String(v ?? '').trim() || '-';

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeading = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2">
    <span className="flex items-center justify-center text-text-primary">{icon}</span>
    <h3
      style={{
        fontFamily: 'var(--font-satoshi), sans-serif',
        fontSize: 16,
        fontWeight: 700,
        lineHeight: '120%',
        color: 'var(--color-neutral-700)',
      }}
    >
      {title}
    </h3>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-2.5 border-t border-card-border first:border-t-0">
    <span className="text-[12px] font-semibold text-text-secondary shrink-0">{label}</span>
    <span className="text-[13px] font-medium text-text-primary text-right">{value || '-'}</span>
  </div>
);

const AlertChipView = ({ alert }: { alert: CompanionAlert }) => {
  const cfg = ALERT_PRIORITY_CONFIG[alert.priority] ?? ALERT_PRIORITY_CONFIG.medium;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border leading-[1.4]"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {alert.label}
    </span>
  );
};

const AlertChipEdit = ({
  alert,
  onRemove,
}: {
  alert: CompanionAlert;
  onRemove: (id: string) => void;
}) => {
  const cfg = ALERT_PRIORITY_CONFIG[alert.priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border leading-[1.4]"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {alert.label}
      <button
        type="button"
        aria-label={`Remove alert ${alert.label}`}
        onClick={() => onRemove(alert.id)}
        className="flex items-center justify-center rounded-full size-3.5 hover:opacity-70 transition-opacity"
        style={{ color: cfg.text }}
      >
        <IoClose size={11} />
      </button>
    </span>
  );
};

// ─── Inline search input with design-system dropdown ─────────────────────────

const getInputBorderClass = (error?: string): string =>
  error ? 'border-input-border-error!' : 'border-input-border-default!';

type SearchOption = { value: string; label: string };

const DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_MIN_HEIGHT = 72;

/**
 * Text input whose value drives an async search.
 * Dropdown panel matches LabelDropdown styling exactly.
 * Rendered via portal so it is never clipped by overflow:hidden parents.
 * Option clicks use stopPropagation so the modal's outside-click listener never fires.
 */
const InputWithDropdown = ({
  value,
  inlabel,
  inname,
  onChange,
  onSelect,
  options,
  error,
}: {
  value: string;
  inlabel: string;
  inname: string;
  onChange: (v: string) => void;
  onSelect: (opt: SearchOption) => void;
  options: SearchOption[];
  error?: string;
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
  const uid = useId();
  // Only auto-open after the user has typed — prevents dropdown firing when
  // edit mode mounts with a pre-filled value that matches existing companions.
  const userHasTypedRef = useRef(false);

  const filtered = useFilteredOptions(options, value);

  // Close on outside mousedown — but never when target is inside the portal panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-iwd-panel]')) return;
      if (wrapRef.current && !wrapRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-open when results arrive, auto-close when empty — but only after user interaction
  useEffect(() => {
    if (!userHasTypedRef.current) return;
    setOpen(filtered.length > 0);
  }, [filtered.length]);

  const computeStyle = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxH = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow - 8));
    setPortalStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: rect.bottom - 1,
      maxHeight: maxH,
      zIndex: 5000,
    });
  }, []);

  const computeStyleRef = useRef(computeStyle);
  computeStyleRef.current = computeStyle;

  useLayoutEffect(() => {
    if (!open) {
      setPortalStyle(null);
      return;
    }
    computeStyleRef.current();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const stableResize = () => computeStyleRef.current();
    window.addEventListener('resize', stableResize);
    return () => window.removeEventListener('resize', stableResize);
  }, [open]);

  const handleSelect = (opt: SearchOption) => {
    onSelect(opt);
    setOpen(false);
  };

  const panel = (
    <div
      data-iwd-panel
      aria-label={inlabel}
      className="border-input-text-placeholder-active overflow-y-auto scrollbar-hidden rounded-b-2xl border border-t bg-white flex flex-col items-stretch px-3 py-2.5"
      style={portalStyle ?? undefined}
    >
      {filtered.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="px-5 py-3 text-left text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => handleSelect(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <div className="w-full relative" ref={wrapRef}>
        <input
          id={uid}
          type="text"
          name={inname}
          aria-label={inlabel}
          value={value}
          autoComplete="off"
          placeholder=" "
          onChange={(e) => {
            userHasTypedRef.current = true;
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (userHasTypedRef.current && filtered.length > 0) setOpen(true);
          }}
          aria-invalid={Boolean(error)}
          className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary outline-none border
            ${open ? 'border-input-border-active! rounded-b-none! border-b-0!' : getInputBorderClass(error)}
          `}
        />
        <label
          htmlFor={uid}
          className={`
            pointer-events-none absolute left-4
            top-1/2 -translate-y-1/2
            max-w-[calc(100%-2rem)] truncate
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-2.75 peer-focus:translate-y-0
            peer-focus:text-xs! peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg) peer-focus:px-1.5 peer-focus:max-w-none
            peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:max-w-none
            peer-not-placeholder-shown:-top-2.75 peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-xs! peer-not-placeholder-shown:bg-(--whitebg)
          `}
        >
          {inlabel}
        </label>
        {open &&
          portalStyle &&
          typeof document !== 'undefined' &&
          createPortal(panel, document.body)}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'view' | 'edit';

type AddCompanionCentralModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  /** When provided, opens in view mode for this companion */
  viewCompanion?: CompanionParent | null;
  /** Whether the user can change status (view mode) */
  canEditCompanionStatus?: boolean;
  onCompanionCreated?: (companionId: string) => void;
  formMode?: 'default' | 'fasttrack';
  /** Shows "← Go to Appointment" bottom-left button when provided */
  onGoToAppointment?: () => void;
};

type ExtCompanionForValidation = CompanionFormData;

const validateParentFields = (
  parentFormData: StoredParent,
  selectedCountryCode: CountryDialCodeOption | null,
  localPhoneNumber: string
): Partial<Record<string, string>> => {
  const errs: Partial<Record<string, string>> = {};
  if (!parentFormData.firstName) errs.firstName = 'First name is required';
  if (!parentFormData.lastName) errs.lastName = 'Last name is required';
  const emailError = getEmailValidationError(parentFormData.email);
  if (emailError) errs.email = emailError;
  if (!selectedCountryCode?.dialCode) errs.countryCode = 'Country code is required';
  if (!localPhoneNumber) errs.phoneNumber = 'Number is required';
  if (!parentFormData.address.addressLine?.trim()) errs.addressLine = 'Address is required';
  if (!parentFormData.address.city?.trim()) errs.city = 'City is required';
  if (!parentFormData.address.state?.trim()) errs.state = 'State/Province is required';
  if (!parentFormData.address.postalCode?.trim()) errs.postalCode = 'Postal code is required';
  if (selectedCountryCode?.dialCode && localPhoneNumber) {
    if (!validatePhone(`${selectedCountryCode.dialCode}${localPhoneNumber}`))
      errs.phoneNumber = 'Enter a valid phone number';
  }
  return errs;
};

const validateCompanionFields = (
  companionFormData: ExtCompanionForValidation,
  isFastTrack: boolean
): Partial<Record<string, string>> => {
  const errs: Partial<Record<string, string>> = {};
  if (!companionFormData.name) errs.name = 'Name is required';
  if (!companionFormData.type) errs.species = 'Species is required';
  if (!companionFormData.breed) errs.breed = 'Breed is required';
  if (!isFastTrack && companionFormData.isInsured) {
    if (!companionFormData.insurance?.companyName)
      errs.insuranceCompany = 'Company name is required';
    if (!companionFormData.insurance?.policyNumber)
      errs.insuranceNumber = 'Policy number is required';
  }
  return errs;
};

type EditSnapshot = {
  companionName: string;
  companionType: string;
  companionBreed: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY_SNAPSHOT: EditSnapshot = {
  companionName: EMPTY_STORED_COMPANION.name,
  companionType: EMPTY_STORED_COMPANION.type,
  companionBreed: EMPTY_STORED_COMPANION.breed,
  firstName: EMPTY_STORED_PARENT.firstName,
  lastName: EMPTY_STORED_PARENT.lastName ?? '',
  email: EMPTY_STORED_PARENT.email,
  phone: '',
};

const computeHasUnsavedChanges = (
  snap: EditSnapshot,
  companionFormData: ExtCompanionForValidation,
  parentFormData: StoredParent,
  localPhoneNumber: string
): boolean =>
  companionFormData.name !== snap.companionName ||
  (companionFormData.type ?? '') !== snap.companionType ||
  (companionFormData.breed ?? '') !== snap.companionBreed ||
  (parentFormData.firstName ?? '') !== snap.firstName ||
  (parentFormData.lastName ?? '') !== snap.lastName ||
  (parentFormData.email ?? '') !== snap.email ||
  localPhoneNumber !== snap.phone;

const fetchParentResults = async (q: string): Promise<StoredParent[]> => {
  try {
    return await searchParent(q);
  } catch {
    return [];
  }
};

const createCompanionFlow = async (
  normalizedParent: StoredParent,
  companionFormData: ExtCompanionForValidation
): Promise<StoredCompanion | undefined> => {
  if (normalizedParent.id) {
    const payload: StoredCompanion = {
      ...companionFormData,
      alerts: toStoredCompanionAlerts(companionFormData.alerts),
      parentId: normalizedParent.id,
    };
    // Persist parent-level edits (e.g. client alerts) for the existing parent;
    // createCompanion/linkCompanion only upsert the parent into the local store,
    // so without this the alerts would disappear after a refresh.
    await updateParent(normalizedParent);
    if (companionFormData.id) {
      return (await linkCompanion(payload, normalizedParent)) ?? undefined;
    }
    return (await createCompanion(payload, normalizedParent)) ?? undefined;
  }
  const parentId = await createParent(normalizedParent);
  const pp: StoredParent = { ...normalizedParent, id: parentId! };
  return (
    (await createCompanion(
      {
        ...companionFormData,
        alerts: toStoredCompanionAlerts(companionFormData.alerts),
        parentId: parentId!,
      },
      pp
    )) ?? undefined
  );
};

const getModalTitle = (mode: ModalMode, companionTitle: string): string => {
  if (mode === 'view') return companionTitle || 'Patient Details';
  if (mode === 'edit') return 'Edit Patient / Client';
  return 'New Patient / Client';
};

type FooterLeftProps = {
  mode: ModalMode;
  onGoToAppointment?: () => void;
  hasUnsavedChanges: boolean;
  pendingGoToAppointmentRef: React.RefObject<boolean>;
  setShowDiscardConfirm: (v: boolean) => void;
  setMode: (m: ModalMode) => void;
  setCompanionErrors: (e: Partial<Record<string, string>>) => void;
  setParentErrors: (e: Partial<Record<string, string>>) => void;
};

const FooterLeft = ({
  mode,
  onGoToAppointment,
  hasUnsavedChanges,
  pendingGoToAppointmentRef,
  setShowDiscardConfirm,
  setMode,
  setCompanionErrors,
  setParentErrors,
}: FooterLeftProps) => {
  if (onGoToAppointment && mode === 'create') {
    return (
      <Secondary
        href="#"
        text="← Go to Appointment"
        onClick={(e) => {
          e?.preventDefault();
          if (hasUnsavedChanges) {
            pendingGoToAppointmentRef.current = true;
            setShowDiscardConfirm(true);
          } else {
            onGoToAppointment();
          }
        }}
      />
    );
  }
  if (mode === 'edit') {
    return (
      <Secondary
        href="#"
        text="Discard changes"
        onClick={() => {
          setMode('view');
          setCompanionErrors({});
          setParentErrors({});
        }}
      />
    );
  }
  return <div />;
};

const getSexLabel = (gender: string | undefined, isneutered: boolean | undefined): string => {
  if (!gender) return '-';
  return (
    GENDER_NEUTER_OPTIONS.find(
      (o) => o.data.gender === gender && o.data.neutered === (isneutered ?? false)
    )?.label ?? toTitleCase(gender)
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const isCompanionModalBusy = (isSubmitting: boolean, savingStatus: boolean): boolean =>
  isSubmitting || savingStatus;

const getCompanionModalLoadingLabel = (savingStatus: boolean): string =>
  savingStatus ? 'Updating status…' : 'Saving companion…';

const AddCompanionCentralModal = ({
  showModal,
  setShowModal,
  viewCompanion,
  canEditCompanionStatus = false,
  onCompanionCreated,
  formMode = 'default',
  onGoToAppointment,
}: AddCompanionCentralModalProps) => {
  const isFastTrack = formMode === 'fasttrack';
  const router = useRouter();
  const notifyHook = useNotify();

  // ── Derived initial mode ──
  const initialMode: ModalMode = viewCompanion ? 'view' : 'create';
  const [mode, setMode] = useState<ModalMode>(initialMode);

  // ── Loading / discard states ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RecordStatus | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // When "← Go to Appointment" is clicked with dirty data, we show the discard confirm and then
  // navigate back rather than closing the whole modal.
  const pendingGoToAppointmentRef = useRef(false);

  // ── Parent form state ──
  const [parentFormData, setParentFormData] = useState<StoredParent>(EMPTY_STORED_PARENT);
  const [parentErrors, setParentErrors] = useState<Partial<Record<string, string>>>({});
  const [parentDOB, setParentDOB] = useState<Date | null>(null);
  // parentSearchQuery drives the API; suppress flag prevents re-fetching after user selects a result
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const parentSelectionRef = useRef(false);
  const [parentResults, setParentResults] = useState<StoredParent[]>([]);
  const defaultPhoneData = useMemo(() => findPhoneData('', ''), []);
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryDialCodeOption>(
    defaultPhoneData.selectedCode
  );
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const dialCodeByOptionValue = useMemo(
    () => new Map(CountryDialCodeOptions.map((o) => [o.value, o])),
    []
  );

  // ── All companions from store — used for name-based search in patient field ──
  const allCompanionParents = useCompanionsParentsForPrimaryOrg();

  // ── Edit-mode dirty tracking — snapshot of field values at the moment edit starts ──
  const editSnapshotRef = useRef<EditSnapshot | null>(null);

  // ── Companion form state ──
  const [companionFormData, setCompanionFormData] =
    useState<ExtCompanionForValidation>(EMPTY_STORED_COMPANION);
  const [companionErrors, setCompanionErrors] = useState<Partial<Record<string, string>>>({});
  const [companionDOB, setCompanionDOB] = useState<Date | null>(null);
  const [companionResults, setCompanionResults] = useState<StoredCompanion[]>([]);

  // ── Species / breed ──
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>(DEFAULT_SPECIES_OPTIONS);
  const [breedOptions, setBreedOptions] = useState<BreedOption[]>([]);

  // ── Alerts ──
  const [alertInput, setAlertInput] = useState('');
  const [alertPriority, setAlertPriority] = useState<AlertPriority>('medium');

  // ── Client (parent) alerts ──
  const [clientAlertInput, setClientAlertInput] = useState('');
  const [clientAlertPriority, setClientAlertPriority] = useState<AlertPriority>('medium');
  const [clientAlerts, setClientAlerts] = useState<CompanionAlert[]>([]);

  useLayoutEffect(() => {
    setMode(initialMode);
    setPendingStatus(null);
  }, [initialMode, showModal]);

  // ── Reset on close ──
  const resetAll = useCallback(() => {
    setParentFormData(EMPTY_STORED_PARENT);
    setParentErrors({});
    setParentDOB(null);
    setParentSearchQuery('');
    setParentResults([]);
    setSelectedCountryCode(defaultPhoneData.selectedCode);
    setLocalPhoneNumber('');
    setCompanionFormData(EMPTY_STORED_COMPANION);
    setCompanionErrors({});
    setCompanionDOB(null);
    setCompanionResults([]);
    setAlertInput('');
    setAlertPriority('medium');
    setClientAlertInput('');
    setClientAlertPriority('medium');
    setClientAlerts([]);
  }, [defaultPhoneData.selectedCode]);

  useLayoutEffect(() => {
    if (!showModal) {
      resetAll();
      setMode(initialMode);
    }
  }, [showModal, resetAll, initialMode]);

  // ── Populate edit form from viewCompanion ──
  useEffect(() => {
    if (mode === 'edit' && viewCompanion) {
      const c = viewCompanion.companion;
      const p = viewCompanion.parent;
      setCompanionFormData({ ...c, alerts: fromStoredCompanionAlerts((c as any).alerts ?? []) });
      setCompanionDOB(c.dateOfBirth ? new Date(c.dateOfBirth) : null);
      setParentFormData(p);
      setClientAlerts(fromStoredCompanionAlerts((p as { alerts?: unknown }).alerts as never));
      setParentDOB(p.birthDate ? new Date(p.birthDate) : null);
      const pd = findPhoneData(p.phoneNumber || '', p.address.country);
      setSelectedCountryCode(pd.selectedCode);
      setLocalPhoneNumber(pd.localNumber);
      editSnapshotRef.current = {
        companionName: c.name ?? '',
        companionType: c.type ?? '',
        companionBreed: c.breed ?? '',
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        email: p.email ?? '',
        phone: pd.localNumber,
      };
    } else if (mode !== 'edit') {
      editSnapshotRef.current = null;
    }
  }, [mode, viewCompanion]);

  // ── Parent search — debounced API call; skipped once after a selection ──
  useEffect(() => {
    const q = parentSearchQuery.trim();
    if (!q) {
      setParentResults([]);
      return;
    }
    if (parentSelectionRef.current) {
      parentSelectionRef.current = false;
      return;
    }
    const t = globalThis.setTimeout(() => {
      fetchParentResults(q).then(setParentResults);
    }, 300);
    return () => globalThis.clearTimeout(t);
  }, [parentSearchQuery]);

  // ── Companion search — load all companions when a parent is selected ──
  useEffect(() => {
    const pid = parentFormData.id;
    if (!pid) {
      setCompanionResults([]);
      return;
    }
    let mounted = true;
    getCompanionForParent(pid)
      .then((c) => {
        if (mounted) setCompanionResults(c);
      })
      .catch(() => {
        if (mounted) setCompanionResults([]);
      });
    return () => {
      mounted = false;
    };
  }, [parentFormData.id]);

  // ── Sync DOBs ──
  useEffect(() => {
    setParentFormData((prev) => ({ ...prev, birthDate: parentDOB ?? undefined }));
  }, [parentDOB]);

  useEffect(() => {
    setCompanionFormData((prev) => ({ ...prev, dateOfBirth: companionDOB ?? new Date() }));
  }, [companionDOB]);

  // ── Species codes ──
  useEffect(() => {
    let mounted = true;
    fetchSpeciesCodeEntries()
      .then((entries) => {
        if (!mounted) return;
        const byQuery = new Map(entries.map((e) => [e.display.toLowerCase(), e]));
        setSpeciesOptions(
          DEFAULT_SPECIES_OPTIONS.map((o) => ({
            ...o,
            speciesCode: byQuery.get(o.speciesQuery)?.code ?? '',
          }))
        );
      })
      .catch(() => {
        if (mounted) setSpeciesOptions(DEFAULT_SPECIES_OPTIONS);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ── Breed codes ──
  useEffect(() => {
    const signal = { cancelled: false };
    loadBreedOptions(speciesOptions, companionFormData.type, setBreedOptions, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [companionFormData.type, speciesOptions]);

  // ── Handlers: parent ──
  const handleParentSelect = (parentId: string) => {
    const sel = parentResults.find((p) => p.id === parentId);
    if (!sel) return;
    parentSelectionRef.current = true; // suppress next search re-fetch
    setParentFormData(sel);
    setClientAlerts(fromStoredCompanionAlerts((sel as { alerts?: unknown }).alerts as never));
    const pd = findPhoneData(sel.phoneNumber || '', sel.address.country);
    setSelectedCountryCode(pd.selectedCode);
    setLocalPhoneNumber(pd.localNumber);
    setParentDOB(sel.birthDate ? new Date(sel.birthDate) : null);
    setParentResults([]); // clear results so dropdown closes
    setParentSearchQuery(buildFullName(sel.firstName, sel.lastName));
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = getDigitsOnly(value).slice(0, MAX_LOCAL_PHONE_LENGTH);
    setLocalPhoneNumber(sanitized);
    setParentFormData((prev) => ({
      ...prev,
      phoneNumber: sanitized ? `${selectedCountryCode.dialCode}${sanitized}` : '',
    }));
  };

  const handleCountryCodeSelect = (value: string) => {
    const code = dialCodeByOptionValue.get(value);
    if (!code) return;
    setSelectedCountryCode(code);
    setParentFormData((prev) => ({
      ...prev,
      phoneNumber: localPhoneNumber ? `${code.dialCode}${localPhoneNumber}` : '',
    }));
  };

  const updateAddressField = (
    field: 'addressLine' | 'city' | 'state' | 'postalCode',
    value: string
  ) => {
    setParentFormData((prev) => ({ ...prev, address: { ...prev.address, [field]: value } }));
    setParentErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAddressSelect = (address: {
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  }) => {
    setParentFormData((prev) => ({
      ...prev,
      address: { ...prev.address, ...address, country: address.country || prev.address.country },
    }));
    setParentErrors((prev) => ({
      ...prev,
      addressLine: undefined,
      city: undefined,
      state: undefined,
      postalCode: undefined,
    }));
  };

  // ── Handlers: companion ──
  const handleCompanionSelect = (id: string) => {
    // Look in store first (name search), fall back to parent-scoped results
    const cp = allCompanionParents.find((x) => x.companion.id === id);
    const sel: StoredCompanion | undefined =
      cp?.companion ?? companionResults.find((c) => c.id === id);
    if (!sel) return;
    setCompanionFormData({
      ...sel,
      alerts: fromStoredCompanionAlerts((sel as any).alerts ?? []),
    });
    setCompanionDOB(sel.dateOfBirth ? new Date(sel.dateOfBirth) : null);
    // Also autofill parent/client if found in store
    if (cp?.parent) {
      const p = cp.parent;
      setParentFormData(p);
      setClientAlerts(fromStoredCompanionAlerts((p as { alerts?: unknown }).alerts as never));
      const pd = findPhoneData(p.phoneNumber || '', p.address.country);
      setSelectedCountryCode(pd.selectedCode);
      setLocalPhoneNumber(pd.localNumber);
      setParentDOB(p.birthDate ? new Date(p.birthDate) : null);
      parentSelectionRef.current = true;
      setParentSearchQuery(buildFullName(p.firstName, p.lastName));
    }
    setCompanionResults([]); // clear so dropdown closes
  };

  // ── Handlers: alerts ──
  const addAlert = () => {
    const label = alertInput.trim();
    if (!label) return;
    setCompanionFormData((prev) => ({
      ...prev,
      alerts: [...(prev.alerts ?? []), { id: crypto.randomUUID(), label, priority: alertPriority }],
    }));
    setAlertInput('');
  };

  const removeAlert = (id: string) =>
    setCompanionFormData((prev) => ({
      ...prev,
      alerts: (prev.alerts ?? []).filter((a) => a.id !== id),
    }));

  // ── Handlers: client (parent) alerts ──
  const addClientAlert = () => {
    const label = clientAlertInput.trim();
    if (!label) return;
    setClientAlerts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label, priority: clientAlertPriority },
    ]);
    setClientAlertInput('');
  };

  const removeClientAlert = (id: string) =>
    setClientAlerts((prev) => prev.filter((a) => a.id !== id));

  // ── Status change (view mode) ──
  const handleStatusChange = async (newStatus: RecordStatus) => {
    if (!viewCompanion || newStatus === (pendingStatus ?? viewCompanion.companion.status)) return;
    setPendingStatus(newStatus);
    setSavingStatus(true);
    try {
      await updateCompanion({ ...viewCompanion.companion, status: newStatus });
      notifyHook.notify('success', {
        title: 'Status updated',
        text: `Companion is now ${toTitleCase(newStatus)}.`,
      });
    } catch {
      notifyHook.notify('error', { title: 'Failed to update status', text: 'Please try again.' });
      setPendingStatus(null);
    } finally {
      setSavingStatus(false);
    }
  };

  // ── Validation ──
  const validateParent = (): boolean => {
    const errs = validateParentFields(parentFormData, selectedCountryCode, localPhoneNumber);
    setParentErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateCompanion = (): boolean => {
    const errs = validateCompanionFields(companionFormData, isFastTrack);
    setCompanionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit helpers ──
  const handleEditSave = async (normalizedParent: StoredParent) => {
    const companionPayload: StoredCompanion = {
      ...companionFormData,
      alerts: toStoredCompanionAlerts(companionFormData.alerts),
      parentId: normalizedParent.id,
    };
    await Promise.all([updateCompanion(companionPayload), updateParent(normalizedParent)]);
    notifyHook.notify('success', {
      title: 'Companion updated',
      text: 'Companion has been updated successfully.',
    });
    setMode('view');
  };

  // ── Submit (create / edit save) ──
  const handleSubmit = async () => {
    if (!validateParent() || !validateCompanion()) return;
    setIsSubmitting(true);
    try {
      const normalizedParent: StoredParent = {
        ...parentFormData,
        email: normalizeEmail(parentFormData.email),
        alerts: toStoredCompanionAlerts(clientAlerts),
      };

      if (mode === 'edit') {
        await handleEditSave(normalizedParent);
        return;
      }

      const createdCompanion = await createCompanionFlow(normalizedParent, companionFormData);
      notifyHook.notify('success', {
        title: 'Companion saved',
        text: 'Companion has been saved successfully.',
      });
      if (createdCompanion) onCompanionCreated?.(createdCompanion.id);
      setShowModal(false);
    } catch {
      notifyHook.notify('error', {
        title: 'Unable to save',
        text: 'Failed to save companion. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived values for view mode ──
  const vc = viewCompanion?.companion;
  const vp = viewCompanion?.parent;
  const displayStatus: RecordStatus = pendingStatus ?? vc?.status ?? 'active';
  const statusStyle = vc ? getCompanionStatusStyle(displayStatus) : {};
  const speciesLabel = vc ? (SPECIES_LABEL[vc.type?.toLowerCase()] ?? toTitleCase(vc.type)) : '';
  const vcAlerts: CompanionAlert[] = fromStoredCompanionAlerts((vc as any)?.alerts ?? []);
  const vpAlerts: CompanionAlert[] = fromStoredCompanionAlerts(
    (vp as { alerts?: unknown } | undefined)?.alerts as never
  );
  const companionTitle = vc && vp ? formatCompanionNameWithOwnerLastName(vc.name, vp) : '';

  const parentSearchOptions = useMemo(
    () =>
      parentResults.map((p) => ({
        value: p.id,
        label: buildFullName(p.firstName, p.lastName),
      })),
    [parentResults]
  );
  // Companion name search: filter all org companions by what the user is typing
  const companionSearchOptions = useMemo(() => {
    const q = companionFormData.name.trim().toLowerCase();
    if (q.length < 1) return [];
    return allCompanionParents
      .filter((cp) => cp.companion.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map((cp) => ({ value: cp.companion.id, label: cp.companion.name }));
  }, [allCompanionParents, companionFormData.name]);

  // ── Modal title ──
  const modalTitle = getModalTitle(mode, companionTitle);

  // ── Current gender+neuter combined value ──
  const genderNeuterValue = getGenderNeuterValue(
    companionFormData.gender,
    companionFormData.isneutered ?? false
  );

  // ── Dirty detection — compare current values against clean baseline ──
  const hasUnsavedChanges = useMemo(
    () =>
      mode !== 'view' &&
      computeHasUnsavedChanges(
        editSnapshotRef.current ?? EMPTY_SNAPSHOT,
        companionFormData,
        parentFormData,
        localPhoneNumber
      ),
    [mode, companionFormData, parentFormData, localPhoneNumber]
  );

  const canCloseModal = useCallback(() => {
    if (isSubmitting || savingStatus) return false;
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return false;
    }
    return true;
  }, [isSubmitting, savingStatus, hasUnsavedChanges]);

  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardConfirm(false);
    if (pendingGoToAppointmentRef.current) {
      pendingGoToAppointmentRef.current = false;
      onGoToAppointment?.();
    } else {
      setShowModal(false);
    }
  }, [setShowModal, onGoToAppointment]);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <AppointmentCentralModalShell
        showModal={showModal}
        setShowModal={setShowModal}
        title={modalTitle}
        canClose={canCloseModal}
        isLoading={isCompanionModalBusy(isSubmitting, savingStatus)}
        loadingLabel={getCompanionModalLoadingLabel(savingStatus)}
      >
        <div className="flex flex-col gap-6">
          {/* ══ VIEW MODE ═══════════════════════════════════════════════════════ */}
          {mode === 'view' && vc && vp && (
            <>
              {/* Identity strip */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-card-border">
                <div className="flex items-center gap-3">
                  <Image
                    alt={vc.name}
                    src={getSafeImageUrl(vc.photoUrl, vc.type.toLowerCase() as ImageType)}
                    className="rounded-full object-cover shrink-0"
                    height={48}
                    width={48}
                    style={{ width: 48, height: 48 }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="text-[15px] font-semibold text-text-primary text-left hover:underline underline-offset-2 leading-tight"
                      onClick={() => {
                        router.push(
                          buildCompanionOverviewHref(
                            vc.id,
                            vc.id
                              ? `/companions?${new URLSearchParams({ companionId: vc.id }).toString()}`
                              : ''
                          )
                        );
                        setShowModal(false);
                      }}
                    >
                      {companionTitle}
                    </button>
                    <span className="text-[12px] text-text-secondary">
                      {speciesLabel} · {fmt(vc.breed)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status — single control */}
                  {canEditCompanionStatus ? (
                    <div className={clsx('w-40', savingStatus && 'opacity-40 pointer-events-none')}>
                      <LabelDropdown
                        placeholder="Change status"
                        options={STATUS_OPTIONS}
                        defaultOption={displayStatus}
                        onSelect={(o) => handleStatusChange(o.value as RecordStatus)}
                        portal
                      />
                    </div>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border"
                      style={statusStyle}
                    >
                      {toTitleCase(displayStatus)}
                    </span>
                  )}

                  {/* Edit toggle */}
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className="flex items-center gap-1.5 rounded-2xl border border-card-border px-3 h-9 text-[13px] font-medium text-text-primary hover:bg-card-hover transition-colors"
                  >
                    <IoPencilOutline size={14} />
                    Edit
                  </button>
                </div>
              </div>

              {/* Two-column read-only grid — mirrors create/edit layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 lg:items-start">
                {/* Left — Patient */}
                <div className="flex flex-col gap-3">
                  <SectionHeading icon={<MdPets size={16} />} title="Patient Details" />

                  {/* Core patient info rows */}
                  <div className="flex flex-col">
                    <InfoRow label="Name" value={vc.name} />
                    <InfoRow label="Species" value={speciesLabel} />
                    <InfoRow label="Breed" value={fmt(vc.breed)} />
                    <InfoRow label="DOB" value={fmtDate(vc.dateOfBirth)} />
                    <InfoRow label="Age" value={fmtAge(vc.dateOfBirth)} />
                    <InfoRow label="Sex" value={getSexLabel(vc.gender, vc.isneutered)} />
                  </div>

                  {/* Alerts */}
                  {vcAlerts.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                        Alerts
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {vcAlerts.map((a) => (
                          <AlertChipView key={a.id} alert={a} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional details accordion */}
                  <Accordion
                    title="Additional Details"
                    defaultOpen={false}
                    showEditIcon={false}
                    titleClassName="text-body-4"
                  >
                    <div className="flex flex-col pt-1">
                      {vc.colour && <InfoRow label="Color" value={fmt(vc.colour)} />}
                      {vc.bloodGroup && <InfoRow label="Blood group" value={fmt(vc.bloodGroup)} />}
                      {vc.currentWeight != null && (
                        <InfoRow label="Weight (lbs)" value={fmt(vc.currentWeight)} />
                      )}
                      {vc.countryOfOrigin && (
                        <InfoRow label="Country of origin" value={fmt(vc.countryOfOrigin)} />
                      )}
                      {vc.microchipNumber && (
                        <InfoRow label="Microchip" value={fmt(vc.microchipNumber)} />
                      )}
                      {vc.passportNumber && (
                        <InfoRow label="Passport" value={fmt(vc.passportNumber)} />
                      )}
                      <InfoRow label="Insurance" value={vc.isInsured ? 'Insured' : 'Not insured'} />
                      {vc.isInsured && (
                        <>
                          <InfoRow
                            label="Insurance company"
                            value={fmt(vc.insurance?.companyName)}
                          />
                          <InfoRow label="Policy number" value={fmt(vc.insurance?.policyNumber)} />
                        </>
                      )}
                      {vc.allergy && <InfoRow label="Allergies" value={fmt(vc.allergy)} />}
                    </div>
                  </Accordion>
                </div>

                {/* Right — Client */}
                <div className="flex flex-col gap-3 lg:pl-8">
                  <SectionHeading icon={<FaUser size={14} />} title="Client Details" />
                  <div className="flex flex-col">
                    <InfoRow
                      label="Name"
                      value={[vp.firstName, vp.lastName].filter(Boolean).join(' ')}
                    />
                    <InfoRow label="Email" value={fmt(vp.email)} />
                    <InfoRow label="Phone" value={fmt(vp.phoneNumber)} />
                    <InfoRow label="DOB" value={vp.birthDate ? fmtDate(vp.birthDate) : '-'} />
                    <InfoRow label="Address" value={fmt(vp.address?.addressLine)} />
                    <InfoRow label="City" value={fmt(vp.address?.city)} />
                    <InfoRow label="State / Province" value={fmt(vp.address?.state)} />
                    <InfoRow label="ZIP" value={fmt(vp.address?.postalCode)} />
                  </div>

                  {/* Client alerts */}
                  {vpAlerts.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                        Alerts
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {vpAlerts.map((a) => (
                          <AlertChipView key={a.id} alert={a} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-card-border">
                <Secondary
                  href="#"
                  text="Close"
                  onClick={(e) => {
                    e?.preventDefault();
                    setShowModal(false);
                  }}
                />
              </div>
            </>
          )}

          {/* ══ CREATE / EDIT FORM ══════════════════════════════════════════════ */}
          {(mode === 'create' || mode === 'edit') && (
            <>
              {/* Edit mode: back-to-view button */}
              {mode === 'edit' && (
                <div className="flex items-center gap-2 pb-2 border-b border-card-border">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('view');
                      setCompanionErrors({});
                      setParentErrors({});
                    }}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← Back to details
                  </button>
                </div>
              )}

              {/* Two-column form grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 lg:items-stretch">
                {/* ══ LEFT: Patient ══════════════════════════════════ */}
                <div className="flex flex-col gap-3">
                  <SectionHeading icon={<MdPets size={16} />} title="Patient Details" />

                  {/* Name — with inline search dropdown when companions exist for selected parent */}
                  <InputWithDropdown
                    inname="companionName"
                    inlabel="Name"
                    value={companionFormData.name}
                    onChange={(v) => {
                      setCompanionFormData((prev) => ({ ...prev, name: v }));
                      setCompanionErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    onSelect={(opt) => handleCompanionSelect(opt.value)}
                    options={companionSearchOptions}
                    error={companionErrors.name}
                  />

                  {/* Species + Breed */}
                  <div className="grid grid-cols-2 gap-3">
                    <LabelDropdown
                      placeholder="Species"
                      onSelect={(option) => {
                        const sel = speciesOptions.find((s) => s.value === option.value);
                        setCompanionFormData((prev) => ({
                          ...prev,
                          type: (sel?.type ?? option.value) as CompanionType,
                          speciesCode: sel?.speciesCode ?? '',
                          breed: '',
                          breedCode: '',
                          bloodGroup: '',
                        }));
                      }}
                      defaultOption={companionFormData.type}
                      options={speciesOptions}
                      error={companionErrors.species}
                      portal
                    />
                    <LabelDropdown
                      placeholder="Breed"
                      onSelect={(option) => {
                        const sel = breedOptions.find((b) => b.value === option.value);
                        setCompanionFormData((prev) => ({
                          ...prev,
                          breed: option.value,
                          breedCode: sel?.breedCode ?? '',
                          speciesCode:
                            sel?.speciesCode ??
                            speciesOptions.find((s) => s.type === prev.type)?.speciesCode ??
                            prev.speciesCode,
                        }));
                      }}
                      defaultOption={companionFormData.breed}
                      options={breedOptions}
                      error={companionErrors.breed}
                      portal
                    />
                  </div>

                  {/* DOB + Sex — two per row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Datepicker
                      currentDate={companionDOB}
                      setCurrentDate={setCompanionDOB}
                      type="input"
                      className="min-h-12!"
                      containerClassName="w-full"
                      placeholder="DOB"
                      error={companionErrors.dateOfBirth}
                    />
                    <LabelDropdown
                      placeholder="Sex"
                      options={GENDER_NEUTER_OPTIONS}
                      defaultOption={genderNeuterValue}
                      onSelect={(option) => {
                        const found = GENDER_NEUTER_OPTIONS.find((o) => o.value === option.value);
                        if (found) {
                          setCompanionFormData((prev) => ({
                            ...prev,
                            gender: found.data.gender as Gender,
                            isneutered: found.data.neutered,
                            ageWhenNeutered: found.data.neutered ? prev.ageWhenNeutered : '',
                          }));
                        }
                      }}
                      portal
                    />
                  </div>

                  {/* Alerts */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-body-4 text-text-secondary">Alerts (optional)</span>

                    {/* Input row — grid: input takes remaining, dropdown fixed, button fixed */}
                    <fieldset
                      className="grid items-center gap-2"
                      style={{ gridTemplateColumns: '1fr 160px 48px' }}
                    >
                      <legend className="sr-only">Add alert</legend>
                      <FormInput
                        intype="text"
                        inname="alertLabel"
                        value={alertInput}
                        inlabel="e.g. Diabetic, May bite…"
                        onChange={(e) => setAlertInput(e.target.value)}
                        className="min-h-12!"
                      />
                      <LabelDropdown
                        placeholder="Priority"
                        options={ALERT_PRIORITY_OPTIONS}
                        defaultOption={alertPriority}
                        onSelect={(o) => setAlertPriority(o.value as AlertPriority)}
                        portal
                      />
                      <button
                        type="button"
                        aria-label="Add alert"
                        onClick={addAlert}
                        disabled={!alertInput.trim()}
                        className={clsx(
                          'flex items-center justify-center size-12 rounded-full border transition-colors',
                          alertInput.trim()
                            ? 'border-input-border-active text-text-brand hover:bg-neutral-50'
                            : 'border-card-border text-text-tertiary opacity-40 cursor-not-allowed'
                        )}
                      >
                        <FiPlus size={16} />
                      </button>
                    </fieldset>

                    {/* Added chips */}
                    {(companionFormData.alerts ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(companionFormData.alerts ?? []).map((a) => (
                          <AlertChipEdit key={a.id} alert={a} onRemove={removeAlert} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Optional fields accordion */}
                  <Accordion
                    title="Additional Details"
                    defaultOpen={false}
                    showEditIcon={false}
                    titleClassName="text-body-4"
                  >
                    <div className="flex flex-col gap-3 pt-3 pb-1">
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          intype="text"
                          inname="color"
                          value={companionFormData.colour || ''}
                          inlabel="Color (optional)"
                          onChange={(e) =>
                            setCompanionFormData((prev) => ({ ...prev, colour: e.target.value }))
                          }
                          className="min-h-12!"
                        />
                        <LabelDropdown
                          placeholder="Blood group"
                          onSelect={(o) =>
                            setCompanionFormData((prev) => ({ ...prev, bloodGroup: o.value }))
                          }
                          defaultOption={companionFormData.bloodGroup || ''}
                          options={BLOOD_GROUP_OPTIONS_BY_SPECIES[companionFormData.type] ?? []}
                          portal
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          intype="number"
                          inname="weight"
                          value={
                            companionFormData.currentWeight == null
                              ? ''
                              : String(companionFormData.currentWeight)
                          }
                          inlabel="Weight (lbs)"
                          onChange={(e) =>
                            setCompanionFormData((prev) => ({
                              ...prev,
                              currentWeight: toNonNegativeNumber(e.target.value),
                            }))
                          }
                          className="min-h-12!"
                        />
                        <LabelDropdown
                          placeholder="Country of origin"
                          onSelect={(o) =>
                            setCompanionFormData((prev) => ({ ...prev, countryOfOrigin: o.value }))
                          }
                          defaultOption={companionFormData.countryOfOrigin}
                          options={CountriesOptions}
                          portal
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          intype="text"
                          inname="microchip"
                          value={companionFormData.microchipNumber || ''}
                          inlabel="Microchip no."
                          onChange={(e) =>
                            setCompanionFormData((prev) => ({
                              ...prev,
                              microchipNumber: e.target.value,
                            }))
                          }
                          className="min-h-12!"
                        />
                        <FormInput
                          intype="text"
                          inname="passport"
                          value={companionFormData.passportNumber || ''}
                          inlabel="Passport no."
                          onChange={(e) =>
                            setCompanionFormData((prev) => ({
                              ...prev,
                              passportNumber: e.target.value.replaceAll(/[^0-9a-zA-Z-]/g, ''),
                            }))
                          }
                          className="min-h-12!"
                        />
                      </div>
                      <LabelDropdown
                        placeholder="Source"
                        options={OriginOptions}
                        defaultOption={companionFormData.source || 'unknown'}
                        onSelect={(o) =>
                          setCompanionFormData((prev) => ({
                            ...prev,
                            source: o.value as SourceType,
                          }))
                        }
                        portal
                      />
                      <LabelDropdown
                        placeholder="Insurance"
                        options={InsuredOptions}
                        defaultOption={companionFormData.isInsured ? 'true' : 'false'}
                        onSelect={(o) =>
                          setCompanionFormData((prev) => ({
                            ...prev,
                            isInsured: o.value === 'true',
                            insurance: o.value === 'true' ? { isInsured: true } : undefined,
                          }))
                        }
                        portal
                      />
                      {companionFormData.isInsured && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormInput
                            intype="text"
                            inname="insuranceCompany"
                            value={companionFormData.insurance?.companyName || ''}
                            inlabel="Company name"
                            onChange={(e) =>
                              setCompanionFormData((prev) => ({
                                ...prev,
                                insurance: {
                                  ...prev.insurance,
                                  isInsured: true,
                                  companyName: e.target.value,
                                },
                              }))
                            }
                            error={companionErrors.insuranceCompany}
                            className="min-h-12!"
                          />
                          <FormInput
                            intype="text"
                            inname="insurancePolicy"
                            value={companionFormData.insurance?.policyNumber || ''}
                            inlabel="Policy number"
                            onChange={(e) =>
                              setCompanionFormData((prev) => ({
                                ...prev,
                                insurance: {
                                  ...prev.insurance,
                                  isInsured: true,
                                  policyNumber: e.target.value,
                                },
                              }))
                            }
                            error={companionErrors.insuranceNumber}
                            className="min-h-12!"
                          />
                        </div>
                      )}
                      <FormDesc
                        intype="text"
                        inname="allergies"
                        value={companionFormData.allergy || ''}
                        inlabel="Allergies"
                        onChange={(e) =>
                          setCompanionFormData((prev) => ({ ...prev, allergy: e.target.value }))
                        }
                        className="min-h-22.5!"
                      />
                    </div>
                  </Accordion>
                </div>

                {/* ══ RIGHT: Client ══════════════════════════════════ */}
                <div className="flex flex-col gap-3 lg:pl-8">
                  <SectionHeading icon={<FaUser size={14} />} title="Client Details" />

                  {/* Name fields — First name drives the client search dropdown */}
                  <div className="grid grid-cols-2 gap-3">
                    <InputWithDropdown
                      inname="firstName"
                      inlabel="First name"
                      value={parentFormData.firstName}
                      onChange={(v) => {
                        setParentFormData((prev) => ({ ...prev, firstName: v }));
                        setParentErrors((prev) => ({ ...prev, firstName: undefined }));
                        setParentSearchQuery(
                          [v, parentFormData.lastName].filter(Boolean).join(' ')
                        );
                      }}
                      onSelect={(opt) => handleParentSelect(opt.value)}
                      options={parentSearchOptions}
                      error={parentErrors.firstName}
                    />
                    <FormInput
                      intype="text"
                      inname="lastName"
                      value={parentFormData.lastName ?? ''}
                      inlabel="Last name"
                      onChange={(e) => {
                        setParentFormData((prev) => ({ ...prev, lastName: e.target.value }));
                        setParentErrors((prev) => ({ ...prev, lastName: undefined }));
                      }}
                      error={parentErrors.lastName}
                      className="min-h-12!"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormInput
                      intype="email"
                      inname="email"
                      value={parentFormData.email}
                      inlabel="Email"
                      onChange={(e) => {
                        setParentFormData((prev) => ({ ...prev, email: e.target.value }));
                        setParentErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      error={parentErrors.email}
                      className="min-h-12!"
                    />
                    <div className="flex items-start gap-1.5">
                      <Datepicker
                        currentDate={parentDOB}
                        setCurrentDate={setParentDOB}
                        type="input"
                        className="min-h-12!"
                        containerClassName="w-full"
                        placeholder="DOB"
                        error={parentErrors.dateOfBirth}
                      />
                      <GlassTooltip
                        content="Date of birth may be required in some countries for age verification and legal consent."
                        side="bottom"
                        maxWidth={360}
                      >
                        <button
                          type="button"
                          aria-label="Date of birth information"
                          className="mt-3 inline-flex size-5 shrink-0 items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <IoInformationCircleOutline size={18} />
                        </button>
                      </GlassTooltip>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                      <LabelDropdown
                        placeholder="Country code"
                        onSelect={(o) => handleCountryCodeSelect(o.value)}
                        defaultOption={selectedCountryCode.value}
                        options={CountryDialCodeOptions}
                        error={parentErrors.countryCode}
                        portal
                      />
                    </div>
                    <div className="col-span-7">
                      <FormInput
                        intype="text"
                        inname="number"
                        value={localPhoneNumber || ''}
                        inlabel="Phone number"
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        error={parentErrors.phoneNumber}
                        className="min-h-12!"
                      />
                    </div>
                  </div>

                  <GoogleSearchDropDown
                    intype="text"
                    inname="address line"
                    value={parentFormData.address.addressLine || ''}
                    inlabel="Address"
                    onChange={(e) => updateAddressField('addressLine', e.target.value)}
                    error={parentErrors.addressLine}
                    onAddressSelect={handleAddressSelect}
                    onlyAddress={true}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormInput
                      intype="text"
                      inname="city"
                      value={parentFormData.address.city || ''}
                      inlabel="City"
                      onChange={(e) => updateAddressField('city', e.target.value)}
                      error={parentErrors.city}
                      className="min-h-12!"
                    />
                    <FormInput
                      intype="text"
                      inname="state"
                      value={parentFormData.address.state || ''}
                      inlabel="State / Province"
                      onChange={(e) => updateAddressField('state', e.target.value)}
                      error={parentErrors.state}
                      className="min-h-12!"
                    />
                  </div>

                  <FormInput
                    intype="text"
                    inname="postal code"
                    value={parentFormData.address.postalCode || ''}
                    inlabel="ZIP"
                    onChange={(e) => updateAddressField('postalCode', e.target.value)}
                    error={parentErrors.postalCode}
                    className="min-h-12!"
                  />

                  {/* Client alerts */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-body-4 text-text-secondary">Alerts (optional)</span>
                    <fieldset
                      className="grid items-center gap-2"
                      style={{ gridTemplateColumns: '1fr 160px 48px' }}
                    >
                      <legend className="sr-only">Add client alert</legend>
                      <FormInput
                        intype="text"
                        inname="clientAlertLabel"
                        value={clientAlertInput}
                        inlabel="e.g. Outstanding balance, VIP…"
                        onChange={(e) => setClientAlertInput(e.target.value)}
                        className="min-h-12!"
                      />
                      <LabelDropdown
                        placeholder="Priority"
                        options={ALERT_PRIORITY_OPTIONS}
                        defaultOption={clientAlertPriority}
                        onSelect={(o) => setClientAlertPriority(o.value as AlertPriority)}
                        portal
                      />
                      <button
                        type="button"
                        aria-label="Add client alert"
                        onClick={addClientAlert}
                        disabled={!clientAlertInput.trim()}
                        className={clsx(
                          'flex items-center justify-center size-12 rounded-full border transition-colors',
                          clientAlertInput.trim()
                            ? 'border-input-border-active text-text-brand hover:bg-neutral-50'
                            : 'border-card-border text-text-tertiary opacity-40 cursor-not-allowed'
                        )}
                      >
                        <FiPlus size={16} />
                      </button>
                    </fieldset>
                    {clientAlerts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {clientAlerts.map((a) => (
                          <AlertChipEdit key={a.id} alert={a} onRemove={removeClientAlert} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-card-border">
                <FooterLeft
                  mode={mode}
                  onGoToAppointment={onGoToAppointment}
                  hasUnsavedChanges={hasUnsavedChanges}
                  pendingGoToAppointmentRef={pendingGoToAppointmentRef}
                  setShowDiscardConfirm={setShowDiscardConfirm}
                  setMode={setMode}
                  setCompanionErrors={setCompanionErrors}
                  setParentErrors={setParentErrors}
                />
                <Primary
                  type="button"
                  text={mode === 'edit' ? 'Save changes' : 'Save Patient Info'}
                  icon={<FiCheck size={15} />}
                  onClick={handleSubmit}
                />
              </div>
            </>
          )}
        </div>
      </AppointmentCentralModalShell>

      {/* Discard changes confirmation */}
      <CenterModal
        showModal={showDiscardConfirm}
        setShowModal={setShowDiscardConfirm}
        containerClassName="shadow-[0_0_40px_0_rgba(0,0,0,0.20)]!"
      >
        <div className="flex flex-col gap-4 p-2">
          <h3
            style={{
              fontFamily: 'var(--font-satoshi), sans-serif',
              fontSize: 18,
              fontWeight: 500,
              lineHeight: '120%',
            }}
          >
            Discard changes?
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-satoshi), sans-serif',
              fontSize: 14,
              fontWeight: 400,
              lineHeight: '120%',
            }}
          >
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                pendingGoToAppointmentRef.current = false;
                setShowDiscardConfirm(false);
              }}
              className="rounded-2xl border border-input-border-default px-5 py-2.5 hover:bg-card-hover active:bg-card-hover/80 transition-colors"
              style={{
                fontFamily: 'var(--font-satoshi), sans-serif',
                fontSize: 14,
                fontWeight: 500,
                lineHeight: '120%',
              }}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={handleDiscardAndClose}
              className="yc-primary-button rounded-2xl! px-4 py-[11px] font-satoshi text-base font-medium leading-[1.5rem] text-white!"
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

export default AddCompanionCentralModal;
