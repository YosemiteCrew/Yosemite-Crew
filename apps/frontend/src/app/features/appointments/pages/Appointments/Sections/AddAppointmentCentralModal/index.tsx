'use client';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import '@/app/ui/primitives/Buttons/ButtonEffects.css';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { getUtcTimeValue } from '@/app/lib/date';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';
import BottomSheet from '@/app/ui/layout/PhoneShell/BottomSheet';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import AddCompanionCentralModal from '@/app/features/companions/components/AddCompanionCentralModal';
import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';
import { hasUnsavedCentralChanges } from '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils';
import { buildBookButtonLabel } from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal/bookButtonLabel';
import { Primary } from '@/app/ui/primitives/Buttons';
import type { AppointmentKind } from '@yosemite-crew/types';
import {
  AppointmentFormContent,
  DiscardConfirmationModal,
  type AppointmentFormContentProps,
} from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal/appointmentFormParts';

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

const visitTypeToAppointmentKind = (visitType: string): AppointmentKind =>
  visitType === 'Inpatient' ? 'INPATIENT' : 'OUTPATIENT';

const appointmentKindToVisitType = (appointmentKind?: AppointmentKind): string =>
  appointmentKind === 'INPATIENT' ? 'Inpatient' : 'Outpatient';

const getDropdownValue = (option: string | { value: string }): string =>
  typeof option === 'string' ? option : option.value;

const getNoSlotsMessage = (hasService: boolean, hasSpeciality: boolean): string => {
  if (hasService) return 'No slots available for this date';
  if (hasSpeciality) return 'Select a service first';
  return 'Select a speciality and service first';
};

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
  const isPhone = useIsPhone();
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
  const [prevPrefillKey, setPrevPrefillKey] = useState<string | null>(null);
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
  if (prefillKey !== prevPrefillKey) {
    setPrevPrefillKey(prefillKey);
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
  // This guard used to run in the render body, writing autoSelectKeyRef there. It is the same
  // "apply once per key change" check, moved out of render; useLayoutEffect (not useEffect) keeps it
  // before paint, so the patient field is never painted empty on a mount that already has a key.
  useLayoutEffect(() => {
    if (autoSelectKey === autoSelectKeyRef.current) return;
    autoSelectKeyRef.current = autoSelectKey;
    applyAutoSelectKey(autoSelectKey);
  });

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

  // Same clock as the slot list above it. This used formatTimeLabel (hour:'2-digit'), so a
  // prefilled 8am appointment read "08:00 AM" here while the slot buttons said "8:00 AM".
  const prefillTimeLabel = useMemo(
    () =>
      prefillActive && !selectedSlot && formData.startTime
        ? formatUtcTimeToLocalLabel(getUtcTimeValue(formData.startTime, ''))
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
    // Prefer the selected service's configured duration over a possibly-stale slot
    // duration so switching service/speciality updates the badge immediately.
    // Display-only: booking still requires a real slot (durationMinutes validation).
    const serviceMins = Number(ServiceInfoData?.duration);
    if (Number.isFinite(serviceMins) && serviceMins > 0) return `${serviceMins} mins`;
    if (formData.durationMinutes) return `${formData.durationMinutes} mins`;
    return null;
  }, [selectedSlot, formData.durationMinutes, ServiceInfoData?.duration]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hasService = Boolean(formData.appointmentType?.id);
  const hasSpeciality = Boolean(formData.appointmentType?.speciality?.id);
  const noSlotsMessage = getNoSlotsMessage(hasService, hasSpeciality);
  const patientLabel = terminologyText('Patient');

  const formContentProps: AppointmentFormContentProps = {
    patientLabel,
    selectedPatientName,
    selectedPatientPhoto,
    patientQuery: uiState.patientQuery,
    setPatientQuery: (value) => dispatchUi({ type: 'setPatientQuery', value }),
    patientOptions,
    handlePatientSelect,
    handlePatientClear,
    selectedClientName,
    clientQuery: uiState.clientQuery,
    setClientQuery: (value) => dispatchUi({ type: 'setClientQuery', value }),
    clientOptions,
    handleClientSelect,
    handleClientClear,
    setAddCompanionTarget: (target) => dispatchUi({ type: 'setAddCompanionTarget', value: target }),
    selectedDate,
    handleDateChange,
    today,
    timeSlots,
    selectedSlot,
    onSlotSelect: (slot) => {
      dispatchUi({ type: 'dismissPrefill' });
      setSelectedSlot(slot);
    },
    formState: {
      loadingTimeSlots: uiState.isLoadingTimeSlots,
      loadingSlotScopedOptions: isLoadingSlotScopedOptions,
      serviceSelected: hasService,
      submitted: uiState.submitAttempted,
      loading: isLoading,
    },
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
    showError: (field) => showError(field as keyof typeof formDataErrors),
    handleSubmit,
    onCancel: handleCancel,
  };

  return (
    <>
      {isPhone ? (
        <BottomSheet
          open={showModal}
          title="New appointment"
          onClose={handleCancel}
          className="yc-appointment-sheet"
          footer={
            <Primary
              text={buildBookButtonLabel(selectedClientName)}
              onClick={handleSubmit}
              isDisabled={isLoading}
              size="large"
              style={{ minHeight: 48, fontSize: 14, fontWeight: 700 }}
            />
          }
        >
          <AppointmentFormContent {...formContentProps} variant="sheet" />
        </BottomSheet>
      ) : (
        <AppointmentCentralModalShell
          showModal={showModal}
          setShowModal={setShowModal}
          title="New appointment"
          canClose={canCloseModal}
          isLoading={isLoading}
        >
          <AppointmentFormContent {...formContentProps} />
        </AppointmentCentralModalShell>
      )}

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
