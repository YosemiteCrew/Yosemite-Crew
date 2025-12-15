import { create } from "zustand";
import { OrganizationDocument, OrgDocumentCategory } from "../types/document";

type DocumentStatus = "idle" | "loading" | "loaded" | "error";

type DocumentState = {
  documentsById: Record<string, OrganizationDocument>;
  documentIdsByOrgId: Record<string, string[]>;

  status: DocumentStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setDocuments: (docs: OrganizationDocument[]) => void;
  setDocumentsForOrg: (orgId: string, docs: OrganizationDocument[]) => void;

  upsertDocument: (doc: OrganizationDocument) => void;
  removeDocument: (id: string) => void;
  clearDocumentsForOrg: (orgId: string) => void;

  getDocumentsByOrgId: (orgId: string) => OrganizationDocument[];
  getDocumentsByCategory: (
    orgId: string,
    category: OrgDocumentCategory
  ) => OrganizationDocument[];

  clearDocuments: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useOrganizationDocumentStore = create<DocumentState>()(
  (set, get) => ({
    documentsById: {},
    documentIdsByOrgId: {},
    status: "idle",
    error: null,
    lastFetchedAt: null,

    setDocuments: (docs) =>
      set(() => {
        const documentsById: Record<string, OrganizationDocument> = {};
        const documentIdsByOrgId: Record<string, string[]> = {};
        for (const doc of docs) {
          const id = doc._id;
          const orgId = doc.organisationId;
          documentsById[id] = { ...doc, _id: id };
          if (!documentIdsByOrgId[orgId]) {
            documentIdsByOrgId[orgId] = [];
          }
          documentIdsByOrgId[orgId].push(id);
        }
        return {
          documentsById,
          documentIdsByOrgId,
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    setDocumentsForOrg: (orgId, docs) =>
      set((state) => {
        const documentsById = { ...state.documentsById };
        const existingIds = state.documentIdsByOrgId[orgId] ?? [];
        for (const id of existingIds) delete documentsById[id];
        const newIds: string[] = [];
        for (const doc of docs) {
          documentsById[doc._id] = doc;
          newIds.push(doc._id);
        }
        return {
          documentsById,
          documentIdsByOrgId: {
            ...state.documentIdsByOrgId,
            [orgId]: newIds,
          },
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    upsertDocument: (doc) =>
      set((state) => {
        const id = doc._id;
        const orgId = doc.organisationId;
        if (!id || !orgId) {
          console.warn("upsertDocument: invalid document", doc);
          return state;
        }
        const documentsById = {
          ...state.documentsById,
          [id]: {
            ...(state.documentsById[id] ?? ({} as OrganizationDocument)),
            ...doc,
            id,
          },
        };
        const existingIds = state.documentIdsByOrgId[orgId] ?? [];
        const documentIdsByOrgId = {
          ...state.documentIdsByOrgId,
          [orgId]: existingIds.includes(id)
            ? existingIds
            : [...existingIds, id],
        };
        return {
          documentsById,
          documentIdsByOrgId,
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    getDocumentsByOrgId: (orgId) => {
      const { documentsById, documentIdsByOrgId } = get();
      const ids = documentIdsByOrgId[orgId] ?? [];
      return ids
        .map((id) => documentsById[id])
        .filter((d): d is OrganizationDocument => d != null);
    },

    getDocumentsByCategory: (orgId, category) => {
      const { documentsById, documentIdsByOrgId } = get();
      const ids = documentIdsByOrgId[orgId] ?? [];
      return ids
        .map((id) => documentsById[id])
        .filter(
          (doc): doc is OrganizationDocument => doc?.category === category
        );
    },

    removeDocument: (id) =>
      set((state) => {
        const { [id]: _, ...rest } = state.documentsById;
        const documentIdsByOrgId: Record<string, string[]> = {};
        for (const [orgId, ids] of Object.entries(state.documentIdsByOrgId)) {
          documentIdsByOrgId[orgId] = ids.filter((docId) => docId !== id);
        }
        return {
          documentsById: rest,
          documentIdsByOrgId,
        };
      }),

    clearDocumentsForOrg: (orgId: string) =>
      set((state) => {
        const ids = state.documentIdsByOrgId[orgId] ?? [];
        if (!ids.length) {
          const { [orgId]: _, ...restIdx } = state.documentIdsByOrgId;
          return { documentIdsByOrgId: restIdx };
        }
        const documentsById = { ...state.documentsById };
        for (const id of ids) delete documentsById[id];
        const { [orgId]: _, ...restIdx } = state.documentIdsByOrgId;
        return {
          documentsById,
          documentIdsByOrgId: restIdx,
          status: "loaded",
          error: null,
          lastFetchedAt: new Date().toISOString(),
        };
      }),

    clearDocuments: () =>
      set(() => ({
        documentsById: {},
        documentIdsByOrgId: {},
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
  })
);
