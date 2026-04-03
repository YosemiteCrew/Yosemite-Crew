import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import Modal from '@/app/ui/overlays/Modal';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
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

export const EMPTY_APPOINTMENT: Appointment = {
  id: undefined,
  companion: {
    id: '',
    name: '',
    species: '',
    breed: '',
    parent: {
      id: '',
      name: '',
    },
  },
  lead: undefined,
  supportStaff: [],
  room: undefined,
  appointmentType: undefined,
  organisationId: '',
  appointmentDate: new Date(),
  startTime: new Date(),
  endTime: new Date(),
  timeSlot: '',
  durationMinutes: 0,
  status: 'REQUESTED',
  isEmergency: false,
  concern: '',
};

const AddAppointment = ({
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
  const [query, setQuery] = useState('');
  const [activeStep, setActiveStep] = useState<number | null>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);
  const [concernFocused, setConcernFocused] = useState(false);
  const concernBlurredRef = useRef(false);
  const setConcernBlurred = (v: boolean) => {
    concernBlurredRef.current = v;
  };
  const [showAddCompanionModal, setShowAddCompanionModal] = useState(false);
  const [pendingAutoSelectCompanionId, setPendingAutoSelectCompanionId] = useState<string | null>(
    null
  );
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
    calendarSlotFlow: isCalendarSlotFlow,
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
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!showModal) {
      setActiveStep(1);
      setMaxUnlockedStep(1);
      setConcernFocused(false);
      setQuery('');
      setPendingAutoSelectCompanionId(null);
      resetForm();
      onPrefillConsumed?.();
      return;
    }
    setActiveStep(1);
    setMaxUnlockedStep(1);
    setConcernFocused(false);
  }, [showModal, resetForm, onPrefillConsumed]);

  useEffect(() => {
    if (!showModal || !companionSatisfied) return;
    if (maxUnlockedStep < 2) {
      setMaxUnlockedStep(2);
      setActiveStep(2);
      scrollToStep(step2Ref);
    }
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
    (id: string) => {
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
      setMaxUnlockedStep((prev) => Math.max(prev, 2));
      setActiveStep(2);
      globalThis.setTimeout(() => {
        scrollToStep(step2Ref);
      }, 120);
    },
    [companions, scrollToStep, setFormData, setFormDataErrors]
  );

  useEffect(() => {
    if (!showModal || !pendingAutoSelectCompanionId) return;
    const selected = companions.find((item) => item.companion.id === pendingAutoSelectCompanionId);
    if (!selected) return;
    handleCompanionSelect(selected.companion.id);
    setPendingAutoSelectCompanionId(null);
  }, [companions, handleCompanionSelect, pendingAutoSelectCompanionId, showModal]);

  const onSubmit = async () => {
    const errors = validateForm(true);
    setFormDataErrors(errors);
    if (errors.companionId) {
      setActiveStep(1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (errors.specialityId || errors.serviceId || errors.concern) {
      setActiveStep(detailsStepNumber);
      scrollToStep(isCalendarSlotFlow ? step3Ref : step2Ref);
      return;
    }
    if (errors.slot || errors.leadId) {
      setActiveStep(dateTimeStepNumber);
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
      setActiveStep(1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFormDataErrors((prev) => ({ ...prev, companionId: undefined }));
    setMaxUnlockedStep((prev) => Math.max(prev, 2));
    setActiveStep(2);
    globalThis.setTimeout(() => {
      scrollToStep(step2Ref);
    }, 80);
  }, [formData.companion.id, scrollToStep, setFormDataErrors, terminologyText]);

  const goToDateTimeStep = useCallback(() => {
    const errors = validateForm(false);
    const nextErrors = {
      specialityId: errors.specialityId,
      serviceId: errors.serviceId,
      concern: errors.concern,
    };
    setFormDataErrors((prev) => ({
      ...prev,
      specialityId: nextErrors.specialityId,
      serviceId: nextErrors.serviceId,
      concern: nextErrors.concern,
    }));
    if (nextErrors.specialityId || nextErrors.serviceId || nextErrors.concern) {
      setActiveStep(detailsStepNumber);
      scrollToStep(step2Ref);
      return;
    }
    setMaxUnlockedStep((prev) => Math.max(prev, dateTimeStepNumber));
    setActiveStep(dateTimeStepNumber);
    globalThis.setTimeout(() => {
      scrollToStep(isCalendarSlotFlow ? step2Ref : step3Ref);
    }, 80);
  }, [
    dateTimeStepNumber,
    detailsStepNumber,
    isCalendarSlotFlow,
    scrollToStep,
    setFormDataErrors,
    validateForm,
  ]);

  const goToBillingStep = useCallback(() => {
    const errors = validateForm(false);
    const nextErrors = {
      slot: errors.slot,
      leadId: errors.leadId,
    };
    setFormDataErrors((prev) => ({
      ...prev,
      slot: nextErrors.slot,
      leadId: nextErrors.leadId,
    }));
    if (nextErrors.slot || nextErrors.leadId) {
      setActiveStep(dateTimeStepNumber);
      scrollToStep(isCalendarSlotFlow ? step2Ref : step3Ref);
      return;
    }
    setMaxUnlockedStep((prev) => Math.max(prev, 4));
    setActiveStep(4);
    globalThis.setTimeout(() => {
      scrollToStep(step4Ref);
    }, 80);
  }, [dateTimeStepNumber, isCalendarSlotFlow, scrollToStep, setFormDataErrors, validateForm]);

  const goToDetailsFromDateTimeStep = useCallback(() => {
    const errors = validateForm(false);
    const nextErrors = {
      slot: errors.slot,
      leadId: errors.leadId,
    };
    setFormDataErrors((prev) => ({
      ...prev,
      slot: nextErrors.slot,
      leadId: nextErrors.leadId,
    }));
    if (nextErrors.slot || nextErrors.leadId) {
      setActiveStep(dateTimeStepNumber);
      scrollToStep(step2Ref);
      return;
    }
    setMaxUnlockedStep((prev) => Math.max(prev, detailsStepNumber));
    setActiveStep(detailsStepNumber);
    globalThis.setTimeout(() => {
      scrollToStep(step3Ref);
    }, 80);
  }, [dateTimeStepNumber, detailsStepNumber, scrollToStep, setFormDataErrors, validateForm]);

  const goToBillingFromDetailsStep = useCallback(() => {
    const errors = validateForm(false);
    const nextErrors = {
      specialityId: errors.specialityId,
      serviceId: errors.serviceId,
      concern: errors.concern,
    };
    setFormDataErrors((prev) => ({
      ...prev,
      specialityId: nextErrors.specialityId,
      serviceId: nextErrors.serviceId,
      concern: nextErrors.concern,
    }));
    if (nextErrors.specialityId || nextErrors.serviceId || nextErrors.concern) {
      setActiveStep(detailsStepNumber);
      scrollToStep(step3Ref);
      return;
    }
    setMaxUnlockedStep((prev) => Math.max(prev, 4));
    setActiveStep(4);
    globalThis.setTimeout(() => {
      scrollToStep(step4Ref);
    }, 80);
  }, [detailsStepNumber, scrollToStep, setFormDataErrors, validateForm]);

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
        <div className="flex flex-col h-full gap-6">
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
                onOpenChange={(open) => setActiveStep(open ? 1 : null)}
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
                        setQuery={setQuery}
                        minChars={0}
                        error={formDataErrors.companionId}
                      />
                      <button
                        type="button"
                        className="w-fit text-body-4-emphasis text-text-brand"
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
                          classname="py-[12px] px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 text-body-3-emphasis text-center font-satoshi bg-text-primary text-neutral-0! w-auto min-w-[170px]"
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
                        className="w-auto min-w-[160px]"
                      />
                    </div>
                  )}
                </div>
              </Accordion>
              {companionSatisfied && !isCalendarSlotFlow ? (
                <div ref={step2Ref}>
                  <AppointmentDetailsSection
                    defaultOpen={activeStep === detailsStepNumber}
                    open={activeStep === detailsStepNumber}
                    onOpenChange={(open) => setActiveStep(open ? detailsStepNumber : null)}
                    specialityId={formData.appointmentType?.speciality.id}
                    specialityError={formDataErrors.specialityId}
                    specialitiesOptions={SpecialitiesOptions}
                    onSpecialitySelect={(option) => {
                      handleSpecialitySelect(option);
                      setConcernFocused(false);
                      setConcernBlurred(false);
                      setMaxUnlockedStep(detailsStepNumber);
                      setActiveStep(detailsStepNumber);
                    }}
                    serviceId={formData.appointmentType?.id}
                    serviceError={formDataErrors.serviceId}
                    servicesOptions={ServicesOptions}
                    onServiceSelect={(option) => {
                      handleServiceSelect(option);
                      setConcernFocused(false);
                      setConcernBlurred(false);
                      setMaxUnlockedStep(detailsStepNumber);
                      setActiveStep(detailsStepNumber);
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
                      setConcernFocused(true);
                    }}
                    onConcernBlur={() => {
                      if (concernFocused) {
                        setConcernBlurred(true);
                        if (detailsSatisfied && !isCalendarSlotFlow) {
                          setMaxUnlockedStep((prev) => Math.max(prev, 3));
                          setActiveStep(3);
                          globalThis.setTimeout(() => {
                            scrollToStep(step3Ref);
                          }, 80);
                        }
                      }
                    }}
                    onNext={goToDateTimeStep}
                  />
                </div>
              ) : null}
              {canShowDateTimeStep ? (
                <div ref={isCalendarSlotFlow ? step2Ref : step3Ref}>
                  <Accordion
                    title="Select date & time"
                    defaultOpen={activeStep === dateTimeStepNumber}
                    open={activeStep === dateTimeStepNumber}
                    onOpenChange={(open) => setActiveStep(open ? dateTimeStepNumber : null)}
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
                      slotError={formDataErrors.slot}
                      leadId={formData.lead?.id}
                      leadError={formDataErrors.leadId}
                      leadOptions={LeadOptions}
                      onLeadSelect={handleLeadSelect}
                      supportStaffIds={formData.supportStaff?.map((s) => s.id) || []}
                      teamOptions={TeamOptions}
                      onSupportStaffChange={handleSupportStaffChange}
                    />
                    <div className="flex justify-center pt-3 pb-1">
                      <Primary
                        href="#"
                        text="Next"
                        onClick={isCalendarSlotFlow ? goToDetailsFromDateTimeStep : goToBillingStep}
                        classname="py-[12px] px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 text-body-3-emphasis text-center font-satoshi bg-text-primary text-neutral-0! w-auto min-w-[170px]"
                      />
                    </div>
                  </Accordion>
                </div>
              ) : null}
              {companionSatisfied && isCalendarSlotFlow && canShowDetailsStep ? (
                <div ref={step3Ref}>
                  <AppointmentDetailsSection
                    defaultOpen={activeStep === detailsStepNumber}
                    open={activeStep === detailsStepNumber}
                    onOpenChange={(open) => setActiveStep(open ? detailsStepNumber : null)}
                    specialityId={formData.appointmentType?.speciality.id}
                    specialityError={formDataErrors.specialityId}
                    specialitiesOptions={SpecialitiesOptions}
                    onSpecialitySelect={(option) => {
                      handleSpecialitySelect(option);
                      setConcernFocused(false);
                      setConcernBlurred(false);
                      setMaxUnlockedStep(detailsStepNumber);
                      setActiveStep(detailsStepNumber);
                    }}
                    serviceId={formData.appointmentType?.id}
                    serviceError={formDataErrors.serviceId}
                    servicesOptions={ServicesOptions}
                    onServiceSelect={(option) => {
                      handleServiceSelect(option);
                      setConcernFocused(false);
                      setConcernBlurred(false);
                      setMaxUnlockedStep(detailsStepNumber);
                      setActiveStep(detailsStepNumber);
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
                      setConcernFocused(true);
                    }}
                    onConcernBlur={() => {
                      if (concernFocused) {
                        setConcernBlurred(true);
                      }
                    }}
                    onNext={goToBillingFromDetailsStep}
                  />
                </div>
              ) : null}
              {canShowBillingStep ? (
                <div ref={step4Ref}>
                  <BillableServicesSection
                    defaultOpen={activeStep === 4}
                    open={activeStep === 4}
                    onOpenChange={(open) => setActiveStep(open ? 4 : null)}
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
              ) : null}
            </div>
            <div ref={submitRef} className="flex flex-col items-center gap-2 w-full pb-3">
              <BookingErrorMessage error={formDataErrors.booking} />
              <div className="flex flex-row items-center justify-center gap-2 w-full flex-wrap">
                <Primary
                  href="#"
                  text={isLoading ? 'Booking appointment...' : 'Book appointment'}
                  onClick={onSubmit}
                  isDisabled={isLoading}
                  classname="w-auto min-w-[170px]"
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
          setPendingAutoSelectCompanionId(normalizedId);
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

export default AddAppointment;
