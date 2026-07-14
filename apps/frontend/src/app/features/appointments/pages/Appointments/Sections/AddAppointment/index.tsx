import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import AppointmentDetailsSection from '@/app/features/appointments/components/AppointmentDetailsSection';
import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';
import BillableServicesSection from '@/app/features/appointments/components/BillableServicesSection';
import EmergencyCheckbox from '@/app/features/appointments/components/EmergencyCheckbox';
import BookingErrorMessage from '@/app/features/appointments/components/BookingErrorMessage';
import AddCompanion from '@/app/features/companions/components/AddCompanion';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

type AddAppointmentProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveStatus: React.Dispatch<React.SetStateAction<string>>;
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
  prefill?: AppointmentDraftPrefill | null;
  onPrefillConsumed?: () => void;
};

export { EMPTY_APPOINTMENT } from '@/app/features/appointments/constants/emptyAppointment';

const getSubmitErrorTargetStep = ({
  errors,
  detailsStepNumber,
  dateTimeStepNumber,
}: {
  errors: Record<string, string | undefined>;
  detailsStepNumber: number;
  dateTimeStepNumber: number;
}): number | null => {
  if (errors.companionId) return 1;
  if (errors.specialityId || errors.serviceId || errors.concern) return detailsStepNumber;
  if (errors.slot || errors.leadId) return dateTimeStepNumber;
  return null;
};

const scrollModalSectionIntoView = (
  container: HTMLDivElement | null,
  section: HTMLDivElement | null
) => {
  if (!(container && section)) return;

  const sectionTop = section.offsetTop;
  const nextTop = Math.max(0, sectionTop - 12);
  container.scrollTo({ top: nextTop, behavior: 'smooth' });
};

type AddAppointmentUiState = {
  query: string;
  activeStep: number | null;
  maxUnlockedStep: number;
  concernFocused: boolean;
  pendingAutoSelectCompanionId: string | null;
};

type AddAppointmentUiAction =
  | { type: 'modal-opened' }
  | { type: 'modal-closed' }
  | { type: 'set-query'; query: string }
  | { type: 'set-active-step'; activeStep: number | null }
  | { type: 'unlock-step'; step: number; activeStep?: number | null }
  | { type: 'set-concern-focused'; concernFocused: boolean }
  | { type: 'set-pending-auto-select'; companionId: string | null }
  | { type: 'select-companion'; clearPendingSelection: boolean };

const initialAddAppointmentUiState: AddAppointmentUiState = {
  query: '',
  activeStep: 1,
  maxUnlockedStep: 1,
  concernFocused: false,
  pendingAutoSelectCompanionId: null,
};

const addAppointmentUiReducer = (
  state: AddAppointmentUiState,
  action: AddAppointmentUiAction
): AddAppointmentUiState => {
  switch (action.type) {
    case 'modal-opened':
      return { ...state, activeStep: 1, maxUnlockedStep: 1, concernFocused: false };
    case 'modal-closed':
      return initialAddAppointmentUiState;
    case 'set-query':
      return { ...state, query: action.query };
    case 'set-active-step':
      return { ...state, activeStep: action.activeStep };
    case 'unlock-step':
      return {
        ...state,
        activeStep: action.activeStep ?? state.activeStep,
        maxUnlockedStep: Math.max(state.maxUnlockedStep, action.step),
      };
    case 'set-concern-focused':
      return { ...state, concernFocused: action.concernFocused };
    case 'set-pending-auto-select':
      return { ...state, pendingAutoSelectCompanionId: action.companionId };
    case 'select-companion':
      return {
        ...state,
        activeStep: 2,
        maxUnlockedStep: Math.max(state.maxUnlockedStep, 2),
        pendingAutoSelectCompanionId: action.clearPendingSelection
          ? null
          : state.pendingAutoSelectCompanionId,
      };
    default:
      return state;
  }
};

const syncModalOpenState = ({
  showModal,
  resetForm,
  dispatchUi,
  onPrefillConsumed,
}: {
  showModal: boolean;
  resetForm: () => void;
  dispatchUi: React.Dispatch<AddAppointmentUiAction>;
  onPrefillConsumed?: () => void;
}) => {
  if (!showModal) {
    dispatchUi({ type: 'modal-closed' });
    resetForm();
    onPrefillConsumed?.();
    return;
  }
  dispatchUi({ type: 'modal-opened' });
};

const scrollModalToTopOnOpen = (showModal: boolean, container: HTMLDivElement | null) => {
  if (!showModal) return;
  scrollModalSectionIntoView(container, null);
  container?.scrollTo({ top: 0, behavior: 'auto' });
};

const useAddAppointmentView = ({
  showModal,
  setShowModal,
  setActiveStatus,
  setActiveFilter,
  prefill,
  onPrefillConsumed,
}: AddAppointmentProps) => {
  const isCalendarSlotFlow = Boolean(prefill);
  const detailsStepNumber = isCalendarSlotFlow ? 3 : 2;
  const dateTimeStepNumber = isCalendarSlotFlow ? 2 : 3;
  const terminologyText = useCompanionTerminologyText();
  const companions = useCompanionsParentsForPrimaryOrg();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const step4Ref = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<HTMLDivElement | null>(null);
  const [uiState, dispatchUi] = useReducer(addAppointmentUiReducer, initialAddAppointmentUiState);
  const { query, activeStep, maxUnlockedStep, concernFocused, pendingAutoSelectCompanionId } =
    uiState;
  const concernBlurredRef = useRef(false);
  const setConcernBlurred = (v: boolean) => {
    concernBlurredRef.current = v;
  };
  const [showAddCompanionModal, setShowAddCompanionModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const {
    formData,
    setFormData,
    formDataErrors,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    timeSlots,
    ServiceFields,
    CompanionFields,
    LeadOptions,
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
    calendarSlotFlow: false,
  });

  const companionSatisfied = Boolean(formData.companion.id);
  const detailsSatisfied = Boolean(
    formData.appointmentType?.speciality.id &&
    formData.appointmentType?.id &&
    formData.concern?.trim()
  );
  const canShowDateTimeStep = maxUnlockedStep >= dateTimeStepNumber;
  const canShowDetailsStep = maxUnlockedStep >= detailsStepNumber;
  const canShowBillingStep = maxUnlockedStep >= 4;
  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        formData.companion.id ||
        formData.appointmentType?.speciality?.id ||
        formData.appointmentType?.id ||
        formData.concern?.trim() ||
        selectedSlot ||
        formData.lead?.id ||
        (formData.supportStaff?.length ?? 0) > 0 ||
        formData.isEmergency
      ),
    [formData, selectedSlot]
  );

  const scrollToStep = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    scrollModalSectionIntoView(scrollContainerRef.current, ref.current);
  }, []);

  useEffect(() => {
    syncModalOpenState({
      showModal,
      resetForm,
      dispatchUi,
      onPrefillConsumed,
    });
    scrollModalToTopOnOpen(showModal, scrollContainerRef.current);
  }, [showModal, resetForm, onPrefillConsumed]);

  useLayoutEffect(() => {
    if (!(showModal && companionSatisfied && maxUnlockedStep < 2)) return;
    dispatchUi({ type: 'unlock-step', step: 2, activeStep: 2 });
    scrollToStep(step2Ref);
  }, [companionSatisfied, maxUnlockedStep, scrollToStep, showModal]);

  const CompanionOptions = useMemo(
    () =>
      companions?.map((companion) => ({
        label: formatCompanionNameWithOwnerLastName(companion.companion.name, companion.parent),
        value: companion.companion.id,
      })),
    [companions]
  );

  const CompanionInfoData = useMemo(
    () => ({
      name: formData.companion.name ?? '',
      species: formData.companion.species ?? '',
      breed: formData.companion.breed ?? '',
      parentName: getOwnerFirstName(formData.companion.parent) ?? '',
    }),
    [formData.companion]
  );

  const handleCompanionSelect = useCallback(
    (id: string, clearPendingSelection = false) => {
      const selected = companions.find((item) => item.companion.id === id);
      if (!selected) return;
      setFormData((prev) => ({
        ...prev,
        companion: {
          id: selected.companion.id,
          name: selected.companion.name,
          species: selected.companion.type,
          breed: selected.companion.breed,
          parent: {
            id: selected.parent.id,
            name: [selected.parent.firstName, selected.parent.lastName].filter(Boolean).join(' '),
          },
        },
      }));
      setFormDataErrors((prev) => ({ ...prev, companionId: undefined }));
      dispatchUi({ type: 'select-companion', clearPendingSelection });
      globalThis.setTimeout(() => {
        scrollToStep(step2Ref);
      }, 120);
    },
    [companions, scrollToStep, setFormData, setFormDataErrors]
  );

  useLayoutEffect(() => {
    if (!showModal || !pendingAutoSelectCompanionId) return;
    const selected = companions.find((item) => item.companion.id === pendingAutoSelectCompanionId);
    if (!selected) return;
    handleCompanionSelect(selected.companion.id, true);
  }, [companions, handleCompanionSelect, pendingAutoSelectCompanionId, showModal]);

  const onSubmit = async () => {
    const errors = validateForm(true);
    setFormDataErrors(errors);
    const targetStep = getSubmitErrorTargetStep({
      errors,
      detailsStepNumber,
      dateTimeStepNumber,
    });
    if (targetStep === 1) {
      dispatchUi({ type: 'set-active-step', activeStep: 1 });
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (targetStep === detailsStepNumber) {
      dispatchUi({ type: 'set-active-step', activeStep: detailsStepNumber });
      scrollToStep(isCalendarSlotFlow ? step3Ref : step2Ref);
      return;
    }
    if (targetStep === dateTimeStepNumber) {
      dispatchUi({ type: 'set-active-step', activeStep: dateTimeStepNumber });
      scrollToStep(isCalendarSlotFlow ? step2Ref : step3Ref);
      return;
    }
    await handleCreate(true);
  };

  const goToDetailsStep = useCallback(() => {
    if (!formData.companion.id) {
      setFormDataErrors((prev) => ({
        ...prev,
        companionId: terminologyText('Please select a companion'),
      }));
      dispatchUi({ type: 'set-active-step', activeStep: 1 });
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFormDataErrors((prev) => ({ ...prev, companionId: undefined }));
    dispatchUi({ type: 'unlock-step', step: 2, activeStep: 2 });
    globalThis.setTimeout(() => {
      scrollToStep(step2Ref);
    }, 80);
  }, [formData.companion.id, scrollToStep, setFormDataErrors, terminologyText]);

  // Shared step-advance template: validate the given fields, surface their errors,
  // bounce back to the failing step on error, otherwise unlock and scroll onward.
  const advanceStep = useCallback(
    (options: {
      errorKeys: Array<'specialityId' | 'serviceId' | 'concern' | 'slot' | 'leadId'>;
      failStep: number;
      failRef: React.RefObject<HTMLDivElement | null>;
      unlockStep: number;
      nextRef: React.RefObject<HTMLDivElement | null>;
    }) => {
      const errors = validateForm(false);
      const nextErrors = Object.fromEntries(options.errorKeys.map((key) => [key, errors[key]]));
      setFormDataErrors((prev) => ({ ...prev, ...nextErrors }));
      if (options.errorKeys.some((key) => errors[key])) {
        dispatchUi({ type: 'set-active-step', activeStep: options.failStep });
        scrollToStep(options.failRef);
        return;
      }
      dispatchUi({ type: 'unlock-step', step: options.unlockStep, activeStep: options.unlockStep });
      globalThis.setTimeout(() => {
        scrollToStep(options.nextRef);
      }, 80);
    },
    [scrollToStep, setFormDataErrors, validateForm]
  );

  const goToDateTimeStep = useCallback(
    () =>
      advanceStep({
        errorKeys: ['specialityId', 'serviceId', 'concern'],
        failStep: detailsStepNumber,
        failRef: step2Ref,
        unlockStep: dateTimeStepNumber,
        nextRef: isCalendarSlotFlow ? step2Ref : step3Ref,
      }),
    [advanceStep, dateTimeStepNumber, detailsStepNumber, isCalendarSlotFlow]
  );

  const goToBillingStep = useCallback(
    () =>
      advanceStep({
        errorKeys: ['slot', 'leadId'],
        failStep: dateTimeStepNumber,
        failRef: isCalendarSlotFlow ? step2Ref : step3Ref,
        unlockStep: 4,
        nextRef: step4Ref,
      }),
    [advanceStep, dateTimeStepNumber, isCalendarSlotFlow]
  );

  const goToDetailsFromDateTimeStep = useCallback(
    () =>
      advanceStep({
        errorKeys: ['slot', 'leadId'],
        failStep: dateTimeStepNumber,
        failRef: step2Ref,
        unlockStep: detailsStepNumber,
        nextRef: step3Ref,
      }),
    [advanceStep, dateTimeStepNumber, detailsStepNumber]
  );

  const goToBillingFromDetailsStep = useCallback(
    () =>
      advanceStep({
        errorKeys: ['specialityId', 'serviceId', 'concern'],
        failStep: detailsStepNumber,
        failRef: step3Ref,
        unlockStep: 4,
        nextRef: step4Ref,
      }),
    [advanceStep, detailsStepNumber]
  );

  // Shared details-step JSX: the two placements (before or after date & time in the
  // calendar-slot flow) differ only in their concern-blur behavior and Next target.
  const renderAppointmentDetailsSection = ({
    onConcernBlur,
    onNext,
  }: {
    onConcernBlur: () => void;
    onNext: () => void;
  }) => (
    <AppointmentDetailsSection
      defaultOpen={activeStep === detailsStepNumber}
      open={activeStep === detailsStepNumber}
      onOpenChange={(open) =>
        dispatchUi({
          type: 'set-active-step',
          activeStep: open ? detailsStepNumber : null,
        })
      }
      specialityId={formData.appointmentType?.speciality.id}
      specialityError={formDataErrors.specialityId}
      specialitiesOptions={SpecialitiesOptions}
      onSpecialitySelect={(option) => {
        handleSpecialitySelect(option);
        dispatchUi({ type: 'set-concern-focused', concernFocused: false });
        setConcernBlurred(false);
        dispatchUi({
          type: 'unlock-step',
          step: detailsStepNumber,
          activeStep: detailsStepNumber,
        });
      }}
      serviceId={formData.appointmentType?.id}
      serviceError={formDataErrors.serviceId}
      servicesOptions={ServicesOptions}
      onServiceSelect={(option) => {
        handleServiceSelect(option);
        dispatchUi({ type: 'set-concern-focused', concernFocused: false });
        setConcernBlurred(false);
        dispatchUi({
          type: 'unlock-step',
          step: detailsStepNumber,
          activeStep: detailsStepNumber,
        });
      }}
      concern={formData.concern || ''}
      concernError={formDataErrors.concern}
      onConcernChange={(value) => {
        setFormData({ ...formData, concern: value });
        if (value.trim()) {
          setFormDataErrors((prev) => ({ ...prev, concern: undefined }));
        }
      }}
      onConcernFocus={() => {
        dispatchUi({ type: 'set-concern-focused', concernFocused: true });
      }}
      onConcernBlur={onConcernBlur}
      onNext={onNext}
    />
  );

  const handleQuickAddCompanionVisibility = (value: React.SetStateAction<boolean>) => {
    const nextOpen = typeof value === 'function' ? value(showAddCompanionModal) : value;
    setShowAddCompanionModal(nextOpen);
    if (!nextOpen) {
      loadCompanionsForPrimaryOrg({ force: true, silent: true }).catch(() => undefined);
    }
  };

  const canCloseAddModal = useCallback(() => {
    if (isLoading) return false;
    if (!hasUnsavedChanges) return true;
    setShowDiscardConfirm(true);
    return false;
  }, [hasUnsavedChanges, isLoading]);

  const handleRequestClose = useCallback(() => {
    if (!canCloseAddModal()) return;
    setShowModal(false);
  }, [canCloseAddModal, setShowModal]);

  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardConfirm(false);
    setShowModal(false);
  }, [setShowModal]);

  return (
    <>
      <Modal
        showModal={showModal && !showAddCompanionModal}
        setShowModal={setShowModal}
        canClose={canCloseAddModal}
      >
        <div className="relative flex flex-col h-full gap-6">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-neutral-0/88 backdrop-blur-sm">
              <YosemiteLoader label="Booking appointment" />
              <div className="text-body-4 text-text-secondary">
                Finalizing the appointment and refreshing the schedule.
              </div>
            </div>
          )}
          <ModalHeader title="Add appointment" onClose={handleRequestClose} />

          <div
            ref={scrollContainerRef}
            className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden"
          >
            <div className="flex flex-col gap-6 w-full">
              <Accordion
                title={terminologyText('Companion details')}
                defaultOpen={true}
                open={activeStep === 1}
                onOpenChange={(open) =>
                  dispatchUi({ type: 'set-active-step', activeStep: open ? 1 : null })
                }
                showEditIcon={false}
                isEditing={true}
              >
                <div className="flex flex-col gap-3">
                  {CompanionOptions.length > 0 ? (
                    <>
                      <SearchDropdown
                        placeholder={terminologyText('Search companion')}
                        options={CompanionOptions}
                        onSelect={handleCompanionSelect}
                        query={query}
                        setQuery={(nextQuery) =>
                          dispatchUi({ type: 'set-query', query: nextQuery })
                        }
                        minChars={0}
                        error={formDataErrors.companionId}
                      />
                      <button
                        type="button"
                        className="w-fit text-body-4-emphasis text-(--color-primary-700)"
                        onClick={() => setShowAddCompanionModal(true)}
                      >
                        + {terminologyText('Add new companion')}
                      </button>
                      {formData.companion.name && (
                        <EditableAccordion
                          title={formatCompanionNameWithOwnerLastName(
                            formData.companion.name,
                            formData.companion.parent
                          )}
                          fields={CompanionFields}
                          data={CompanionInfoData}
                          defaultOpen={true}
                          showEditIcon={false}
                        />
                      )}
                      <div className="flex justify-center pt-3 pb-1">
                        <Primary
                          href="#"
                          text="Next"
                          onClick={goToDetailsStep}
                          className="w-auto min-w-42.5"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2 flex-col items-center pb-2">
                      <div className="text-body-4 text-text-primary">
                        {terminologyText('You need companions to start booking appointments')}
                      </div>
                      <Secondary
                        text={terminologyText('Add companion')}
                        href="#"
                        onClick={() => setShowAddCompanionModal(true)}
                        className="w-auto min-w-40"
                      />
                    </div>
                  )}
                </div>
              </Accordion>
              {companionSatisfied && !isCalendarSlotFlow && (
                <div ref={step2Ref}>
                  {renderAppointmentDetailsSection({
                    onConcernBlur: () => {
                      if (concernFocused) {
                        setConcernBlurred(true);
                        if (detailsSatisfied && !isCalendarSlotFlow) {
                          dispatchUi({ type: 'unlock-step', step: 3, activeStep: 3 });
                          globalThis.setTimeout(() => {
                            scrollToStep(step3Ref);
                          }, 80);
                        }
                      }
                    },
                    onNext: goToDateTimeStep,
                  })}
                </div>
              )}
              {canShowDateTimeStep && (
                <div ref={isCalendarSlotFlow ? step2Ref : step3Ref}>
                  <Accordion
                    title="Select date & time"
                    defaultOpen={activeStep === dateTimeStepNumber}
                    open={activeStep === dateTimeStepNumber}
                    onOpenChange={(open) =>
                      dispatchUi({
                        type: 'set-active-step',
                        activeStep: open ? dateTimeStepNumber : null,
                      })
                    }
                    showEditIcon={false}
                    isEditing={true}
                  >
                    <DateTimePickerSection
                      selectedDate={selectedDate}
                      setSelectedDate={setSelectedDate}
                      selectedSlot={selectedSlot}
                      setSelectedSlot={setSelectedSlot}
                      timeSlots={timeSlots}
                      hideDateSlotPicker={isCalendarSlotFlow}
                      isLoadingSlot={isCalendarSlotFlow && isLoadingSlotScopedOptions}
                      slotError={formDataErrors.slot}
                      leadId={formData.lead?.id}
                      leadError={formDataErrors.leadId}
                      leadOptions={LeadOptions}
                      onLeadSelect={handleLeadSelect}
                      supportStaffIds={formData.supportStaff?.map((s) => s.id) || []}
                      teamOptions={TeamOptions?.filter((o) => o.value !== formData.lead?.id)}
                      onSupportStaffChange={handleSupportStaffChange}
                    />
                    <div className="flex justify-center pt-3 pb-1">
                      <Primary
                        href="#"
                        text="Next"
                        onClick={isCalendarSlotFlow ? goToDetailsFromDateTimeStep : goToBillingStep}
                        className="w-auto min-w-42.5"
                      />
                    </div>
                  </Accordion>
                </div>
              )}
              {companionSatisfied && isCalendarSlotFlow && canShowDetailsStep && (
                <div ref={step3Ref}>
                  {renderAppointmentDetailsSection({
                    onConcernBlur: () => {
                      if (concernFocused) {
                        setConcernBlurred(true);
                      }
                    },
                    onNext: goToBillingFromDetailsStep,
                  })}
                </div>
              )}
              {canShowBillingStep && (
                <div ref={step4Ref}>
                  <BillableServicesSection
                    defaultOpen={activeStep === 4}
                    open={activeStep === 4}
                    onOpenChange={(open) =>
                      dispatchUi({ type: 'set-active-step', activeStep: open ? 4 : null })
                    }
                    serviceId={formData.appointmentType?.id}
                    serviceName={formData.appointmentType?.name}
                    serviceFields={ServiceFields}
                    serviceInfoData={ServiceInfoData}
                  />
                  <EmergencyCheckbox
                    checked={formData.isEmergency ?? false}
                    onChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isEmergency: checked }))
                    }
                  />
                </div>
              )}
            </div>
            <div ref={submitRef} className="flex flex-col items-center gap-2 w-full pb-3">
              <BookingErrorMessage error={formDataErrors.booking} />
              <div className="flex flex-row items-center justify-center gap-2 w-full flex-wrap">
                <Primary
                  href="#"
                  text={isLoading ? 'Booking appointment...' : 'Book appointment'}
                  onClick={onSubmit}
                  isDisabled={isLoading}
                  className="w-auto min-w-42.5"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
      <AddCompanion
        showModal={showAddCompanionModal}
        setShowModal={handleQuickAddCompanionVisibility}
        mode="fasttrack"
        onCompanionCreated={(companionId) => {
          const normalizedId = String(companionId ?? '').trim();
          if (!normalizedId) return;
          dispatchUi({ type: 'set-pending-auto-select', companionId: normalizedId });
        }}
      />
      <CenterModal showModal={showDiscardConfirm} setShowModal={setShowDiscardConfirm}>
        <div className="text-body-2 text-text-primary">Discard appointment draft?</div>
        <div className="text-body-4 text-text-secondary">
          You have unsaved changes in this appointment. If you close now, your entered details will
          be lost.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Secondary
            href="#"
            text="Keep editing"
            onClick={() => setShowDiscardConfirm(false)}
            className="w-full"
          />
          <Primary
            href="#"
            text="Discard"
            onClick={handleDiscardAndClose}
            className="w-full bg-red-500!"
          />
        </div>
      </CenterModal>
    </>
  );
};

const AddAppointment = (props: AddAppointmentProps) => useAddAppointmentView(props);

export default AddAppointment;
