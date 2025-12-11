import { create } from "zustand";
import { FormsProps, FormsStatus } from "../types/forms";
import { formatDateLabel } from "../utils/forms";

type FormsState = {
  formsById: Record<string, FormsProps>;
  formIds: string[];
  activeFormId: string | null;
  loading: boolean;
  error: string | null;
  setForms: (forms: FormsProps[]) => void;
  upsertForm: (form: FormsProps) => void;
  updateFormStatus: (formId: string, status: FormsStatus) => void;
  setActiveForm: (formId: string | null) => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;
  clear: () => void;
};

const resolveId = (form: FormsProps): string =>
  form._id ?? form.name ?? crypto.randomUUID();

export const useFormsStore = create<FormsState>()((set, get) => ({
  formsById: {},
  formIds: [],
  activeFormId: null,
  loading: false,
  error: null,

  setForms: (forms) =>
    set(() => {
      const formsById: Record<string, FormsProps> = {};
      const formIds: string[] = [];
      for (const form of forms) {
        const id = resolveId(form);
        formsById[id] = { ...form, _id: id };
        formIds.push(id);
      }
      const activeFormId = formIds[0] ?? null;
      return { formsById, formIds, activeFormId, loading: false, error: null };
    }),

  upsertForm: (form) =>
    set((state) => {
      const id = resolveId(form);
      const exists = Boolean(state.formsById[id]);
      const formsById = {
        ...state.formsById,
        [id]: { ...form, _id: id },
      };
      const formIds = exists ? state.formIds : [id, ...state.formIds];
      const activeFormId = state.activeFormId ?? id;
      return { formsById, formIds, activeFormId };
    }),

  updateFormStatus: (formId, status) =>
    set((state) => {
      const existing = state.formsById[formId];
      if (!existing) return state;
      return {
        formsById: {
          ...state.formsById,
          [formId]: {
            ...existing,
            status,
            lastUpdated: formatDateLabel(new Date()),
          },
        },
      };
    }),

  setActiveForm: (formId) => set(() => ({ activeFormId: formId })),

  setLoading: (value) => set(() => ({ loading: value })),

  setError: (message) => set(() => ({ error: message ?? null })),

  clear: () =>
    set(() => ({
      formsById: {},
      formIds: [],
      activeFormId: null,
      loading: false,
      error: null,
    })),
}));
