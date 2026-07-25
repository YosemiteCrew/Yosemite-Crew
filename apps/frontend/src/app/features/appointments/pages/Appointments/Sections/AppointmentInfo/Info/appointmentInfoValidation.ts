import { Slot } from '@/app/features/appointments/types/appointments';

// Pure form validation for the appointment Info section, kept out of
// AppointmentInfo.tsx so that file only exports its component
// (React Doctor: only-export-components / Fast Refresh).
export type FormErrors = {
  specialityId?: string;
  serviceId?: string;
  slot?: string;
  leadId?: string;
};

export const validateSlotLeadErrors = (
  selectedSlot: Slot | null,
  slotLeadOptions: { label: string; value: string }[],
  leadId: string,
  normalizeId: (value?: string | null) => string | undefined
): Pick<FormErrors, 'slot' | 'leadId'> => {
  if (!selectedSlot) return { slot: 'Please select a slot' };
  if (slotLeadOptions.length === 0) {
    return {
      slot: 'No lead is available for this slot. Please choose another slot.',
      leadId: 'No lead is available for this slot.',
    };
  }
  if (slotLeadOptions.length > 1 && !leadId) {
    return { leadId: 'Multiple leads are available. Please choose a lead.' };
  }
  if (
    leadId &&
    !slotLeadOptions.some((option) => normalizeId(option.value) === normalizeId(leadId))
  ) {
    return { leadId: 'Selected lead is not available for this slot.' };
  }
  return {};
};

export const validateAppointmentForm = ({
  appointmentValues,
  selectedSlot,
  slotLeadOptions,
  normalizeId,
  requireScheduleSelection,
}: {
  appointmentValues: {
    specialityId: string;
    serviceId: string;
    leadId: string;
  };
  selectedSlot: Slot | null;
  slotLeadOptions: { label: string; value: string }[];
  normalizeId: (value?: string | null) => string | undefined;
  requireScheduleSelection: boolean;
}): FormErrors => {
  const formErrors: FormErrors = {};
  if (!requireScheduleSelection) return formErrors;
  if (!appointmentValues.specialityId) formErrors.specialityId = 'Please select a speciality';
  if (!appointmentValues.serviceId) formErrors.serviceId = 'Please select a service';
  const slotLeadErrors = validateSlotLeadErrors(
    selectedSlot,
    slotLeadOptions,
    appointmentValues.leadId,
    normalizeId
  );
  return { ...formErrors, ...slotLeadErrors };
};
