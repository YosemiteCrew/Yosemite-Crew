import { Primary } from '@/app/ui/primitives/Buttons';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  previewAppointmentSeriesReschedule,
  rescheduleAppointmentSeries,
  updateAppointment,
  type AppointmentSeriesReschedulePreview,
} from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { buildUtcDateFromDateAndTime, getDurationMinutes, toUtcCalendarDate } from '@/app/lib/date';
import { Appointment } from '@yosemite-crew/types';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import DateTimePickerSection from '@/app/features/appointments/components/DateTimePickerSection';
import { allowReschedule } from '@/app/lib/appointments';
import { useNotify } from '@/app/hooks/useNotify';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

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

type SeriesPreviewState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error' }
  | { key: string; status: 'success'; data: AppointmentSeriesReschedulePreview };

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

const getRescheduleErrors = (
  formData: Appointment,
  selectedSlot: Slot | null,
  slotLeadOptions: Array<{ label: string; value: string }>
): RescheduleFormErrors => {
  const errors: RescheduleFormErrors = {};
  if (!formData.durationMinutes) errors.duration = 'Please select a duration';
  if (!selectedSlot) errors.slot = 'Please select a slot';
  if (selectedSlot && slotLeadOptions.length === 0) {
    errors.slot = 'No lead is available for this slot. Please choose another slot.';
    errors.leadId = 'No lead is available for this slot.';
  } else if (selectedSlot && slotLeadOptions.length > 1 && !formData.lead?.id) {
    errors.leadId = 'Multiple leads are available. Please choose a lead.';
  } else if (
    selectedSlot &&
    formData.lead?.id &&
    !slotLeadOptions.some((option) => option.value === formData.lead?.id)
  ) {
    errors.leadId = 'Selected lead is not available for this slot.';
  }
  return errors;
};

const SeriesReschedulePreview = ({
  preview,
  loading,
  error,
}: {
  preview: AppointmentSeriesReschedulePreview | null;
  loading: boolean;
  error: boolean;
}) => {
  if (loading) {
    return (
      <output className="block font-satoshi text-xs text-text-secondary">
        Checking later appointments…
      </output>
    );
  }
  if (error) {
    return (
      <p role="alert" className="font-satoshi text-xs text-text-error">
        Unable to check every appointment. Try again.
      </p>
    );
  }
  if (!preview) return null;
  return (
    <ul className="flex flex-col gap-1 font-satoshi text-xs text-text-secondary">
      {preview.map((occurrence) => (
        <li key={occurrence.appointmentId}>
          {formatDateInPreferredTimeZone(new Date(occurrence.startTime), {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          <span
            className={occurrence.hasConflict ? 'text-text-error' : 'text-[var(--success-text)]'}
          >
            {occurrence.hasConflict ? 'Conflict' : 'Available'}
          </span>
        </li>
      ))}
    </ul>
  );
};

const useRescheduleForm = (props: RescheduleProp) => {
  const { showModal, setShowModal, activeAppointment } = props;
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const [seriesScope, setSeriesScope] = useState<'this' | 'following'>('this');
  const [seriesPreviewState, setSeriesPreviewState] = useState<SeriesPreviewState | null>(null);
  const isRecurringAppointment = Boolean(
    activeAppointment.recurrenceSeriesId &&
    activeAppointment.recurrenceSeriesIndex &&
    activeAppointment.recurrenceSeriesTotal
  );
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

  const [prevActiveAppointment, setPrevActiveAppointment] = useState(activeAppointment);
  if (prevActiveAppointment !== activeAppointment) {
    setPrevActiveAppointment(activeAppointment);
    setSeriesScope('this');
    setSeriesPreviewState(null);
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
    setSeriesPreviewState(null);
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

    const errors = getRescheduleErrors(formData, selectedSlot, getLeadOptionsForSlot(selectedSlot));
    dispatch({ type: 'SET_FORM_DATA_ERRORS', errors });
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const payload: Appointment = { ...formData, status: activeAppointment.status };
      if (isRecurringAppointment && seriesScope === 'following') {
        await rescheduleAppointmentSeries(payload);
      } else {
        await updateAppointment(payload);
      }
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

  const shouldPreviewSeries = showModal && isRecurringAppointment && seriesScope === 'following';
  const previewKey = JSON.stringify([
    activeAppointment.id,
    formData.startTime,
    formData.endTime,
    formData.lead?.id,
  ]);
  const currentPreviewState =
    shouldPreviewSeries && seriesPreviewState?.key === previewKey ? seriesPreviewState : null;
  const seriesPreview = currentPreviewState?.status === 'success' ? currentPreviewState.data : null;
  const seriesPreviewError = currentPreviewState?.status === 'error';
  const isSeriesPreviewLoading =
    shouldPreviewSeries && (!currentPreviewState || currentPreviewState.status === 'loading');

  useEffect(() => {
    if (!shouldPreviewSeries) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setSeriesPreviewState({ key: previewKey, status: 'loading' });
        return previewAppointmentSeriesReschedule(formData);
      })
      .then((preview) => {
        if (!cancelled && preview) {
          setSeriesPreviewState({ key: previewKey, status: 'success', data: preview });
        }
      })
      .catch(() => {
        if (!cancelled) setSeriesPreviewState({ key: previewKey, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [formData, previewKey, shouldPreviewSeries]);

  const hasSeriesConflict = Boolean(seriesPreview?.some((occurrence) => occurrence.hasConflict));

  const handleLeadSelect = (option: { label: string; value: string }) => {
    patchState({
      formData: { lead: { name: option.label, id: option.value } },
      formDataErrors: { leadId: undefined },
    });
  };

  return {
    formData,
    formDataErrors,
    handleAppointmentUpdate,
    handleCancel,
    handleLeadSelect,
    hasSeriesConflict,
    isRecurringAppointment,
    isSeriesPreviewLoading,
    LeadOptions,
    selectedDate,
    selectedSlot,
    seriesPreview,
    seriesPreviewError,
    seriesScope,
    setSelectedDate,
    setSelectedSlot,
    setSeriesScope,
    setSeriesPreviewState,
    setShowModal,
    showModal,
    timeSlots,
  };
};

const Reschedule = (props: RescheduleProp) => {
  const {
    formData,
    formDataErrors,
    handleAppointmentUpdate,
    handleCancel,
    handleLeadSelect,
    hasSeriesConflict,
    isRecurringAppointment,
    isSeriesPreviewLoading,
    LeadOptions,
    selectedDate,
    selectedSlot,
    seriesPreview,
    seriesPreviewError,
    seriesScope,
    setSelectedDate,
    setSelectedSlot,
    setSeriesScope,
    setSeriesPreviewState,
    setShowModal,
    showModal,
    timeSlots,
  } = useRescheduleForm(props);

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
        {isRecurringAppointment ? (
          <fieldset className="rounded-2xl border border-[var(--hairline)] px-3 py-2.5">
            <legend className="px-1 font-satoshi text-xs font-medium text-text-primary">
              Apply this change to
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 font-satoshi text-xs text-text-primary">
                <input
                  type="radio"
                  name="reschedule-series-scope"
                  value="this"
                  checked={seriesScope === 'this'}
                  onChange={() => {
                    setSeriesScope('this');
                    setSeriesPreviewState(null);
                  }}
                />
                <span>This appointment only</span>
              </label>
              <label className="flex items-center gap-2 font-satoshi text-xs text-text-primary">
                <input
                  type="radio"
                  name="reschedule-series-scope"
                  value="following"
                  checked={seriesScope === 'following'}
                  onChange={() => {
                    setSeriesScope('following');
                    setSeriesPreviewState(null);
                  }}
                />
                <span>This and following appointments</span>
              </label>
            </div>
            {seriesScope === 'following' ? (
              <div className="mt-2 rounded-xl bg-[var(--hairline-soft)] px-3 py-2">
                <SeriesReschedulePreview
                  preview={seriesPreview}
                  loading={isSeriesPreviewLoading}
                  error={seriesPreviewError}
                />
              </div>
            ) : null}
          </fieldset>
        ) : null}
        <Primary
          href="#"
          text={seriesScope === 'following' ? 'Update following appointments' : 'Send request'}
          onClick={handleAppointmentUpdate}
          isDisabled={
            isRecurringAppointment &&
            seriesScope === 'following' &&
            (isSeriesPreviewLoading ||
              Boolean(seriesPreviewError) ||
              !seriesPreview ||
              hasSeriesConflict)
          }
        />
      </div>
    </CenterModal>
  );
};

export default Reschedule;
