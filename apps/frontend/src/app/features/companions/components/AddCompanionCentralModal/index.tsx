'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoPencilOutline, IoInformationCircleOutline } from 'react-icons/io5';
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
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import {
  getCompanionForParent,
  updateCompanion,
  updateParent,
} from '@/app/features/companions/services/companionService';
import { fetchSpeciesCodeEntries } from '@/app/features/companions/services/codeEntriesService';
import {
  StoredCompanion,
  StoredParent,
  CompanionParent,
} from '@/app/features/companions/pages/Companions/types';
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  CompanionAlert,
  fromStoredCompanionAlerts,
  toStoredCompanionAlerts,
  AlertPriority,
  CountryDialCodeOptions,
  CountryDialCodeOption,
  findPhoneData,
  getDigitsOnly,
  InsuredOptions,
  CountriesOptions,
  OriginOptions,
} from '@/app/features/companions/components/AddCompanion/type';
import { normalizeEmail, toTitleCase } from '@/app/lib/validators';
import { CompanionType, Gender, RecordStatus, SourceType } from '@yosemite-crew/types';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { getCompanionStatusStyle } from '@/app/ui/tables/tableUtils';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import clsx from 'clsx';
import {
  SpeciesOption,
  BreedOption,
  DEFAULT_SPECIES_OPTIONS,
  SPECIES_LABEL,
  BLOOD_GROUP_OPTIONS_BY_SPECIES,
  STATUS_OPTIONS,
  GENDER_NEUTER_OPTIONS,
  getGenderNeuterValue,
  toNonNegativeNumber,
  MAX_LOCAL_PHONE_LENGTH,
  ALERT_PRIORITY_OPTIONS,
  buildFullName,
  loadBreedOptions,
  fmtDate,
  fmtAge,
  fmt,
  ModalMode,
  ExtCompanionForValidation,
  validateParentFields,
  validateCompanionFields,
  EditSnapshot,
  EMPTY_SNAPSHOT,
  ModalSyncState,
  computeHasUnsavedChanges,
  fetchParentResults,
  createCompanionFlow,
  getModalTitle,
  getSexLabel,
  isCompanionModalBusy,
  getCompanionModalLoadingLabel,
} from './addCompanionCentralModalHelpers';
import {
  SectionHeading,
  InfoRow,
  AlertChipView,
  AlertChipEdit,
  FooterLeft,
} from './AddCompanionPresentational';
import InputWithDropdown from './InputWithDropdown';

// ─── Props ────────────────────────────────────────────────────────────────────

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

const AddCompanionCentralModal = ({
  showModal,
  setShowModal,
  viewCompanion,
  canEditCompanionStatus = false,
  onCompanionCreated,
  formMode = 'default',
  onGoToAppointment,
}: AddCompanionCentralModalProps) => {
  const terminologyText = useCompanionTerminologyText();
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
  const parentSearchQueryRef = useRef('');
  const parentSearchTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
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
  const companionResultsRef = useRef<StoredCompanion[]>([]);

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

  const clearParentSearchTimeout = useCallback(() => {
    if (parentSearchTimeoutRef.current !== null) {
      globalThis.clearTimeout(parentSearchTimeoutRef.current);
      parentSearchTimeoutRef.current = null;
    }
  }, []);

  const scheduleParentSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      parentSearchQueryRef.current = query;
      clearParentSearchTimeout();
      if (!trimmed) {
        setParentResults([]);
        return;
      }
      if (parentSelectionRef.current) {
        parentSelectionRef.current = false;
        return;
      }
      parentSearchTimeoutRef.current = globalThis.setTimeout(() => {
        fetchParentResults(trimmed).then(setParentResults);
      }, 300);
    },
    [clearParentSearchTimeout]
  );

  // ── Reset on close ──
  const resetAll = useCallback(() => {
    setParentFormData(EMPTY_STORED_PARENT);
    setParentErrors({});
    setParentDOB(null);
    parentSearchQueryRef.current = '';
    clearParentSearchTimeout();
    setParentResults([]);
    setSelectedCountryCode(defaultPhoneData.selectedCode);
    setLocalPhoneNumber('');
    setCompanionFormData(EMPTY_STORED_COMPANION);
    setCompanionErrors({});
    setCompanionDOB(null);
    companionResultsRef.current = [];
    setAlertInput('');
    setAlertPriority('medium');
    setClientAlertInput('');
    setClientAlertPriority('medium');
    setClientAlerts([]);
  }, [clearParentSearchTimeout, defaultPhoneData.selectedCode]);

  const modalSyncRef = useRef<ModalSyncState>({ initialMode, showModal });
  if (
    modalSyncRef.current.initialMode !== initialMode ||
    modalSyncRef.current.showModal !== showModal
  ) {
    modalSyncRef.current = { initialMode, showModal };
    if (!showModal) {
      resetAll();
    }
    if (mode !== initialMode) {
      setMode(initialMode);
    }
    if (pendingStatus !== null) {
      setPendingStatus(null);
    }
  }

  // ── Populate edit form from viewCompanion ──
  const prevEditSyncRef = useRef({ mode, viewCompanion });
  if (
    prevEditSyncRef.current.mode !== mode ||
    prevEditSyncRef.current.viewCompanion !== viewCompanion
  ) {
    prevEditSyncRef.current = { mode, viewCompanion };
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
  }

  // ── Companion search — load all companions when a parent is selected ──
  useEffect(() => {
    const pid = parentFormData.id;
    if (!pid) {
      companionResultsRef.current = [];
      return;
    }
    let mounted = true;
    getCompanionForParent(pid)
      .then((c) => {
        if (mounted) companionResultsRef.current = c;
      })
      .catch(() => {
        if (mounted) companionResultsRef.current = [];
      });
    return () => {
      mounted = false;
    };
  }, [parentFormData.id]);

  // ── DOB picker handlers — update the picker's own Date state and mirror the
  // value into the persisted form object in the same event, instead of a
  // useEffect watching the picker state (avoids an extra render per change). ──
  const handleParentDOBChange = useCallback((date: Date | null) => {
    setParentDOB(date);
    setParentFormData((prev) => ({ ...prev, birthDate: date ?? undefined }));
  }, []);

  const handleCompanionDOBChange = useCallback((date: Date | null) => {
    setCompanionDOB(date);
    setCompanionFormData((prev) => ({ ...prev, dateOfBirth: date ?? new Date() }));
  }, []);

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
    parentSearchQueryRef.current = buildFullName(sel.firstName, sel.lastName);
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
      cp?.companion ?? companionResultsRef.current.find((c) => c.id === id);
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
      parentSearchQueryRef.current = buildFullName(p.firstName, p.lastName);
    }
    companionResultsRef.current = []; // clear so dropdown closes
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
        text: terminologyText(`Companion is now ${toTitleCase(newStatus)}.`),
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
      title: terminologyText('Companion updated'),
      text: terminologyText('Companion has been updated successfully.'),
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
        title: terminologyText('Companion saved'),
        text: terminologyText('Companion has been saved successfully.'),
      });
      if (createdCompanion) onCompanionCreated?.(createdCompanion.id);
      setShowModal(false);
    } catch {
      notifyHook.notify('error', {
        title: 'Unable to save',
        text: terminologyText('Failed to save companion. Please try again.'),
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
  const modalTitle = getModalTitle(mode, companionTitle, terminologyText);

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
        loadingLabel={terminologyText(getCompanionModalLoadingLabel(savingStatus))}
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
                  <SectionHeading
                    icon={<MdPets size={16} />}
                    title={terminologyText('Patient Details')}
                  />

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
                        <InfoRow label="Weight (kg)" value={fmt(vc.currentWeight)} />
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
                  <SectionHeading
                    icon={<MdPets size={16} />}
                    title={terminologyText('Patient Details')}
                  />

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
                      setCurrentDate={
                        handleCompanionDOBChange as React.Dispatch<
                          React.SetStateAction<Date | null>
                        >
                      }
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
                          inlabel="Weight (kg)"
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
                        scheduleParentSearch(
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
                        const nextLastName = e.target.value;
                        setParentFormData((prev) => ({ ...prev, lastName: nextLastName }));
                        setParentErrors((prev) => ({ ...prev, lastName: undefined }));
                        scheduleParentSearch(
                          [parentFormData.firstName, nextLastName].filter(Boolean).join(' ')
                        );
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
                        setCurrentDate={
                          handleParentDOBChange as React.Dispatch<React.SetStateAction<Date | null>>
                        }
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
