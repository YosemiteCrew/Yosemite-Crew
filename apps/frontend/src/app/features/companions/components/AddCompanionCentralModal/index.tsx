'use client';
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import BottomSheet from '@/app/ui/layout/PhoneShell/BottomSheet';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
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
} from '@/app/features/companions/components/AddCompanion/type';
import { normalizeEmail, toTitleCase } from '@/app/lib/validators';
import { RecordStatus } from '@yosemite-crew/types';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildCompanionOverviewHref } from '@/app/lib/companionHistoryRoute';
import { getCompanionStatusStyle } from '@/app/ui/tables/tableUtils';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import {
  SpeciesOption,
  BreedOption,
  DEFAULT_SPECIES_OPTIONS,
  SPECIES_LABEL,
  getGenderNeuterValue,
  MAX_LOCAL_PHONE_LENGTH,
  buildFullName,
  loadBreedOptions,
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
  isCompanionModalBusy,
  getCompanionModalLoadingLabel,
} from './addCompanionCentralModalHelpers';
import AddCompanionViewMode from './AddCompanionViewMode';
import AddCompanionFormMode from './AddCompanionFormMode';
import { AddCompanionWizardFooter } from './AddCompanionPresentational';

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

type AddCompanionModalState = {
  mode: ModalMode;
  /** Create-flow wizard step: 1 = patient details, 2 = parent details. */
  formStep: 1 | 2;
  isSubmitting: boolean;
  savingStatus: boolean;
  pendingStatus: RecordStatus | null;
  showDiscardConfirm: boolean;
  parentFormData: StoredParent;
  parentErrors: Partial<Record<string, string>>;
  parentDOB: Date | null;
  parentResults: StoredParent[];
  selectedCountryCode: CountryDialCodeOption;
  localPhoneNumber: string;
  companionFormData: ExtCompanionForValidation;
  companionErrors: Partial<Record<string, string>>;
  companionDOB: Date | null;
  speciesOptions: SpeciesOption[];
  breedOptions: BreedOption[];
  alertInput: string;
  alertPriority: AlertPriority;
  clientAlertInput: string;
  clientAlertPriority: AlertPriority;
  clientAlerts: CompanionAlert[];
};

type AddCompanionModalAction =
  | {
      type: 'set';
      field: keyof AddCompanionModalState;
      value: unknown;
    }
  | {
      type: 'reset';
      initialMode: ModalMode;
      selectedCountryCode: CountryDialCodeOption;
    };

const createInitialModalState = (
  mode: ModalMode,
  selectedCountryCode: CountryDialCodeOption
): AddCompanionModalState => ({
  mode,
  formStep: 1,
  isSubmitting: false,
  savingStatus: false,
  pendingStatus: null,
  showDiscardConfirm: false,
  parentFormData: EMPTY_STORED_PARENT,
  parentErrors: {},
  parentDOB: null,
  parentResults: [],
  selectedCountryCode,
  localPhoneNumber: '',
  companionFormData: EMPTY_STORED_COMPANION,
  companionErrors: {},
  companionDOB: null,
  speciesOptions: DEFAULT_SPECIES_OPTIONS,
  breedOptions: [],
  alertInput: '',
  alertPriority: 'medium',
  clientAlertInput: '',
  clientAlertPriority: 'medium',
  clientAlerts: [],
});

const resolveModalStateValue = <T,>(currentValue: T, nextValue: unknown): T => {
  if (typeof nextValue === 'function') {
    return (nextValue as (previous: T) => T)(currentValue);
  }
  return nextValue as T;
};

const addCompanionModalReducer = (
  state: AddCompanionModalState,
  action: AddCompanionModalAction
): AddCompanionModalState => {
  if (action.type === 'reset') {
    return createInitialModalState(action.initialMode, action.selectedCountryCode);
  }

  return {
    ...state,
    [action.field]: resolveModalStateValue(state[action.field], action.value),
  };
};

const useAddCompanionCentralModalContent = ({
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
  const isPhone = useIsPhone();
  const router = useRouter();
  const notifyHook = useNotify();

  // ── Derived initial mode ──
  const initialMode: ModalMode = viewCompanion ? 'view' : 'create';

  // ── Parent form state ──
  const parentSearchQueryRef = useRef('');
  const parentSearchTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const parentSelectionRef = useRef(false);
  const defaultPhoneData = useMemo(() => findPhoneData('', ''), []);
  const [modalState, dispatchModalState] = useReducer(
    addCompanionModalReducer,
    createInitialModalState(initialMode, defaultPhoneData.selectedCode)
  );
  const {
    mode,
    formStep,
    isSubmitting,
    savingStatus,
    pendingStatus,
    showDiscardConfirm,
    parentFormData,
    parentErrors,
    parentDOB,
    parentResults,
    selectedCountryCode,
    localPhoneNumber,
    companionFormData,
    companionErrors,
    companionDOB,
    speciesOptions,
    breedOptions,
    alertInput,
    alertPriority,
    clientAlertInput,
    clientAlertPriority,
    clientAlerts,
  } = modalState;
  const setModalField = useCallback(
    <Field extends keyof AddCompanionModalState>(
      field: Field,
      value: React.SetStateAction<AddCompanionModalState[Field]>
    ) => {
      dispatchModalState({ type: 'set', field, value });
    },
    []
  );
  const setMode = useCallback(
    (value: React.SetStateAction<ModalMode>) => setModalField('mode', value),
    [setModalField]
  );
  const setFormStep = useCallback(
    (value: React.SetStateAction<1 | 2>) => setModalField('formStep', value),
    [setModalField]
  );
  const setIsSubmitting = useCallback(
    (value: React.SetStateAction<boolean>) => setModalField('isSubmitting', value),
    [setModalField]
  );
  const setSavingStatus = useCallback(
    (value: React.SetStateAction<boolean>) => setModalField('savingStatus', value),
    [setModalField]
  );
  const setPendingStatus = useCallback(
    (value: React.SetStateAction<RecordStatus | null>) => setModalField('pendingStatus', value),
    [setModalField]
  );
  const setShowDiscardConfirm = useCallback(
    (value: React.SetStateAction<boolean>) => setModalField('showDiscardConfirm', value),
    [setModalField]
  );
  const setParentFormData = useCallback(
    (value: React.SetStateAction<StoredParent>) => setModalField('parentFormData', value),
    [setModalField]
  );
  const setParentErrors = useCallback(
    (value: React.SetStateAction<Partial<Record<string, string>>>) =>
      setModalField('parentErrors', value),
    [setModalField]
  );
  const setParentDOB = useCallback(
    (value: React.SetStateAction<Date | null>) => setModalField('parentDOB', value),
    [setModalField]
  );
  const setParentResults = useCallback(
    (value: React.SetStateAction<StoredParent[]>) => setModalField('parentResults', value),
    [setModalField]
  );
  const setSelectedCountryCode = useCallback(
    (value: React.SetStateAction<CountryDialCodeOption>) =>
      setModalField('selectedCountryCode', value),
    [setModalField]
  );
  const setLocalPhoneNumber = useCallback(
    (value: React.SetStateAction<string>) => setModalField('localPhoneNumber', value),
    [setModalField]
  );
  const setCompanionFormData = useCallback(
    (value: React.SetStateAction<ExtCompanionForValidation>) =>
      setModalField('companionFormData', value),
    [setModalField]
  );
  const setCompanionErrors = useCallback(
    (value: React.SetStateAction<Partial<Record<string, string>>>) =>
      setModalField('companionErrors', value),
    [setModalField]
  );
  const setCompanionDOB = useCallback(
    (value: React.SetStateAction<Date | null>) => setModalField('companionDOB', value),
    [setModalField]
  );
  const setSpeciesOptions = useCallback(
    (value: React.SetStateAction<SpeciesOption[]>) => setModalField('speciesOptions', value),
    [setModalField]
  );
  const setBreedOptions = useCallback(
    (value: React.SetStateAction<BreedOption[]>) => setModalField('breedOptions', value),
    [setModalField]
  );
  const setAlertInput = useCallback(
    (value: React.SetStateAction<string>) => setModalField('alertInput', value),
    [setModalField]
  );
  const setAlertPriority = useCallback(
    (value: React.SetStateAction<AlertPriority>) => setModalField('alertPriority', value),
    [setModalField]
  );
  const setClientAlertInput = useCallback(
    (value: React.SetStateAction<string>) => setModalField('clientAlertInput', value),
    [setModalField]
  );
  const setClientAlertPriority = useCallback(
    (value: React.SetStateAction<AlertPriority>) => setModalField('clientAlertPriority', value),
    [setModalField]
  );
  const setClientAlerts = useCallback(
    (value: React.SetStateAction<CompanionAlert[]>) => setModalField('clientAlerts', value),
    [setModalField]
  );
  // When "← Go to Appointment" is clicked with dirty data, we show the discard confirm and then
  // navigate back rather than closing the whole modal.
  const pendingGoToAppointmentRef = useRef(false);
  const dialCodeByOptionValue = useMemo(
    () => new Map(CountryDialCodeOptions.map((o) => [o.value, o])),
    []
  );

  // ── All companions from store — used for name-based search in patient field ──
  const allCompanionParents = useCompanionsParentsForPrimaryOrg();

  // ── Edit-mode dirty tracking — snapshot of field values at the moment edit starts ──
  const editSnapshotRef = useRef<EditSnapshot | null>(null);

  const companionResultsRef = useRef<StoredCompanion[]>([]);

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
    [clearParentSearchTimeout, setParentResults]
  );

  // ── Reset on close ──
  const resetAll = useCallback(() => {
    parentSearchQueryRef.current = '';
    clearParentSearchTimeout();
    companionResultsRef.current = [];
    dispatchModalState({
      type: 'reset',
      initialMode,
      selectedCountryCode: defaultPhoneData.selectedCode,
    });
  }, [clearParentSearchTimeout, defaultPhoneData.selectedCode, initialMode]);

  const populateEditForm = useCallback(
    (source: CompanionParent) => {
      const c = source.companion;
      const p = source.parent;
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
    },
    [
      setCompanionFormData,
      setCompanionDOB,
      setParentFormData,
      setClientAlerts,
      setParentDOB,
      setSelectedCountryCode,
      setLocalPhoneNumber,
    ]
  );

  const syncModalOpenState = () => {
    if (!showModal) resetAll();
    if (mode !== initialMode) setMode(initialMode);
    if (pendingStatus !== null) setPendingStatus(null);
  };
  const syncEditForm = () => {
    if (mode === 'edit' && viewCompanion) {
      populateEditForm(viewCompanion);
    } else if (mode !== 'edit') {
      editSnapshotRef.current = null;
    }
  };
  const modalSyncRef = useRef<ModalSyncState>({ initialMode, showModal });
  if (
    modalSyncRef.current.initialMode !== initialMode ||
    modalSyncRef.current.showModal !== showModal
  ) {
    modalSyncRef.current = { initialMode, showModal };
    syncModalOpenState();
  }

  // ── Populate edit form from viewCompanion ──
  const prevEditSyncRef = useRef({ mode, viewCompanion });
  if (
    prevEditSyncRef.current.mode !== mode ||
    prevEditSyncRef.current.viewCompanion !== viewCompanion
  ) {
    prevEditSyncRef.current = { mode, viewCompanion };
    syncEditForm();
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
  const handleParentDOBChange = useCallback(
    (date: Date | null) => {
      setParentDOB(date);
      setParentFormData((prev) => ({ ...prev, birthDate: date ?? undefined }));
    },
    [setParentDOB, setParentFormData]
  );

  const handleCompanionDOBChange = useCallback(
    (date: Date | null) => {
      setCompanionDOB(date);
      setCompanionFormData((prev) => ({ ...prev, dateOfBirth: date ?? new Date() }));
    },
    [setCompanionDOB, setCompanionFormData]
  );

  // ── Photo dropzone (design add flow) — store the chosen image as a data URL. ──
  const handlePhotoSelected = useCallback(
    (dataUrl: string) => {
      setCompanionFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
    },
    [setCompanionFormData]
  );

  // ── Sex radios + Neutered checkbox (design add flow) ──
  const handleSexChange = useCallback(
    (gender: string, neutered: boolean) => {
      setCompanionFormData((prev) => ({
        ...prev,
        gender: gender as ExtCompanionForValidation['gender'],
        isneutered: neutered,
        ageWhenNeutered: neutered ? prev.ageWhenNeutered : '',
      }));
    },
    [setCompanionFormData]
  );

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
  }, [setSpeciesOptions]);

  // ── Breed codes ──
  useEffect(() => {
    const signal = { cancelled: false };
    loadBreedOptions(speciesOptions, companionFormData.type, setBreedOptions, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [companionFormData.type, setBreedOptions, speciesOptions]);

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

  // ── Step navigation (create wizard) ──
  const advanceToParentStep = () => setFormStep(2);
  const backToPatientStep = () => setFormStep(1);

  // ── Submit (create / edit save) ──
  const handleSubmit = async () => {
    // Validate both steps so each step's error state is populated. On the create
    // wizard, an invalid patient step sends the user back to step 1 to see those
    // errors; an invalid parent step keeps them on step 2.
    const companionOk = validateCompanion();
    const parentOk = validateParent();
    if (mode === 'create') {
      if (!companionOk) {
        setFormStep(1);
        return;
      }
      if (!parentOk) return;
    } else if (!companionOk || !parentOk) {
      return;
    }
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
  }, [isSubmitting, savingStatus, hasUnsavedChanges, setShowDiscardConfirm]);

  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardConfirm(false);
    if (pendingGoToAppointmentRef.current) {
      pendingGoToAppointmentRef.current = false;
      onGoToAppointment?.();
    } else {
      setShowModal(false);
    }
  }, [setShowModal, onGoToAppointment, setShowDiscardConfirm]);

  const isCreate = mode === 'create';
  // Create phone renders as a bottom sheet (design add flow); edit/view keep the
  // centered modal at every width.
  const formVariant: 'modal' | 'sheet' = isCreate && isPhone ? 'sheet' : 'modal';
  const attemptClose = () => {
    if (canCloseModal()) setShowModal(false);
  };

  const formModeEl =
    mode === 'create' || mode === 'edit' ? (
      <AddCompanionFormMode
        alertInput={alertInput}
        alertPriority={alertPriority}
        breedOptions={breedOptions}
        clientAlertInput={clientAlertInput}
        clientAlertPriority={clientAlertPriority}
        clientAlerts={clientAlerts}
        companionDOB={companionDOB}
        companionErrors={companionErrors}
        companionFormData={companionFormData}
        companionSearchOptions={companionSearchOptions}
        formStep={formStep}
        genderNeuterValue={genderNeuterValue}
        hasUnsavedChanges={hasUnsavedChanges}
        localPhoneNumber={localPhoneNumber}
        mode={mode}
        onAddAlert={addAlert}
        onAddClientAlert={addClientAlert}
        onAddressSelect={handleAddressSelect}
        onCompanionDOBChange={
          handleCompanionDOBChange as React.Dispatch<React.SetStateAction<Date | null>>
        }
        onCompanionSelect={handleCompanionSelect}
        onCountryCodeSelect={handleCountryCodeSelect}
        onGoToAppointment={onGoToAppointment}
        onParentDOBChange={
          handleParentDOBChange as React.Dispatch<React.SetStateAction<Date | null>>
        }
        onParentSelect={handleParentSelect}
        onPhoneChange={handlePhoneChange}
        onPhotoSelected={handlePhotoSelected}
        onRemoveAlert={removeAlert}
        onRemoveClientAlert={removeClientAlert}
        onSexChange={handleSexChange}
        onSubmit={handleSubmit}
        onUpdateAddressField={updateAddressField}
        parentDOB={parentDOB}
        parentErrors={parentErrors}
        parentFormData={parentFormData}
        parentSearchOptions={parentSearchOptions}
        pendingGoToAppointmentRef={pendingGoToAppointmentRef}
        scheduleParentSearch={scheduleParentSearch}
        selectedCountryCode={selectedCountryCode}
        setAlertInput={setAlertInput}
        setAlertPriority={setAlertPriority}
        setClientAlertInput={setClientAlertInput}
        setClientAlertPriority={setClientAlertPriority}
        setCompanionErrors={setCompanionErrors}
        setCompanionFormData={setCompanionFormData}
        setMode={setMode}
        setParentErrors={setParentErrors}
        setParentFormData={setParentFormData}
        setShowDiscardConfirm={setShowDiscardConfirm}
        speciesOptions={speciesOptions}
        terminologyText={terminologyText}
        variant={formVariant}
      />
    ) : null;

  const renderWizardFooter = (variant: 'modal' | 'sheet') => (
    <AddCompanionWizardFooter
      step={formStep}
      variant={variant}
      onAdvance={advanceToParentStep}
      onBack={backToPatientStep}
      onCancel={attemptClose}
      onSubmit={handleSubmit}
      onGoToAppointment={onGoToAppointment}
      hasUnsavedChanges={hasUnsavedChanges}
      pendingGoToAppointmentRef={pendingGoToAppointmentRef}
      setShowDiscardConfirm={setShowDiscardConfirm}
    />
  );

  const discardConfirm = (
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
            className="yc-primary-button rounded-2xl! px-4 py-[11px] font-satoshi text-base font-medium leading-[1.5rem]"
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

  // ── Phone add-companion: a bottom sheet with the wizard + a sticky step footer.
  if (isCreate && isPhone) {
    return (
      <>
        <BottomSheet
          open={showModal}
          title={modalTitle}
          onClose={attemptClose}
          className="yc-add-companion-sheet"
          footer={renderWizardFooter('sheet')}
        >
          <div className="flex flex-col gap-6">{formModeEl}</div>
        </BottomSheet>
        {discardConfirm}
      </>
    );
  }

  // ── Desktop / tablet, and all view/edit: the centered modal shell.
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
          {mode === 'view' && vc && vp && (
            <AddCompanionViewMode
              canEditCompanionStatus={canEditCompanionStatus}
              companion={vc}
              companionAlerts={vcAlerts}
              companionTitle={companionTitle}
              displayStatus={displayStatus}
              parent={vp}
              parentAlerts={vpAlerts}
              savingStatus={savingStatus}
              speciesLabel={speciesLabel}
              statusStyle={statusStyle}
              terminologyText={terminologyText}
              onClose={() => setShowModal(false)}
              onEdit={setMode}
              onOpenOverview={() => {
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
              onStatusChange={(status) => {
                Promise.resolve(handleStatusChange(status)).catch(() => undefined);
              }}
            />
          )}

          {formModeEl}

          {isCreate && renderWizardFooter('modal')}
        </div>
      </AppointmentCentralModalShell>

      {discardConfirm}
    </>
  );
};

const AddCompanionCentralModal = (props: AddCompanionCentralModalProps) =>
  useAddCompanionCentralModalContent(props);

export default AddCompanionCentralModal;
