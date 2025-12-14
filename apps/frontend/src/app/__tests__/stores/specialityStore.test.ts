import { act } from "@testing-library/react";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { Speciality } from "@yosemite-crew/types";

// --- Mock Data ---

// Fixed: Removed 'description' from mock data objects
const mockSpeciality1: Speciality = {
  _id: "spec-1",
  name: "Cardiology",
  organisationId: "org-A",
} as Speciality;

const mockSpeciality2: Speciality = {
  _id: "spec-2",
  name: "Neurology",
  organisationId: "org-A",
} as Speciality;

const mockSpecialityNoId: Speciality = {
  // Missing _id, should generate one via crypto.randomUUID fallback
  name: "Dermatology",
  organisationId: "org-B",
} as Speciality;

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: jest.fn(() => "generated-uuid"),
  },
});

describe("useSpecialityStore", () => {

  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useSpecialityStore.getState().clearSpecialities();
    });
    jest.clearAllMocks();

    // Suppress console.warn specifically for this suite to avoid
    // triggering the global configuration that throws errors on warnings.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the original console.warn (or the global mock)
    (console.warn as jest.Mock).mockRestore();
  });

  // --- 1. Initialization & Bulk Set ---

  describe("Initialization & setSpecialities", () => {
    it("initializes with default empty state", () => {
      const state = useSpecialityStore.getState();
      expect(state.specialitiesById).toEqual({});
      expect(state.specialityIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });

    it("populates state correctly using setSpecialities", () => {
      act(() => {
        useSpecialityStore.getState().setSpecialities([mockSpeciality1, mockSpeciality2]);
      });

      const state = useSpecialityStore.getState();

      // Check ById Lookup
      expect(state.specialitiesById["spec-1"]).toEqual(mockSpeciality1);
      expect(state.specialitiesById["spec-2"]).toEqual(mockSpeciality2);

      // Check ByOrgId Lookup
      expect(state.specialityIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.specialityIdsByOrgId["org-A"]).toContain("spec-1");
      expect(state.specialityIdsByOrgId["org-A"]).toContain("spec-2");

      expect(state.status).toBe("loaded");
    });

    it("generates ID for specialities without one during setSpecialities", () => {
      act(() => {
        useSpecialityStore.getState().setSpecialities([mockSpecialityNoId]);
      });

      const state = useSpecialityStore.getState();

      // Should use the mocked UUID
      expect(state.specialitiesById["generated-uuid"]).toBeDefined();
      expect(state.specialitiesById["generated-uuid"].name).toBe("Dermatology");
      expect(state.specialityIdsByOrgId["org-B"]).toContain("generated-uuid");
    });
  });

  // --- 2. CRUD Operations ---

  describe("CRUD Actions", () => {
    it("adds a single speciality correctly", () => {
      act(() => {
        useSpecialityStore.getState().addSpeciality(mockSpeciality1);
      });

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["spec-1"]).toEqual(mockSpeciality1);
      expect(state.specialityIdsByOrgId["org-A"]).toEqual(["spec-1"]);
    });

    it("generates ID when adding speciality without one", () => {
      act(() => {
        useSpecialityStore.getState().addSpeciality(mockSpecialityNoId);
      });

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["generated-uuid"]).toBeDefined();
      expect(state.specialityIdsByOrgId["org-B"]).toContain("generated-uuid");
    });

    it("prevents duplicate IDs in org list when adding existing speciality", () => {
      act(() => {
        useSpecialityStore.getState().addSpeciality(mockSpeciality1);
      });
      // Add same speciality again
      act(() => {
        useSpecialityStore.getState().addSpeciality(mockSpeciality1);
      });

      const state = useSpecialityStore.getState();
      // Should still be length 1
      expect(state.specialityIdsByOrgId["org-A"]).toHaveLength(1);
      expect(state.specialityIdsByOrgId["org-A"]).toEqual(["spec-1"]);
    });

    it("updates an existing speciality", () => {
      act(() => {
        useSpecialityStore.getState().setSpecialities([mockSpeciality1]);
      });

      // Fixed: Updating 'name' instead of 'description'
      const updatedData = { ...mockSpeciality1, name: "Updated Name" };

      act(() => {
        useSpecialityStore.getState().updateSpeciality(updatedData);
      });

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["spec-1"].name).toBe("Updated Name");
    });

    it("warns and ignores update if speciality does not exist", () => {
      const nonExistent = { ...mockSpeciality1, _id: "ghost" };

      act(() => {
        useSpecialityStore.getState().updateSpeciality(nonExistent);
      });

      expect(console.warn).toHaveBeenCalledWith(
        "updateSpeciality: speciality not found:",
        nonExistent
      );

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById["ghost"]).toBeUndefined();
    });
  });

  // --- 3. Selectors ---

  describe("Selectors", () => {
    it("getSpecialitiesByOrgId returns correct array", () => {
      act(() => {
        useSpecialityStore.getState().setSpecialities([mockSpeciality1, mockSpeciality2, mockSpecialityNoId]);
      });

      const resultA = useSpecialityStore.getState().getSpecialitiesByOrgId("org-A");
      expect(resultA).toHaveLength(2);
      expect(resultA).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ _id: "spec-1" }),
            expect.objectContaining({ _id: "spec-2" })
        ])
      );

      const resultB = useSpecialityStore.getState().getSpecialitiesByOrgId("org-B");
      expect(resultB).toHaveLength(1);
      expect(resultB[0].name).toBe("Dermatology");
    });

    it("getSpecialitiesByOrgId returns empty array for unknown org", () => {
      const result = useSpecialityStore.getState().getSpecialitiesByOrgId("unknown-org");
      expect(result).toEqual([]);
    });

    it("getSpecialitiesByOrgId filters out undefined entries (safety check)", () => {
        // Manually corrupt state
        useSpecialityStore.setState({
            specialitiesById: {},
            specialityIdsByOrgId: { "org-A": ["missing-id"] }
        });

        const result = useSpecialityStore.getState().getSpecialitiesByOrgId("org-A");
        expect(result).toEqual([]);
    });
  });

  // --- 4. Status & Utility Actions ---

  describe("Status & Utility Actions", () => {
    it("manages loading state correctly", () => {
      act(() => {
        useSpecialityStore.getState().startLoading();
      });
      expect(useSpecialityStore.getState().status).toBe("loading");
      expect(useSpecialityStore.getState().error).toBeNull();

      act(() => {
        useSpecialityStore.getState().endLoading();
      });
      expect(useSpecialityStore.getState().status).toBe("loaded");
      expect(useSpecialityStore.getState().error).toBeNull();
    });

    it("sets error state correctly", () => {
      act(() => {
        useSpecialityStore.getState().setError("Network Error");
      });
      expect(useSpecialityStore.getState().status).toBe("error");
      expect(useSpecialityStore.getState().error).toBe("Network Error");
    });

    it("clears specialities and resets state", () => {
      act(() => {
        useSpecialityStore.getState().setSpecialities([mockSpeciality1]);
        useSpecialityStore.getState().startLoading();
      });

      act(() => {
        useSpecialityStore.getState().clearSpecialities();
      });

      const state = useSpecialityStore.getState();
      expect(state.specialitiesById).toEqual({});
      expect(state.specialityIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });
  });
});