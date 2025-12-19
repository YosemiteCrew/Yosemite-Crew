import {
  loadDocumentsForOrgPrimaryOrg,
  createDocument,
  updateDocument,
} from "../../services/documentService";
import { getData, postData, patchData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useOrganizationDocumentStore } from "../../stores/documentStore";
import { OrganizationDocument } from "../../types/document";

// --- Mocks ---

// 1. Mock Axios Helpers
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPatchData = patchData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/documentStore", () => ({
  useOrganizationDocumentStore: {
    getState: jest.fn(),
  },
}));

describe("Document Service", () => {
  // Store Spies
  const mockDocStoreStartLoading = jest.fn();
  const mockDocStoreSetDocsForOrg = jest.fn();
  const mockDocStoreUpsertDoc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Org Store State
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });

    // Default Document Store State
    (useOrganizationDocumentStore.getState as jest.Mock).mockReturnValue({
      status: "idle",
      startLoading: mockDocStoreStartLoading,
      setDocumentsForOrg: mockDocStoreSetDocsForOrg,
      upsertDocument: mockDocStoreUpsertDoc,
    });
  });

  // --- Section 1: loadDocumentsForOrgPrimaryOrg ---
  describe("loadDocumentsForOrgPrimaryOrg", () => {
    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await loadDocumentsForOrgPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load specialities.");
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and force is false", async () => {
      (useOrganizationDocumentStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockDocStoreStartLoading,
      });

      await loadDocumentsForOrgPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if force option is true even if status is loaded", async () => {
      (useOrganizationDocumentStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockDocStoreStartLoading,
        setDocumentsForOrg: mockDocStoreSetDocsForOrg,
      });
      mockedGetData.mockResolvedValue({ data: { data: [] } });

      await loadDocumentsForOrgPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalled();
    });

    it("fetches and updates store on success", async () => {
      const mockDocs = [{ _id: "doc-1", title: "Policy" }];
      mockedGetData.mockResolvedValue({ data: { data: mockDocs } });

      await loadDocumentsForOrgPrimaryOrg();

      expect(mockDocStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith("/v1/organisation-document/pms/org-123/documents");
      expect(mockDocStoreSetDocsForOrg).toHaveBeenCalledWith("org-123", mockDocs);
    });

    it("suppresses loading state if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: { data: [] } });
      await loadDocumentsForOrgPrimaryOrg({ silent: true });

      expect(mockDocStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalled();
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Fetch Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadDocumentsForOrgPrimaryOrg()).rejects.toThrow("Fetch Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load specialities:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createDocument ---
  describe("createDocument", () => {
    // FIX: Cast to unknown to bypass strict type overlap
    const mockInput = { title: "New Doc", category: "GENERAL" } as unknown as OrganizationDocument;

    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await createDocument(mockInput);

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("sends to base URL if category is GENERAL", async () => {
      const mockResponse = { data: { _id: "doc-new", title: "New Doc", category: "GENERAL", organisationId: "org-123" } };
      mockedPostData.mockResolvedValue({ data: mockResponse });

      await createDocument(mockInput);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents",
        expect.objectContaining({ category: "GENERAL" })
      );
      expect(mockDocStoreUpsertDoc).toHaveBeenCalledWith(mockResponse.data);
    });

    it("sends to base URL if category is FIRE_SAFETY", async () => {
      // FIX: Cast input
      const fireInput = { ...mockInput, category: "FIRE_SAFETY" } as unknown as OrganizationDocument;
      mockedPostData.mockResolvedValue({ data: { data: {} } });

      await createDocument(fireInput);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents",
        expect.anything()
      );
    });

    it("sends to policy URL if category is NOT GENERAL or FIRE_SAFETY", async () => {
      // FIX: Cast input
      const policyInput = { ...mockInput, category: "TERMS_AND_CONDITIONS" } as unknown as OrganizationDocument;
      mockedPostData.mockResolvedValue({ data: { data: {} } });

      await createDocument(policyInput);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents/policy",
        expect.anything()
      );
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Create Error");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createDocument(mockInput)).rejects.toThrow("Create Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: updateDocument ---
  describe("updateDocument", () => {
    // FIX: Cast input
    const mockUpdateInput = { _id: "doc-1", title: "Updated Doc" } as unknown as OrganizationDocument;

    it("returns early if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await updateDocument(mockUpdateInput);

      expect(consoleSpy).toHaveBeenCalledWith("No primary organization selected. Cannot load companions.");
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("patches document, maps response, and updates store", async () => {
      const mockResponse = {
        data: {
          _id: "doc-1",
          title: "Updated Doc",
          organisationId: "org-123"
        }
      };
      mockedPatchData.mockResolvedValue({ data: mockResponse });

      await updateDocument(mockUpdateInput);

      expect(mockedPatchData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents/doc-1",
        mockUpdateInput
      );
      expect(mockDocStoreUpsertDoc).toHaveBeenCalledWith(mockResponse.data);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Update Error");
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateDocument(mockUpdateInput)).rejects.toThrow("Update Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });
});