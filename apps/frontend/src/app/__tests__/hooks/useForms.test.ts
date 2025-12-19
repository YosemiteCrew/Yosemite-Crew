import { renderHook } from "@testing-library/react";
import {
  useLoadFormsForPrimaryOrg,
  useFormsForPrimaryOrgByCategory,
} from "../../hooks/useForms";
import { loadForms } from "../../services/formService";
import { useOrgStore } from "../../stores/orgStore";
import { useFormsStore } from "../../stores/formsStore";
import { FormsCategory, FormsProps } from "../../types/forms";

// --- Mocks ---

// 1. Mock Service
jest.mock("../../services/formService", () => ({
  loadForms: jest.fn(),
}));

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

jest.mock("../../stores/formsStore", () => ({
  useFormsStore: jest.fn(),
}));

describe("useForms Hooks", () => {
  // Mutable mock state
  let mockOrgState: { primaryOrgId: string | null };
  let mockFormState: {
    formIds: string[];
    formsById: Record<string, FormsProps>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset default state
    mockOrgState = { primaryOrgId: null };
    mockFormState = {
      formIds: [],
      formsById: {},
    };

    // Setup Store Mock Implementations to use mutable state
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useFormsStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockFormState)
    );
  });

  // --- Section 1: useLoadFormsForPrimaryOrg ---
  describe("useLoadFormsForPrimaryOrg", () => {
    it("does nothing when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadFormsForPrimaryOrg());

      expect(loadForms).not.toHaveBeenCalled();
    });

    it("calls loadForms when primaryOrgId is present", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadFormsForPrimaryOrg());

      expect(loadForms).toHaveBeenCalledTimes(1);
    });

    it("re-calls loadForms when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadFormsForPrimaryOrg());

      expect(loadForms).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadForms).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useFormsForPrimaryOrgByCategory ---
  describe("useFormsForPrimaryOrgByCategory", () => {
    // Helper to cast partial objects to FormsProps for testing
    const mockForm1 = {
      id: "form-1",
      orgId: "org-1",
      category: "intake" as FormsCategory,
    } as unknown as FormsProps;

    const mockForm2 = {
      id: "form-2",
      orgId: "org-1",
      category: "consent" as FormsCategory,
    } as unknown as FormsProps;

    const mockForm3 = {
      id: "form-3",
      orgId: "org-2", // Different Org
      category: "intake" as FormsCategory,
    } as unknown as FormsProps;

    it("returns an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      mockFormState.formIds = ["form-1"];
      mockFormState.formsById = { "form-1": mockForm1 };

      const { result } = renderHook(() =>
        useFormsForPrimaryOrgByCategory("intake" as FormsCategory)
      );

      expect(result.current).toEqual([]);
    });

    it("returns an empty array if no forms match the category", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockFormState.formIds = ["form-2"]; // Only have consent form
      mockFormState.formsById = { "form-2": mockForm2 };

      const { result } = renderHook(() =>
        useFormsForPrimaryOrgByCategory("intake" as FormsCategory)
      );

      expect(result.current).toEqual([]);
    });

    it("returns an empty array if forms match category but belong to different org", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockFormState.formIds = ["form-3"]; // Intake form but for org-2
      mockFormState.formsById = { "form-3": mockForm3 };

      const { result } = renderHook(() =>
        useFormsForPrimaryOrgByCategory("intake" as FormsCategory)
      );

      expect(result.current).toEqual([]);
    });

    it("returns correctly filtered forms matching org and category", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockFormState.formIds = ["form-1", "form-2", "form-3"];
      mockFormState.formsById = {
        "form-1": mockForm1,
        "form-2": mockForm2,
        "form-3": mockForm3,
      };

      const { result } = renderHook(() =>
        useFormsForPrimaryOrgByCategory("intake" as FormsCategory)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockForm1);
    });

    it("filters out null/undefined forms (data integrity check)", () => {
      mockOrgState.primaryOrgId = "org-1";
      // ID present in array but missing in map
      mockFormState.formIds = ["form-1", "form-missing"];
      mockFormState.formsById = {
        "form-1": mockForm1,
      };

      const { result } = renderHook(() =>
        useFormsForPrimaryOrgByCategory("intake" as FormsCategory)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockForm1);
    });
  });
});