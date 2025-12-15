import { act } from "@testing-library/react";
import { useServiceStore } from "@/app/stores/serviceStore";
import { Service } from "@yosemite-crew/types";

// --- Mock Data ---

const mockService1: Service = {
  id: "serv-1",
  name: "Checkup",
  organisationId: "org-A",
  specialityId: "spec-X",
  description: "General Checkup",
} as Service;

const mockService2: Service = {
  id: "serv-2",
  name: "Surgery",
  organisationId: "org-A",
  specialityId: "spec-Y",
  description: "Major Surgery",
} as Service;

const mockServiceNoId: Service = {
  // Missing 'id', should fallback to 'name'
  name: "Consultation",
  organisationId: "org-B",
  description: "Consult",
} as Service;

describe("useServiceStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useServiceStore.getState().clearServices();
    });
  });

  // --- 1. Initialization & Bulk Set ---

  describe("Initialization & setServices", () => {
    it("initializes with default empty state", () => {
      const state = useServiceStore.getState();
      expect(state.servicesById).toEqual({});
      expect(state.serviceIdsByOrgId).toEqual({});
      expect(state.serviceIdsBySpecialityId).toEqual({});
    });

    it("populates state correctly using setServices", () => {
      act(() => {
        useServiceStore.getState().setServices([mockService1, mockService2]);
      });

      const state = useServiceStore.getState();

      // Check ById Lookup
      expect(state.servicesById["serv-1"]).toEqual(mockService1);
      expect(state.servicesById["serv-2"]).toEqual(mockService2);

      // Check ByOrgId Lookup
      expect(state.serviceIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.serviceIdsByOrgId["org-A"]).toContain("serv-1");
      expect(state.serviceIdsByOrgId["org-A"]).toContain("serv-2");

      // Check BySpecialityId Lookup
      expect(state.serviceIdsBySpecialityId["spec-X"]).toEqual(["serv-1"]);
      expect(state.serviceIdsBySpecialityId["spec-Y"]).toEqual(["serv-2"]);
    });

    it("handles services without explicit ID (uses name as fallback)", () => {
      act(() => {
        useServiceStore.getState().setServices([mockServiceNoId]);
      });

      const state = useServiceStore.getState();
      const fallbackId = mockServiceNoId.name; // "Consultation"

      expect(state.servicesById[fallbackId]).toBeDefined();
      expect(state.servicesById[fallbackId].id).toBe(fallbackId);
      expect(state.serviceIdsByOrgId["org-B"]).toContain(fallbackId);
    });

    it("handles services without specialityId correctly (skips speciality map)", () => {
       const serviceNoSpec = { ...mockService1, id: "serv-3", specialityId: undefined };

       act(() => {
         useServiceStore.getState().setServices([serviceNoSpec]);
       });

       const state = useServiceStore.getState();
       expect(state.servicesById["serv-3"]).toBeDefined();
       // Should be in Org map
       expect(state.serviceIdsByOrgId["org-A"]).toContain("serv-3");
       // Should NOT be in any Speciality map (since undefined)
       // We check that no keys were added for undefined
       expect(Object.keys(state.serviceIdsBySpecialityId)).toHaveLength(0);
    });
  });

  // --- 2. CRUD Operations (Add/Update) ---

  describe("CRUD Actions", () => {
    it("adds a single service correctly", () => {
      act(() => {
        useServiceStore.getState().addService(mockService1);
      });

      const state = useServiceStore.getState();
      expect(state.servicesById["serv-1"]).toEqual(mockService1);
      expect(state.serviceIdsByOrgId["org-A"]).toEqual(["serv-1"]);
      expect(state.serviceIdsBySpecialityId["spec-X"]).toEqual(["serv-1"]);
    });

    it("prevents duplicate IDs when adding existing service (Org & Spec maps)", () => {
      act(() => {
        useServiceStore.getState().addService(mockService1);
      });
      // Add same service again
      act(() => {
        useServiceStore.getState().addService(mockService1);
      });

      const state = useServiceStore.getState();
      // Should still be length 1 in arrays
      expect(state.serviceIdsByOrgId["org-A"]).toHaveLength(1);
      expect(state.serviceIdsBySpecialityId["spec-X"]).toHaveLength(1);
    });

    it("handles adding service without specialityId", () => {
        const noSpecService = { ...mockService1, id: "serv-no-spec", specialityId: undefined };
        act(() => {
            useServiceStore.getState().addService(noSpecService);
        });

        const state = useServiceStore.getState();
        expect(state.servicesById["serv-no-spec"]).toBeDefined();
        // Org map populated
        expect(state.serviceIdsByOrgId["org-A"]).toContain("serv-no-spec");
        // Spec map untouched/empty for this entry
        expect(Object.values(state.serviceIdsBySpecialityId).flat()).not.toContain("serv-no-spec");
    });

    it("updates an existing service", () => {
      act(() => {
        useServiceStore.getState().setServices([mockService1]);
      });

      const updatedData = { ...mockService1, description: "Updated Desc" };

      act(() => {
        useServiceStore.getState().updateService(updatedData);
      });

      const state = useServiceStore.getState();
      expect(state.servicesById["serv-1"].description).toBe("Updated Desc");
    });

    it("ignores update if service does not exist", () => {
      const nonExistentService = { ...mockService1, id: "ghost" };

      act(() => {
        useServiceStore.getState().updateService(nonExistentService);
      });

      const state = useServiceStore.getState();
      expect(state.servicesById["ghost"]).toBeUndefined();
    });
  });

  // --- 3. Selectors ---

  describe("Selectors", () => {
    beforeEach(() => {
        act(() => {
            useServiceStore.getState().setServices([mockService1, mockService2, mockServiceNoId]);
        });
    });

    it("getServicesByOrgId returns correct array", () => {
      const resultA = useServiceStore.getState().getServicesByOrgId("org-A");
      expect(resultA).toHaveLength(2);
      expect(resultA).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ id: "serv-1" }),
            expect.objectContaining({ id: "serv-2" })
        ])
      );

      const resultB = useServiceStore.getState().getServicesByOrgId("org-B");
      expect(resultB).toHaveLength(1);
      expect(resultB[0].name).toBe("Consultation");
    });

    it("getServicesByOrgId returns empty array for unknown org", () => {
      const result = useServiceStore.getState().getServicesByOrgId("unknown-org");
      expect(result).toEqual([]);
    });

    it("getServicesBySpecialityId returns correct array", () => {
        const resultX = useServiceStore.getState().getServicesBySpecialityId("spec-X");
        expect(resultX).toHaveLength(1);
        expect(resultX[0].id).toBe("serv-1");
    });

    it("getServicesBySpecialityId returns empty array for unknown spec", () => {
        const result = useServiceStore.getState().getServicesBySpecialityId("unknown-spec");
        expect(result).toEqual([]);
    });

    it("selectors filter out undefined entries (safety check)", () => {
        // Manually corrupt state to simulate ID in array but missing in record
        useServiceStore.setState({
            servicesById: {},
            serviceIdsByOrgId: { "org-A": ["serv-missing"] },
            serviceIdsBySpecialityId: { "spec-X": ["serv-missing"] }
        });

        const resultOrg = useServiceStore.getState().getServicesByOrgId("org-A");
        expect(resultOrg).toEqual([]);

        const resultSpec = useServiceStore.getState().getServicesBySpecialityId("spec-X");
        expect(resultSpec).toEqual([]);
    });
  });

  // --- 4. Utility Actions ---

  describe("Utility Actions", () => {
    it("clears services and resets state", () => {
      act(() => {
        useServiceStore.getState().setServices([mockService1]);
      });

      act(() => {
        useServiceStore.getState().clearServices();
      });

      const state = useServiceStore.getState();
      expect(state.servicesById).toEqual({});
      expect(state.serviceIdsByOrgId).toEqual({});
      expect(state.serviceIdsBySpecialityId).toEqual({});
    });
  });
});