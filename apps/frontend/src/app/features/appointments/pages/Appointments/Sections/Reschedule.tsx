import { Primary } from '@/app/ui/primitives/Buttons';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { buildUtcDateFromDateAndTime, getDurationMinutes, toUtcCalendarDate } from '@/app/lib/date';
import { Appointment } from '@yosemite-crew/types';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';
import { allowReschedule } from '@/app/lib/appointments';
import { useNotify } from '@/app/hooks/useNotify';

type RescheduleProp = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
};

type RescheduleFormErrors = {
  leadId?: string;
  duration?: string;
  slot?: string;
};

type RescheduleState = {
  formData: Appointment;
  selectedDate: Date;
  selectedSlot: Slot | null;
  timeSlots: Slot[];
  formDataErrors: RescheduleFormErrors;
};

type RescheduleStatePatch = Partial<{
  formData: Partial<Appointment>;
  selectedDate: Date;
  selectedSlot: Slot | null;
  timeSlots: Slot[];
  formDataErrors: Partial<RescheduleFormErrors>;
}>;

type RescheduleAction =
  | { type: 'RESET'; state: RescheduleState }
  | { type: 'PATCH'; patch: RescheduleStatePatch }
  | { type: 'SET_FORM_DATA_ERRORS'; errors: RescheduleFormErrors };

const rescheduleReducer = (state: RescheduleState, action: RescheduleAction): RescheduleState => {
  if (action.type === 'RESET') return action.state;
  if (action.type === 'SET_FORM_DATA_ERRORS') return { ...state, formDataErrors: action.errors };
  const { patch } = action;
  return {
    ...state,
    ...patch,
    formData: patch.formData ? { ...state.formData, ...patch.formData } : state.formData,
    formDataErrors: patch.formDataErrors
      ? { ...state.formDataErrors, ...patch.formDataErrors }
      : state.formDataErrors,
  };
};

const Reschedule = ({ showModal, setShowModal, activeAppointment }: RescheduleProp) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const [state, dispatch] = useReducer(rescheduleReducer, undefined, () => ({
    formData: activeAppointment,
    selectedDate: toUtcCalendarDate(activeAppointment.appointmentDate),
    selectedSlot: null as Slot | null,
    timeSlots: [] as Slot[],
    formDataErrors: {} as RescheduleFormErrors,
  }));
  const { formData, selectedDate, selectedSlot, timeSlots, formDataErrors } = state;
  const patchState = useCallback(
    (patch: RescheduleStatePatch) => dispatch({ type: 'PATCH', patch }),
    []
  );
  const setSelectedDate = useCallback<React.Dispatch<React.SetStateAction<Date>>>(
    (value) => {
      dispatch({
        type: 'PATCH',
        patch: {
          selectedDate:
            typeof value === 'function'
              ? (value as (prev: Date) => Date)(state.selectedDate)
              : value,
        },
      });
    },
    [state.selectedDate]
  );
  const setSelectedSlot = useCallback<React.Dispatch<React.SetStateAction<Slot | null>>>(
    (value) => {
      dispatch({
        type: 'PATCH',
        patch: {
          selectedSlot:
            typeof value === 'function'
              ? (value as (prev: Slot | null) => Slot | null)(state.selectedSlot)
              : value,
        },
      });
    },
    [state.selectedSlot]
  );

  const prevActiveAppointmentRef = useRef(activeAppointment);
  if (prevActiveAppointmentRef.current !== activeAppointment) {
    prevActiveAppointmentRef.current = activeAppointment;
    dispatch({
      type: 'PATCH',
      patch: {
        formData: activeAppointment,
        selectedDate: toUtcCalendarDate(activeAppointment.appointmentDate),
      },
    });
  }

  const getLeadOptionsForSlot = useCallback(
    (slot: Slot | null) => {
      if (!teams?.length || !slot) return [];
      const foundSlot = timeSlots.find(
        (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
      );
      if (!foundSlot?.vetIds?.length) return [];
      const vetIdSet = new Set(foundSlot.vetIds);
      return teams.reduce<Array<{ label: string; value: string }>>((options, team) => {
        const id = team.practionerId || team._id;
        if (!id || !vetIdSet.has(id)) return options;
        options.push({
          label: team.name || id,
          value: id,
        });
        return options;
      }, []);
    },
    [teams, timeSlots]
  );

  const LeadOptions = useMemo(() => {
    return getLeadOptionsForSlot(selectedSlot);
  }, [getLeadOptionsForSlot, selectedSlot]);

  useLayoutEffect(() => {
    if (!selectedSlot) return;
    const options = getLeadOptionsForSlot(selectedSlot);
    const currentLeadId = formData.lead?.id || '';

    if (options.length === 0) {
      patchState({
        selectedSlot: null,
        formData: { lead: undefined },
        formDataErrors: {
          slot: 'No lead is available for this slot. Please choose another slot.',
          leadId: 'No lead is available for this slot.',
        },
      });
      return;
    }

    if (options.length === 1) {
      const onlyLead = options[0];
      patchState({
        formData:
          currentLeadId !== onlyLead.value
            ? { lead: { id: onlyLead.value, name: onlyLead.label } }
            : {},
        formDataErrors: { slot: undefined, leadId: undefined },
      });
      return;
    }

    const hasSelectedValidLead = options.some((option) => option.value === currentLeadId);
    if (!hasSelectedValidLead) {
      patchState({
        formData: { lead: undefined },
        formDataErrors: {
          slot: undefined,
          leadId: 'Multiple leads are available. Please choose a lead.',
        },
      });
      return;
    }
    patchState({ formDataErrors: { slot: undefined, leadId: undefined } });
  }, [selectedSlot, getLeadOptionsForSlot, formData.lead?.id, patchState]);

  const handleCancel = () => {
    setShowModal(false);
    patchState({ selectedSlot: null, timeSlots: [], formDataErrors: {} });
  };

  const handleAppointmentUpdate = async () => {
    if (!allowReschedule(activeAppointment.status as any)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Only requested and upcoming appointments can be rescheduled.',
      });
      setShowModal(false);
      return;
    }

    const errors: {
      leadId?: string;
      duration?: string;
      slot?: string;
    } = {};
    const slotLeadOptions = getLeadOptionsForSlot(selectedSlot);
    if (!formData.durationMinutes) errors.duration = 'Please select a duration';
    if (!selectedSlot) errors.slot = 'Please select a slot';
    if (selectedSlot && slotLeadOptions.length === 0) {
      errors.slot = 'No lead is available for this slot. Please choose another slot.';
      errors.leadId = 'No lead is available for this slot.';
    }
    if (selectedSlot && slotLeadOptions.length > 1 && !formData.lead?.id) {
      errors.leadId = 'Multiple leads are available. Please choose a lead.';
    }
    if (
      selectedSlot &&
      formData.lead?.id &&
      slotLeadOptions.length > 0 &&
      !slotLeadOptions.some((option) => option.value === formData.lead?.id)
    ) {
      errors.leadId = 'Selected lead is not available for this slot.';
    }
    dispatch({ type: 'SET_FORM_DATA_ERRORS', errors });
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const payload: Appointment = { ...formData, status: activeAppointment.status };
      await updateAppointment(payload);
      setShowModal(false);
      patchState({ formDataErrors: {}, timeSlots: [], selectedSlot: null });
    } catch (error) {
      console.log(error);
    }
  };

  useLayoutEffect(() => {
    const appointmentTypeId = formData.appointmentType?.id;
    if (!appointmentTypeId || !selectedDate) {
      patchState({ timeSlots: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const slots = await getSlotsForServiceAndDateForPrimaryOrg(appointmentTypeId, selectedDate);
        if (cancelled) return;
        patchState({ timeSlots: slots, selectedSlot: slots.length > 0 ? slots[0] : null });
      } catch (err) {
        console.log(err);
        if (!cancelled) {
          patchState({ timeSlots: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.appointmentType?.id, selectedDate, patchState]);

  useEffect(() => {
    if (!showModal) return;
    if (allowReschedule(activeAppointment.status as any)) return;

    notify('warning', {
      title: 'Reschedule blocked',
      text: 'Checked-in, in-progress, completed, cancelled, and no-show appointments cannot be rescheduled.',
    });
    setShowModal(false);
  }, [activeAppointment.status, notify, setShowModal, showModal]);

  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;
    patchState({
      formData: {
        startTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
        endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.endTime),
        appointmentDate: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.startTime),
        durationMinutes: getDurationMinutes(selectedSlot.startTime, selectedSlot.endTime),
      },
    });
  }, [selectedSlot, selectedDate, patchState]);

  const handleLeadSelect = (option: { label: string; value: string }) => {
    patchState({
      formData: { lead: { name: option.label, id: option.value } },
      formDataErrors: { leadId: undefined },
    });
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex flex-col gap-3">
        <ModalHeader title="Reschedule" onClose={handleCancel} />
        <DateTimePickerSection
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          timeSlots={timeSlots}
          slotError={formDataErrors.slot}
          leadId={formData.lead?.id}
          leadError={formDataErrors.leadId}
          leadOptions={LeadOptions}
          onLeadSelect={handleLeadSelect}
          showSupportStaff={false}
        />
        <Primary href="#" text="Send request" onClick={handleAppointmentUpdate} />
      </div>
    </CenterModal>
  );
};

export default Reschedule;
