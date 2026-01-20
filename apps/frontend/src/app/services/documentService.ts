import { useOrganizationDocumentStore } from "../stores/documentStore";
import { useOrgStore } from "../stores/orgStore";
import {
  OrganisationDocumentResponse,
  OrganizationDocument,
} from "../types/document";
import { deleteData, getData, patchData, postData } from "./axios";

export const loadDocumentsForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, lastFetchedAt, setDocumentsForOrg } =
    useOrganizationDocumentStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load specialities.");
    return;
  }
  if (!shouldFetchDocments(status, lastFetchedAt, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<{ data: OrganizationDocument[] }>(
      "/v1/organisation-document/pms/" + primaryOrgId + "/documents"
    );
    setDocumentsForOrg(primaryOrgId, res.data?.data);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

const shouldFetchDocments = (
  status: ReturnType<typeof useOrganizationDocumentStore.getState>["status"],
  lastFetchedAt: string | null,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (status === "loading") return false;
  if (status === "loaded" && lastFetchedAt) return false;
  return status === "idle" || status === "error";
};

export const createDocument = async (document: OrganizationDocument) => {
  const { upsertDocument } = useOrganizationDocumentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const payload: OrganizationDocument = {
      ...document,
      organisationId: primaryOrgId,
    };
    const url =
      payload.category === "GENERAL" || payload.category === "FIRE_SAFETY"
        ? "/v1/organisation-document/pms/" + primaryOrgId + "/documents"
        : "/v1/organisation-document/pms/" + primaryOrgId + "/documents/policy";
    const res = await postData<OrganisationDocumentResponse>(url, payload);
    const data = res.data?.data;
    const newDocument: OrganizationDocument = {
      _id: data._id,
      title: data.title,
      category: data.category,
      description: data.description,
      fileUrl: data.fileUrl,
      organisationId: data.organisationId,
    };
    upsertDocument(newDocument);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const updateDocument = async (document: OrganizationDocument) => {
  const { upsertDocument } = useOrganizationDocumentStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const url =
      "/v1/organisation-document/pms/" +
      primaryOrgId +
      "/documents/" +
      document._id;
    const res = await patchData<OrganisationDocumentResponse>(url, document);
    const data = res.data?.data;
    const newDocument: OrganizationDocument = {
      _id: data._id,
      title: data.title,
      category: data.category,
      description: data.description,
      fileUrl: data.fileUrl,
      organisationId: data.organisationId,
    };
    upsertDocument(newDocument);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const deleteRoom = async (room: OrganizationDocument) => {
  const { removeDocument } = useOrganizationDocumentStore.getState();
  try {
    const id = room._id;
    const orgId = room.organisationId;
    if (!id || !orgId) {
      throw new Error("Document ID is missing.");
    }
    await deleteData(
      "/v1/organisation-document/pms/" + orgId + "/documents/" + id
    );
    removeDocument(id);
  } catch (err) {
    console.error("Failed to delete document:", err);
    throw err;
  }
};
