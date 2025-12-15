import { Invoice, InvoiceStatus } from "@yosemite-crew/types";
import { create } from "zustand";

type StoreStatus = "idle" | "loading" | "loaded" | "error";

type InvoiceState = {
  invoicesById: Record<string, Invoice>;
  invoiceIdsByOrgId: Record<string, string[]>;

  status: StoreStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setInvoices: (invoices: Invoice[]) => void;
  setInvoicesForOrg: (orgId: string, invoices: Invoice[]) => void;

  upsertInvoice: (invoice: Invoice) => void;
  removeInvoice: (id: string) => void;
  clearInvoicesForOrg: (orgId: string) => void;

  getInvoicesByOrgId: (orgId: string) => Invoice[];
  getInvoicesByStatus: (orgId: string, status: InvoiceStatus) => Invoice[];

  clearInvoices: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useInvoiceStore = create<InvoiceState>()((set, get) => ({
  invoicesById: {},
  invoiceIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setInvoices: (invoices) =>
    set(() => {
      const invoicesById: Record<string, Invoice> = {};
      const invoiceIdsByOrgId: Record<string, string[]> = {};

      for (const invoice of invoices) {
        const { id, organisationId } = invoice;
        if (!id || !organisationId) continue;

        invoicesById[id] = invoice;
        if (!invoiceIdsByOrgId[organisationId]) {
          invoiceIdsByOrgId[organisationId] = [];
        }
        invoiceIdsByOrgId[organisationId].push(id);
      }

      return {
        invoicesById,
        invoiceIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setInvoicesForOrg: (orgId, invoices) =>
    set((state) => {
      const invoicesById = { ...state.invoicesById };

      const existingIds = state.invoiceIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) {
        delete invoicesById[id];
      }

      const newIds: string[] = [];
      for (const invoice of invoices) {
        if (invoice.id) {
          invoicesById[invoice.id] = invoice;
          newIds.push(invoice.id);
        }
      }

      return {
        invoicesById,
        invoiceIdsByOrgId: {
          ...state.invoiceIdsByOrgId,
          [orgId]: newIds,
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertInvoice: (invoice) =>
    set((state) => {
      const { id, organisationId } = invoice;

      if (!id || !organisationId) {
        console.warn("upsertInvoice: missing organisationId", invoice);
        return state;
      }

      const invoicesById = {
        ...state.invoicesById,
        [id]: {
          ...(state.invoicesById[id]),
          ...invoice,
        },
      };

      const existingIds = state.invoiceIdsByOrgId[organisationId] ?? [];
      const invoiceIdsByOrgId = {
        ...state.invoiceIdsByOrgId,
        [organisationId]: existingIds.includes(id)
          ? existingIds
          : [...existingIds, id],
      };

      return {
        invoicesById,
        invoiceIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  getInvoicesByOrgId: (orgId) => {
    const { invoicesById, invoiceIdsByOrgId } = get();
    const ids = invoiceIdsByOrgId[orgId] ?? [];
    return ids.map((id) => invoicesById[id]).filter(Boolean);
  },

  getInvoicesByStatus: (orgId, status) => {
    const { invoicesById, invoiceIdsByOrgId } = get();
    const ids = invoiceIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => invoicesById[id])
      .filter((invoice): invoice is Invoice => invoice?.status === status);
  },

  removeInvoice: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.invoicesById;

      const invoiceIdsByOrgId: Record<string, string[]> = {};
      for (const [orgId, ids] of Object.entries(state.invoiceIdsByOrgId)) {
        invoiceIdsByOrgId[orgId] = ids.filter((invoiceId) => invoiceId !== id);
      }

      return {
        invoicesById: rest,
        invoiceIdsByOrgId,
      };
    }),

  clearInvoicesForOrg: (orgId) =>
    set((state) => {
      const ids = state.invoiceIdsByOrgId[orgId] ?? [];

      if (!ids.length) {
        const { [orgId]: _, ...restIdx } = state.invoiceIdsByOrgId;
        return { invoiceIdsByOrgId: restIdx };
      }

      const invoicesById = { ...state.invoicesById };
      for (const id of ids) delete invoicesById[id];

      const { [orgId]: _, ...restIdx } = state.invoiceIdsByOrgId;

      return {
        invoicesById,
        invoiceIdsByOrgId: restIdx,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearInvoices: () =>
    set(() => ({
      invoicesById: {},
      invoiceIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
    })),

  setError: (message) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
