import { useFormsStore } from "../../stores/formsStore";
import { FormsProps, FormsStatus } from "../../types/forms";
import { formatDateLabel } from "../../utils/forms";

// --- Mocks ---
jest.mock("../../utils/forms", () => ({
  formatDateLabel: jest.fn(() => "Today"),
}));

// Mock crypto.randomUUID for deterministic ID generation
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: jest.fn(() => "uuid-random-123")
  }
});

// Mock Data
const mockForm1: FormsProps = {
  _id: "form-1",
  name: "Form One",
  status: "Draft",
} as unknown as FormsProps;

const mockForm2: FormsProps = {
  _id: "form-2",
  name: "Form Two",
  status: "Published",
} as unknown as FormsProps;

const mockFormNoId: FormsProps = {
  name: "Form No ID",
  status: "Draft",
} as unknown as FormsProps; // Should fallback to name

const mockFormNoNameOrId: FormsProps = {
    status: "Draft"
} as unknown as FormsProps; // Should fallback to UUID

describe("Forms Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useFormsStore.setState({
      formsById: {},
      formIds: [],
      activeFormId: null,
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Base State ---
  describe("Initialization & Base State", () => {
    it("initializes with default empty state", () => {
      const state = useFormsStore.getState();
      expect(state.formsById).toEqual({});
      expect(state.formIds).toEqual([]);
      expect(state.activeFormId).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets active form ID manually", () => {
      useFormsStore.getState().setActiveForm("form-1");
      expect(useFormsStore.getState().activeFormId).toBe("form-1");
    });

    it("sets loading state", () => {
      useFormsStore.getState().setLoading(true);
      expect(useFormsStore.getState().loading).toBe(true);
    });

    it("sets error state", () => {
      useFormsStore.getState().setError("Something went wrong");
      expect(useFormsStore.getState().error).toBe("Something went wrong");

      // Clear error
      useFormsStore.getState().setError(null);
      expect(useFormsStore.getState().error).toBeNull();
    });

    it("clears the store completely", () => {
      const store = useFormsStore.getState();
      store.setForms([mockForm1]);
      store.setLoading(true);

      store.clear();

      const state = useFormsStore.getState();
      expect(state.formsById).toEqual({});
      expect(state.formIds).toHaveLength(0);
      expect(state.loading).toBe(false);
    });
  });

  // --- Section 2: ID Resolution Logic ---
  describe("ID Resolution (resolveId)", () => {
    // We test this implicitly via upsert/setForms since resolveId is not exported

    it("uses _id if present", () => {
      useFormsStore.getState().upsertForm(mockForm1);
      const state = useFormsStore.getState();
      expect(state.formsById["form-1"]).toBeDefined();
    });

    it("fallbacks to name if _id is missing", () => {
      useFormsStore.getState().upsertForm(mockFormNoId);
      const state = useFormsStore.getState();
      // "Form No ID" is the name, so it becomes the key
      expect(state.formsById["Form No ID"]).toBeDefined();
    });

    it("fallbacks to randomUUID if name and _id are missing", () => {
      useFormsStore.getState().upsertForm(mockFormNoNameOrId);
      const state = useFormsStore.getState();
      // Should use the mocked UUID
      expect(state.formsById["uuid-random-123"]).toBeDefined();
    });
  });

  // --- Section 3: Bulk Set Operations ---
  describe("setForms", () => {
    it("replaces existing state with new forms list", () => {
      const store = useFormsStore.getState();
      // Initial junk data
      store.upsertForm(mockFormNoId);

      // Set new list
      store.setForms([mockForm1, mockForm2]);

      const state = useFormsStore.getState();
      expect(Object.keys(state.formsById)).toHaveLength(2);
      expect(state.formsById["form-1"]).toBeDefined();
      expect(state.formsById["form-2"]).toBeDefined();
      expect(state.formsById["Form No ID"]).toBeUndefined(); // Should be gone

      // Verify activeFormId is set to the first item
      expect(state.activeFormId).toBe("form-1");
    });

    it("handles empty list correctly", () => {
      useFormsStore.getState().setForms([]);
      const state = useFormsStore.getState();
      expect(state.formsById).toEqual({});
      expect(state.formIds).toEqual([]);
      expect(state.activeFormId).toBeNull();
    });
  });

  // --- Section 4: Upsert & Status Updates ---
  describe("Upsert & Update Operations", () => {
    it("adds a new form to the top of the list", () => {
      useFormsStore.getState().setForms([mockForm1]);

      // Upsert new form
      useFormsStore.getState().upsertForm(mockForm2);

      const state = useFormsStore.getState();
      expect(state.formIds).toEqual(["form-2", "form-1"]); // Newest first
      expect(state.formsById["form-2"]).toBeDefined();
    });

    it("updates an existing form without changing order", () => {
      useFormsStore.getState().setForms([mockForm1, mockForm2]);

      // Update form-1
      const updatedForm1 = { ...mockForm1, name: "Updated Name" };
      useFormsStore.getState().upsertForm(updatedForm1);

      const state = useFormsStore.getState();
      expect(state.formsById["form-1"].name).toBe("Updated Name");
      expect(state.formIds).toEqual(["form-1", "form-2"]); // Order preserved (assuming setForms pushed them in order)
    });

    it("sets activeFormId on upsert if it was null", () => {
      const state = useFormsStore.getState();
      expect(state.activeFormId).toBeNull();

      useFormsStore.getState().upsertForm(mockForm1);
      expect(useFormsStore.getState().activeFormId).toBe("form-1");
    });

    it("updates form status and timestamp", () => {
      useFormsStore.getState().setForms([mockForm1]);

      useFormsStore.getState().updateFormStatus("form-1", "Archived" as FormsStatus);

      const state = useFormsStore.getState();
      const updatedForm = state.formsById["form-1"];

      expect(updatedForm.status).toBe("Archived");
      expect(updatedForm.lastUpdated).toBe("Today"); // From mock
      expect(formatDateLabel).toHaveBeenCalled();
    });

    it("does nothing if updating status for non-existent form", () => {
      useFormsStore.getState().setForms([mockForm1]);
      const initialSnapshot = JSON.stringify(useFormsStore.getState());

      useFormsStore.getState().updateFormStatus("missing-id", "Archived" as FormsStatus);

      const finalSnapshot = JSON.stringify(useFormsStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });
  });
});