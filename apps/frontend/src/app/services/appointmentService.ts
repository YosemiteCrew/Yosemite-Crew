import {
  Appointment,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";

import { useOrgStore } from "../stores/orgStore";
import { useAppointmentStore } from "../stores/appointmentStore";
import { getData, patchData, postData } from "./axios";
import {
  AvailabilityResponse,
  InventoryConsumeRequest,
  Slot,
} from "../types/appointments";
import { formatDateLocal } from "../utils/date";
import { fetchInventoryItems } from "./inventoryService";

export const loadAppointmentsForPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setAppointmentsForOrg } =
    useAppointmentStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load appointments.");
    return;
  }
  if (!shouldFetchAppointments(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<{ data: AppointmentResponseDTO[] }>(
      "/fhir/v1/appointment/pms/organisation/" + primaryOrgId,
    );
    const appointments = res.data?.data.map((dto) =>
      fromAppointmentRequestDTO(dto),
    );
    setAppointmentsForOrg(primaryOrgId, appointments);
  } catch (err) {
    console.error("Failed to load appointments:", err);
    throw err;
  }
};

const shouldFetchAppointments = (
  status: ReturnType<typeof useAppointmentStore.getState>["status"],
  opts?: { force?: boolean },
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

export const createAppointment = async (appointment: Appointment) => {
  const { upsertAppointment } = useAppointmentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn(
      "No primary organization selected. Cannot create appointment.",
    );
    return;
  }
  try {
    const payload: Appointment = {
      ...appointment,
      organisationId: primaryOrgId,
    };
    const fhirAppointment = toAppointmentResponseDTO(payload);
    const res = await postData<{
      data: { appointment: AppointmentResponseDTO };
    }>("/fhir/v1/appointment/pms?createPayment=true", fhirAppointment);
    const data = res.data.data.appointment;
    const normalAppointment = fromAppointmentRequestDTO(data);
    upsertAppointment(normalAppointment);
  } catch (err) {
    console.error("Failed to create appointment:", err);
    throw err;
  }
};

export const updateAppointment = async (payload: Appointment) => {
  const { upsertAppointment } = useAppointmentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn(
      "No primary organization selected. Cannot update appointment.",
    );
    return;
  }
  if (!payload.id) {
    console.warn("updateAppointment: missing appointment.id", payload);
    return;
  }
  try {
    const fhirAppointment = toAppointmentResponseDTO(payload);
    const res = await patchData<{
      data: AppointmentResponseDTO;
    }>(
      "/fhir/v1/appointment/pms/" + payload.organisationId + "/" + payload.id,
      fhirAppointment,
    );
    const data = res.data.data;
    const normalAppointment = fromAppointmentRequestDTO(data);
    upsertAppointment(normalAppointment);
  } catch (err) {
    console.error("Failed to update appointment:", err);
    throw err;
  }
};

export const useAppointmentById = (id?: string) => {
  return useAppointmentStore((s) => (id ? s.appointmentsById[id] : undefined));
};

export const getSlotsForServiceAndDateForPrimaryOrg = async (
  serviceId: string,
  date: Date,
): Promise<Slot[]> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return [];
  }
  try {
    if (!serviceId || !date) {
      return [];
    }
    const payload = {
      serviceId: serviceId,
      organisationId: primaryOrgId,
      date: formatDateLocal(date),
    };
    const res = await postData<AvailabilityResponse>(
      "/fhir/v1/service/bookable-slots",
      payload,
    );
    const data = res.data;
    return toSlotsArray(data);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const toSlotsArray = (res: AvailabilityResponse): Slot[] =>
  (res.data?.windows ?? []).map(({ startTime, endTime, vetIds }) => ({
    startTime,
    endTime,
    vetIds,
  }));

export const acceptAppointment = async (appointment: Appointment) => {
  const { upsertAppointment } = useAppointmentStore.getState();
  try {
    if (!appointment.id) {
      return;
    }
    const fhirAppointment = toAppointmentResponseDTO(appointment);
    const res = await postData<{
      data: { appointment: AppointmentResponseDTO };
    }>(
      "/fhir/v1/appointment/pms/" + appointment.id + "/accept",
      fhirAppointment,
    );
    const data = res.data.data.appointment;
    const normalAppointment = fromAppointmentRequestDTO(data);
    upsertAppointment(normalAppointment);
  } catch (err) {
    console.error("Failed to create appointment:", err);
    throw err;
  }
};

export const cancelAppointment = async (appointment: Appointment) => {
  const { upsertAppointment } = useAppointmentStore.getState();
  try {
    if (!appointment.id) {
      return;
    }
    const fhirAppointment = toAppointmentResponseDTO(appointment);
    const res = await postData<{
      data: { appointment: AppointmentResponseDTO };
    }>(
      "/fhir/v1/appointment/pms/" + appointment.id + "/cancel",
      fhirAppointment,
    );
    const data = res.data.data.appointment;
    const normalAppointment = fromAppointmentRequestDTO(data);
    upsertAppointment(normalAppointment);
  } catch (err) {
    console.error("Failed to create appointment:", err);
    throw err;
  }
};

export const consumeInventory = async (inventory: InventoryConsumeRequest) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot consume inventory.");
    return [];
  }
  try {
    await postData("/v1/inventory/stock/consume", inventory);
    await fetchInventoryItems(primaryOrgId);
  } catch (err) {
    console.error("Failed to consume Inventory:", err);
    throw err;
  }
};
