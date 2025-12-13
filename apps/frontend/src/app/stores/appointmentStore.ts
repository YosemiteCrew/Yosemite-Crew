import { Appointment } from "@yosemite-crew/types";
import { create } from "zustand";

type StoreStatus = "idle" | "loading" | "loaded" | "error";

type AppointmentState = {
  appointmentsById: Record<string, Appointment>;
  appointmentIdsByOrgId: Record<string, string[]>;

  status: StoreStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setAppointments: (items: Appointment[]) => void;
  setAppointmentsForOrg: (orgId: string, items: Appointment[]) => void;

  upsertAppointment: (item: Appointment) => void;

  getAppointmentsByOrgId: (orgId: string) => Appointment[];
  getAppointmentById: (id: string) => Appointment | undefined;

  removeAppointment: (id: string) => void;
  clearAppointmentsForOrg: (orgId: string) => void;
  clearAppointments: () => void;

  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useAppointmentStore = create<AppointmentState>()((set, get) => ({
  appointmentsById: {},
  appointmentIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setAppointments: (items) =>
    set(() => {
      const appointmentsById: Record<string, Appointment> = {};
      const appointmentIdsByOrgId: Record<string, string[]> = {};
      for (const a of items) {
        const id = a.id!;
        const orgId = a.organisationId;
        appointmentsById[id] = { ...a, id };
        if (!appointmentIdsByOrgId[orgId]) appointmentIdsByOrgId[orgId] = [];
        appointmentIdsByOrgId[orgId].push(id);
      }
      return {
        appointmentsById,
        appointmentIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setAppointmentsForOrg: (orgId, items) =>
    set((state) => {
      const appointmentsById = { ...state.appointmentsById };
      const existingIds = state.appointmentIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) delete appointmentsById[id];
      const newIds: string[] = [];
      for (const a of items) {
        const id = a.id!;
        appointmentsById[id] = { ...a, id };
        newIds.push(id);
      }
      return {
        appointmentsById,
        appointmentIdsByOrgId: {
          ...state.appointmentIdsByOrgId,
          [orgId]: newIds,
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertAppointment: (item) =>
    set((state) => {
      const id = item.id!;
      const orgId = item.organisationId;
      if (!orgId) {
        console.warn("upsertAppointment: missing organisationId:", item);
        return state;
      }
      const appointmentsById = {
        ...state.appointmentsById,
        [id]: {
          ...(state.appointmentsById[id] ?? ({} as Appointment)),
          ...item,
          id,
        },
      };
      const existingIds = state.appointmentIdsByOrgId[orgId] ?? [];
      const appointmentIdsByOrgId = {
        ...state.appointmentIdsByOrgId,
        [orgId]: existingIds.includes(id) ? existingIds : [...existingIds, id],
      };
      return {
        appointmentsById,
        appointmentIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  getAppointmentsByOrgId: (orgId) => {
    const { appointmentsById, appointmentIdsByOrgId } = get();
    const ids = appointmentIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => appointmentsById[id])
      .filter((a): a is Appointment => a != null);
  },

  getAppointmentById: (id) => get().appointmentsById[id],

  removeAppointment: (id) =>
    set((state) => {
      const removed = state.appointmentsById[id];
      if (!removed) return state;
      const orgId = removed.organisationId;
      const { [id]: _, ...rest } = state.appointmentsById;
      return {
        appointmentsById: rest,
        appointmentIdsByOrgId: {
          ...state.appointmentIdsByOrgId,
          [orgId]:
            state.appointmentIdsByOrgId[orgId]?.filter((x) => x !== id) ?? [],
        },
      };
    }),

  clearAppointmentsForOrg: (orgId) =>
    set((state) => {
      const ids = state.appointmentIdsByOrgId[orgId] ?? [];
      if (!ids.length) {
        const { [orgId]: _, ...restIdx } = state.appointmentIdsByOrgId;
        return { appointmentIdsByOrgId: restIdx };
      }
      const appointmentsById = { ...state.appointmentsById };
      for (const id of ids) delete appointmentsById[id];
      const { [orgId]: _, ...restIdx } = state.appointmentIdsByOrgId;
      return {
        appointmentsById,
        appointmentIdsByOrgId: restIdx,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearAppointments: () =>
    set(() => ({
      appointmentsById: {},
      appointmentIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () => set(() => ({ status: "loading", error: null })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
      lastFetchedAt: new Date().toISOString(),
    })),

  setError: (message) => set(() => ({ status: "error", error: message })),
}));
