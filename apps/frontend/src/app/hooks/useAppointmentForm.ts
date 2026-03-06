import { useCallback, useEffect, useMemo, useState } from "react";
import { Appointment } from "@yosemite-crew/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { useServiceStore } from "@/app/stores/serviceStore";
import { Slot } from "@/app/features/appointments/types/appointments";
import {
  createAppointment,
  getSlotsForServiceAndDateForPrimaryOrg,
} from "@/app/features/appointments/services/appointmentService";
import {
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "@/app/lib/date";
import { useSubscriptionCounterUpdate } from "@/app/hooks/useStripeOnboarding";
import {
  useCanMoreForPrimaryOrg,
  useCurrencyForPrimaryOrg,
} from "@/app/hooks/useBilling";
import { loadInvoicesForOrgPrimaryOrg } from "@/app/features/billing/services/invoiceService";
import { EMPTY_APPOINTMENT } from "@/app/features/appointments/pages/Appointments/Sections/AddAppointment";

export type AppointmentFormErrors = {
  companionId?: string;
  specialityId?: string;
  serviceId?: string;
  leadId?: string;
  duration?: string;
  slot?: string;
  booking?: string;
};

export type UseAppointmentFormOptions = {
  onSuccess?: () => void;
};

export const useAppointmentForm = (options: UseAppointmentFormOptions = {}) => {
  const { onSuccess } = options;

  const teams = useTeamForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const { canMore, reason } = useCanMoreForPrimaryOrg("appointments");
  const getServicesBySpecialityId =
    useServiceStore.getState().getServicesBySpecialityId;
  const { refetch: refetchData } = useSubscriptionCounterUpdate();

  const [formData, setFormData] = useState<Appointment>(EMPTY_APPOINTMENT);
  const [formDataErrors, setFormDataErrors] = useState<AppointmentFormErrors>(
    {}
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const ServiceFields = useMemo(
    () => [
      { label: "Name", key: "name", type: "text" },
      { label: "Description", key: "description", type: "text" },
      { label: "Duration (mins)", key: "duration", type: "text" },
      { label: `Cost (${currency})`, key: "cost", type: "text" },
      { label: "Max discount", key: "maxDiscount", type: "text" },
    ],
    [currency]
  );

  const CompanionFields = useMemo(
    () => [
      { label: "Name", key: "name", type: "text" },
      { label: "Parent name", key: "parentName", type: "text" },
      { label: "Breed", key: "breed", type: "text" },
      { label: "Species", key: "species", type: "text" },
    ],
    []
  );

  useEffect(() => {
    const appointmentTypeId = formData.appointmentType?.id;
    if (!appointmentTypeId || !selectedDate) {
      setTimeSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const slots = await getSlotsForServiceAndDateForPrimaryOrg(
          appointmentTypeId,
          selectedDate
        );
        if (cancelled) return;
        setTimeSlots(slots);
        setSelectedSlot(slots.length > 0 ? slots[0] : null);
      } catch (err) {
        console.log(err);
        if (!cancelled) {
          setTimeSlots([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.appointmentType?.id, selectedDate]);

  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;
    setFormData((prev) => ({
      ...prev,
      startTime: buildUtcDateFromDateAndTime(
        selectedDate,
        selectedSlot.startTime
      ),
      endTime: buildUtcDateFromDateAndTime(selectedDate, selectedSlot.endTime),
      appointmentDate: buildUtcDateFromDateAndTime(
        selectedDate,
        selectedSlot.startTime
      ),
      durationMinutes: getDurationMinutes(
        selectedSlot.startTime,
        selectedSlot.endTime
      ),
    }));
  }, [selectedSlot, selectedDate]);

  const LeadOptions = useMemo(() => {
    if (!teams?.length || !selectedSlot) return [];
    const slot = timeSlots.find((s) => s.startTime === selectedSlot.startTime);
    if (!slot?.vetIds?.length) return [];
    const vetIdSet = new Set(slot.vetIds);
    return teams
      .filter((team) => {
        const teamId = team.practionerId || team._id;
        return teamId ? vetIdSet.has(teamId) : false;
      })
      .map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      }));
  }, [teams, timeSlots, selectedSlot]);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities]
  );

  const services = useMemo(() => {
    const specialityId = formData.appointmentType?.speciality.id;
    if (!specialityId) {
      return [];
    }
    return getServicesBySpecialityId(specialityId);
  }, [formData.appointmentType?.speciality, getServicesBySpecialityId]);

  const ServicesOptions = useMemo(
    () =>
      services?.map((service) => ({
        label: service.name,
        value: service.id,
      })),
    [services]
  );

  const ServiceInfoData = useMemo(() => {
    const serviceId = formData.appointmentType?.id;
    const emptyServiceInfo = {
      name: "",
      description: "",
      cost: "",
      maxDiscount: "",
      duration: "",
    };
    if (!serviceId) {
      return emptyServiceInfo;
    }
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      return {
        name: service.name ?? "",
        description: service.description ?? "",
        cost: service.cost ?? "",
        maxDiscount: service.maxDiscount ?? "",
        duration: service.durationMinutes ?? "",
      };
    }
    return emptyServiceInfo;
  }, [formData.appointmentType, services]);

  const resetForm = useCallback(() => {
    setFormData(EMPTY_APPOINTMENT);
    setSelectedSlot(null);
    setFormDataErrors({});
  }, []);

  const validateForm = useCallback(
    (requireCompanion: boolean = true) => {
      const errors: AppointmentFormErrors = {};
      if (!canMore) {
        errors.booking =
          reason === "limit_reached"
            ? "You've reached your free appointment limit. Please upgrade to book more."
            : "We couldn't verify your booking limit right now. Please try again.";
      }
      if (requireCompanion && !formData.companion.id)
        errors.companionId = "Please select a companion";
      if (!formData.appointmentType?.speciality.id)
        errors.specialityId = "Please select a speciality";
      if (!formData.appointmentType?.id)
        errors.serviceId = "Please select a service";
      if (!formData.lead?.id) errors.leadId = "Please select a lead";
      if (!formData.durationMinutes)
        errors.duration = "Please select a duration";
      if (!selectedSlot) errors.slot = "Please select a slot";
      return errors;
    },
    [canMore, reason, formData, selectedSlot]
  );

  const handleCreate = useCallback(
    async (requireCompanion: boolean = true) => {
      const errors = validateForm(requireCompanion);
      setFormDataErrors(errors);
      if (Object.keys(errors).length > 0) {
        return false;
      }
      setIsLoading(true);
      try {
        await createAppointment(formData);
        await refetchData();
        await loadInvoicesForOrgPrimaryOrg({ force: true });
        resetForm();
        onSuccess?.();
        return true;
      } catch (error) {
        console.log(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [validateForm, formData, refetchData, resetForm, onSuccess]
  );

  const handleSpecialitySelect = useCallback(
    (option: { label: string; value: string }) => {
      setFormData((prev) => ({
        ...prev,
        appointmentType: {
          id: "",
          name: "",
          speciality: {
            id: option.value,
            name: option.label,
          },
        },
      }));
    },
    []
  );

  const handleServiceSelect = useCallback(
    (option: { label: string; value: string }) => {
      setFormData((prev) => ({
        ...prev,
        appointmentType: {
          id: option.value,
          name: option.label,
          speciality: prev.appointmentType?.speciality ?? {
            id: "",
            name: "",
          },
        },
      }));
    },
    []
  );

  const handleLeadSelect = useCallback(
    (option: { label: string; value: string }) => {
      setFormData((prev) => ({
        ...prev,
        lead: {
          name: option.label,
          id: option.value,
        },
      }));
    },
    []
  );

  const handleSupportStaffChange = useCallback(
    (ids: string[]) => {
      const map = new Map(
        TeamOptions.map((o) =>
          typeof o === "string" ? [o, o] : [o.value, o.label]
        )
      );
      setFormData((prev) => ({
        ...prev,
        supportStaff: ids.map((id) => ({
          id,
          name: map.get(id) || "",
        })),
      }));
    },
    [TeamOptions]
  );

  return {
    formData,
    setFormData,
    formDataErrors,
    setFormDataErrors,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    timeSlots,
    isLoading,
    currency,
    teams,
    specialities,
    services,
    ServiceFields,
    CompanionFields,
    LeadOptions,
    TeamOptions,
    SpecialitiesOptions,
    ServicesOptions,
    ServiceInfoData,
    canMore,
    handleCreate,
    handleSpecialitySelect,
    handleServiceSelect,
    handleLeadSelect,
    handleSupportStaffChange,
    resetForm,
    validateForm,
  };
};
