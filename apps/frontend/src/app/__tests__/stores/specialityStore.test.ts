import { useSpecialityStore } from "../../stores/specialityStore";
import { Speciality } from "@yosemite-crew/types";

// --- Mock Crypto ---
// Mock crypto.randomUUID to return predictable IDs for items without an _id
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: jest.fn(() => "generated-uuid-123")
  }
});

// --- Mock Data ---
const mockSpec1: Speciality = {
  _id: "spec-1",
  name: "Cardiology",
  organisationId: "org-A",
} as unknown as Speciality;

const mockSpec2: Speciality = {
  _id: "spec-2",
  name: "Dermatology",
  organisationId: "org-A",
} as unknown as Speciality;

const mockSpec3: Speciality = {
  _id: "spec-3",
  name: "Radiology",
  organisationId: "org-B",
} as unknown as Speciality;

const mockSpecNoId: Speciality = {
  name: "New Speciality",
  organisationId: "org-A",
} as unknown as Speciality;

describe("Speciality Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useSpecialityStore.setState({
      specialitiesById: {},
      specialityIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useSpecialityStore.getState();
      expect(state.specialitiesById).toEqual({});
      expect(state.specialityIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
    });

    it("manages loading state", () => {
      const store = useSpecialityStore.getState();
      store.startLoading();
      expect(useSpecialityStore.getState().status).toBe("loading");
      expect(useSpecialityStore.getState().error).toBeNull();

      store.endLoading();
      expect(useSpecialityStore.getState().status).toBe("loaded");
    });

    it("sets error state", () => {
      const store = useSpecialityStore.getState();
      store.setError("Failed to fetch specialities");
      expect(useSpecialityStore.getState().status).toBe("error");
      expect(useSpecialityStore.getState().error).toBe("Failed to fetch specialities");
    });

    it("clears the store completely", () => {
      const store = useSpecialityStore.getState();
      store.setSpecialities([mockSpec1]);

      store.clearSpecialities();

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById).toEqual({});
      expect(state.specialityIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
    });
  });

  // --- Section 2: Bulk Operations (Set & Get) ---
  describe("Bulk Operations", () => {
    it("sets all specialities globally and indexes them correctly", () => {
      const store = useSpecialityStore.getState();
      store.setSpecialities([mockSpec1, mockSpec2, mockSpec3]);

      const state = useSpecialityStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.specialitiesById["spec-1"]).toEqual(mockSpec1);
      expect(state.specialitiesById["spec-3"]).toEqual(mockSpec3);

      // Verify indexing
      expect(state.specialityIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.specialityIdsByOrgId["org-A"]).toContain("spec-1");
      expect(state.specialityIdsByOrgId["org-A"]).toContain("spec-2");
      expect(state.specialityIdsByOrgId["org-B"]).toHaveLength(1);
    });

    it("generates UUIDs for specialities without IDs", () => {
      const store = useSpecialityStore.getState();
      store.setSpecialities([mockSpecNoId]);

      const state = useSpecialityStore.getState();
      // Should use the mocked UUID
      expect(state.specialitiesById["generated-uuid-123"]).toBeDefined();
      expect(state.specialityIdsByOrgId["org-A"]).toContain("generated-uuid-123");
    });

    it("sets specialities for a specific organization specifically", () => {
      // Setup initial state with Org A and Org B
      useSpecialityStore.getState().setSpecialities([mockSpec1, mockSpec3]);

      // Update ONLY Org A (replace spec-1 with spec-2)
      useSpecialityStore.getState().setSpecialitiesForOrg("org-A", [mockSpec2]);

      const state = useSpecialityStore.getState();

      // Org A should now only have spec-2
      expect(state.specialityIdsByOrgId["org-A"]).toEqual(["spec-2"]);
      expect(state.specialitiesById["spec-1"]).toBeUndefined(); // Should be removed
      expect(state.specialitiesById["spec-2"]).toBeDefined();   // Should be added

      // Org B should remain untouched
      expect(state.specialityIdsByOrgId["org-B"]).toEqual(["spec-3"]);
      expect(state.specialitiesById["spec-3"]).toBeDefined();
    });

    it("retrieves specialities by Org ID", () => {
      useSpecialityStore.getState().setSpecialities([mockSpec1, mockSpec2, mockSpec3]);

      const orgASpecs = useSpecialityStore.getState().getSpecialitiesByOrgId("org-A");
      expect(orgASpecs).toHaveLength(2);
      expect(orgASpecs.find(s => s._id === "spec-1")).toBeDefined();

      // Non-existent Org
      expect(useSpecialityStore.getState().getSpecialitiesByOrgId("org-C")).toEqual([]);
    });
  });

  // --- Section 3: CRUD Operations (Add/Update) ---
  describe("CRUD Operations", () => {
    it("adds a new speciality with an existing ID", () => {
      const store = useSpecialityStore.getState();
      store.addSpeciality(mockSpec1);

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["spec-1"]).toBeDefined();
      expect(state.specialityIdsByOrgId["org-A"]).toContain("spec-1");
    });

    it("adds a new speciality and generates an ID if missing", () => {
      const store = useSpecialityStore.getState();
      store.addSpeciality(mockSpecNoId);

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["generated-uuid-123"]).toBeDefined();
      expect(state.specialityIdsByOrgId["org-A"]).toContain("generated-uuid-123");
    });

    it("does not duplicate ID in index if adding same speciality twice", () => {
      const store = useSpecialityStore.getState();
      store.addSpeciality(mockSpec1);
      store.addSpeciality(mockSpec1); // Add again

      const state = useSpecialityStore.getState();
      expect(state.specialityIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("updates an existing speciality", () => {
      const store = useSpecialityStore.getState();
      store.addSpeciality(mockSpec1);

      const updated = { ...mockSpec1, name: "Updated Name" };
      store.updateSpeciality(updated);

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["spec-1"].name).toBe("Updated Name");
    });

    it("warns and ignores update if ID is missing or not found", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useSpecialityStore.getState();

      // Update non-existent item
      store.updateSpeciality(mockSpec1);

      const state = useSpecialityStore.getState();
      expect(Object.keys(state.specialitiesById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "updateSpeciality: speciality not found:",
        mockSpec1
      );
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: Removal & Cleanup ---
  describe("Removal & Cleanup", () => {
    it("clears all specialities for a specific organization", () => {
      useSpecialityStore.getState().setSpecialities([mockSpec1, mockSpec3]);

      useSpecialityStore.getState().clearSpecialitiesForOrg("org-A");

      const state = useSpecialityStore.getState();
      // Org A data gone
      expect(state.specialityIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.specialitiesById["spec-1"]).toBeUndefined();

      // Org B data remains
      expect(state.specialityIdsByOrgId["org-B"]).toBeDefined();
      expect(state.specialitiesById["spec-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useSpecialityStore.getState().setSpecialities([mockSpec1]);

      // Clear empty org
      useSpecialityStore.getState().clearSpecialitiesForOrg("org-Empty");

      const state = useSpecialityStore.getState();
      expect(state.specialityIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.specialitiesById["spec-1"]).toBeDefined();
    });
  });
});