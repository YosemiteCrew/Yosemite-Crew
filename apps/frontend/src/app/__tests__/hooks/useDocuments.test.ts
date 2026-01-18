import { renderHook } from "@testing-library/react";
import {
  useLoadDocumentsForPrimaryOrg,
  useDocumentsForPrimaryOrg,
} from "../../hooks/useDocuments";
import { loadDocumentsForOrgPrimaryOrg } from "../../services/documentService";
import { useOrgStore } from "../../stores/orgStore";
import { useOrganizationDocumentStore } from "../../stores/documentStore";
import { OrganizationDocument } from "../../types/document";

// --- Mocks ---

// 1. Mock Service
jest.mock("../../services/documentService", () => ({
  loadDocumentsForOrgPrimaryOrg: jest.fn(),
}));

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("../../stores/documentStore", () => ({
  useOrganizationDocumentStore: jest.fn(),
}));

describe("useDocuments Hooks", () => {
  // Mutable mock state
  let mockOrgState: { primaryOrgId: string | null };
  let mockDocState: {
    documentsById: Record<string, OrganizationDocument>;
    documentIdsByOrgId: Record<string, string[]>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default state
    mockOrgState = { primaryOrgId: null };
    mockDocState = {
      documentsById: {},
      documentIdsByOrgId: {},
    };

    // Setup Store Mock Implementations to use mutable state
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useOrganizationDocumentStore as unknown as jest.Mock).mockImplementation(
      (selector) => selector(mockDocState)
    );
  });

  // --- Section 1: useLoadDocumentsForPrimaryOrg ---
  describe("useLoadDocumentsForPrimaryOrg", () => {
    it("does nothing when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadDocumentsForPrimaryOrg());

      expect(loadDocumentsForOrgPrimaryOrg).not.toHaveBeenCalled();
    });

    it("calls service when primaryOrgId is present", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadDocumentsForPrimaryOrg());

      expect(loadDocumentsForOrgPrimaryOrg).toHaveBeenCalledTimes(1);
      expect(loadDocumentsForOrgPrimaryOrg).toHaveBeenCalledWith();
    });

    it("re-calls service when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadDocumentsForPrimaryOrg());

      expect(loadDocumentsForOrgPrimaryOrg).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadDocumentsForOrgPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useDocumentsForPrimaryOrg ---
  describe("useDocumentsForPrimaryOrg", () => {
    // Helper to cast partial objects to OrganizationDocument for testing
    const mockDoc1 = { id: "doc-1", title: "Policy A" } as unknown as OrganizationDocument;
    const mockDoc2 = { id: "doc-2", title: "Policy B" } as unknown as OrganizationDocument;

    it("returns an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      // Setup data that should be ignored
      mockDocState.documentIdsByOrgId["org-1"] = ["doc-1"];
      mockDocState.documentsById["doc-1"] = mockDoc1;

      const { result } = renderHook(() => useDocumentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("returns an empty array if org exists but has no documents indexed", () => {
      mockOrgState.primaryOrgId = "org-empty";
      // Explicitly set undefined to test the `?? []` fallback
      delete mockDocState.documentIdsByOrgId["org-empty"];

      const { result } = renderHook(() => useDocumentsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("returns correctly mapped documents for the primary org", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockDocState.documentIdsByOrgId["org-1"] = ["doc-1", "doc-2"];
      mockDocState.documentsById = {
        "doc-1": mockDoc1,
        "doc-2": mockDoc2,
        "doc-3": { id: "doc-3" } as any, // Other org
      };

      const { result } = renderHook(() => useDocumentsForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([mockDoc1, mockDoc2]);
    });

    it("filters out null/undefined documents (data integrity check)", () => {
      mockOrgState.primaryOrgId = "org-1";
      // Index says we have 'doc-1' and 'doc-missing'
      mockDocState.documentIdsByOrgId["org-1"] = ["doc-1", "doc-missing"];
      // Map only has 'doc-1'
      mockDocState.documentsById = {
        "doc-1": mockDoc1,
      };

      const { result } = renderHook(() => useDocumentsForPrimaryOrg());

      // Should filter out the missing one
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockDoc1);
    });
  });
});
