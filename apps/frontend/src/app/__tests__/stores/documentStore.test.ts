import { useOrganizationDocumentStore } from "../../stores/documentStore";
import { OrganizationDocument } from "../../types/document";

// --- Mock Data ---
// We cast to unknown first to avoid needing strict adherence to every field in the type during testing
const mockDoc1: OrganizationDocument = {
  _id: "doc-1",
  organisationId: "org-A",
  title: "Terms and Conditions",
  category: "TERMS_AND_CONDITIONS",
  fileUrl: "http://example.com/terms.pdf",
} as unknown as OrganizationDocument;

const mockDoc2: OrganizationDocument = {
  _id: "doc-2",
  organisationId: "org-A",
  title: "Privacy Policy",
  category: "PRIVACY_POLICY",
  fileUrl: "http://example.com/privacy.pdf",
} as unknown as OrganizationDocument;

const mockDoc3: OrganizationDocument = {
  _id: "doc-3",
  organisationId: "org-B",
  title: "Fire Safety",
  category: "FIRE_SAFETY",
  fileUrl: "http://example.com/fire.pdf",
} as unknown as OrganizationDocument;

describe("Organization Document Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useOrganizationDocumentStore.setState({
      documentsById: {},
      documentIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default state", () => {
      const state = useOrganizationDocumentStore.getState();
      expect(state.status).toBe("idle");
      expect(state.documentsById).toEqual({});
      expect(state.documentIdsByOrgId).toEqual({});
      expect(state.error).toBeNull();
    });

    it("manages loading state correctly", () => {
      const store = useOrganizationDocumentStore.getState();

      store.startLoading();
      expect(useOrganizationDocumentStore.getState().status).toBe("loading");
      expect(useOrganizationDocumentStore.getState().error).toBeNull();

      store.endLoading();
      expect(useOrganizationDocumentStore.getState().status).toBe("loaded");
    });

    it("sets error state correctly", () => {
      const store = useOrganizationDocumentStore.getState();
      store.setError("Failed to fetch documents");

      expect(useOrganizationDocumentStore.getState().status).toBe("error");
      expect(useOrganizationDocumentStore.getState().error).toBe("Failed to fetch documents");
    });

    it("clears the entire store", () => {
      const store = useOrganizationDocumentStore.getState();
      store.setDocuments([mockDoc1]);

      store.clearDocuments();

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentsById).toEqual({});
      expect(state.documentIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
    });
  });

  // --- Section 2: Bulk Operations & Getters ---
  describe("Bulk Sets & Getters", () => {
    it("sets all documents globally and indexes them correctly", () => {
      const store = useOrganizationDocumentStore.getState();
      store.setDocuments([mockDoc1, mockDoc2, mockDoc3]);

      const state = useOrganizationDocumentStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.documentsById["doc-1"]).toEqual(mockDoc1);
      expect(state.documentsById["doc-3"]).toEqual(mockDoc3);

      // Verify indexing
      expect(state.documentIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.documentIdsByOrgId["org-A"]).toContain("doc-1");
      expect(state.documentIdsByOrgId["org-A"]).toContain("doc-2");
      expect(state.documentIdsByOrgId["org-B"]).toHaveLength(1);
    });

    it("sets documents for a specific organization explicitly", () => {
      // Setup initial state with Org A and Org B
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1, mockDoc3]);

      // Update ONLY Org A (replace doc-1 with doc-2)
      useOrganizationDocumentStore.getState().setDocumentsForOrg("org-A", [mockDoc2]);

      const state = useOrganizationDocumentStore.getState();

      // Org A should now only have doc-2
      expect(state.documentIdsByOrgId["org-A"]).toEqual(["doc-2"]);
      expect(state.documentsById["doc-1"]).toBeUndefined(); // Should be removed
      expect(state.documentsById["doc-2"]).toBeDefined();   // Should be added

      // Org B should remain untouched
      expect(state.documentIdsByOrgId["org-B"]).toEqual(["doc-3"]);
      expect(state.documentsById["doc-3"]).toBeDefined();
    });

    it("retrieves documents by Org ID", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1, mockDoc2, mockDoc3]);

      const orgADocs = useOrganizationDocumentStore.getState().getDocumentsByOrgId("org-A");
      expect(orgADocs).toHaveLength(2);
      expect(orgADocs.find(d => d._id === "doc-1")).toBeDefined();

      // Non-existent Org
      expect(useOrganizationDocumentStore.getState().getDocumentsByOrgId("org-C")).toEqual([]);
    });

    it("retrieves documents filtered by Category", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1, mockDoc2]);

      // Filter for Privacy Policy in Org A
      const privacyDocs = useOrganizationDocumentStore.getState().getDocumentsByCategory("org-A", "PRIVACY_POLICY");
      expect(privacyDocs).toHaveLength(1);
      expect(privacyDocs[0]._id).toBe("doc-2");

      // Filter for non-existent category
      const emptyDocs = useOrganizationDocumentStore.getState().getDocumentsByCategory("org-A", "GENERAL");
      expect(emptyDocs).toHaveLength(0);
    });
  });

  // --- Section 3: Upsert (Add/Update) Operations ---
  describe("Upsert Operations", () => {
    it("adds a new document if it does not exist", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1]);

      // Upsert new doc-2
      useOrganizationDocumentStore.getState().upsertDocument(mockDoc2);

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentsById["doc-2"]).toBeDefined();
      expect(state.documentIdsByOrgId["org-A"]).toContain("doc-2");
      expect(state.documentIdsByOrgId["org-A"]).toHaveLength(2);
    });

    it("updates an existing document", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1]);

      const updatedDoc1 = { ...mockDoc1, title: "Updated Terms" } as unknown as OrganizationDocument;
      useOrganizationDocumentStore.getState().upsertDocument(updatedDoc1);

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentsById["doc-1"].title).toBe("Updated Terms");
      // Should not duplicate the ID in the list
      expect(state.documentIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("handles upsert gracefully when required fields are missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      // Missing _id and organisationId
      const invalidDoc = { title: "Bad Doc" } as unknown as OrganizationDocument;

      // Should fail safely
      useOrganizationDocumentStore.getState().upsertDocument(invalidDoc);

      const state = useOrganizationDocumentStore.getState();
      // Ensure nothing was added
      expect(Object.keys(state.documentsById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertDocument: invalid document",
        invalidDoc
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert for a new organization not yet in store", () => {
      useOrganizationDocumentStore.getState().upsertDocument(mockDoc3); // Org B

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentIdsByOrgId["org-B"]).toEqual(["doc-3"]);
    });
  });

  // --- Section 4: Removal & Cleanup Operations ---
  describe("Removal & Clearing", () => {
    it("removes a document by ID and updates index", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1, mockDoc2]);

      useOrganizationDocumentStore.getState().removeDocument("doc-1");

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentsById["doc-1"]).toBeUndefined();
      expect(state.documentsById["doc-2"]).toBeDefined();
      expect(state.documentIdsByOrgId["org-A"]).toEqual(["doc-2"]);
    });

    it("handles removing a document that does not exist", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1]);

      useOrganizationDocumentStore.getState().removeDocument("fake-id");

      // Verify state mostly unchanged (except potentially creating empty arrays if loop logic is simple,
      // but key logic is that the actual data integrity is maintained)
      const state = useOrganizationDocumentStore.getState();
      expect(state.documentsById["doc-1"]).toBeDefined();
    });

    it("clears all documents for a specific organization", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1, mockDoc3]);

      useOrganizationDocumentStore.getState().clearDocumentsForOrg("org-A");

      const state = useOrganizationDocumentStore.getState();
      // Org A data gone
      expect(state.documentIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.documentsById["doc-1"]).toBeUndefined();

      // Org B data remains
      expect(state.documentIdsByOrgId["org-B"]).toBeDefined();
      expect(state.documentsById["doc-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useOrganizationDocumentStore.getState().setDocuments([mockDoc1]);

      // Clear empty org
      useOrganizationDocumentStore.getState().clearDocumentsForOrg("org-Empty");

      const state = useOrganizationDocumentStore.getState();
      expect(state.documentIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.documentsById["doc-1"]).toBeDefined();
    });
  });
});