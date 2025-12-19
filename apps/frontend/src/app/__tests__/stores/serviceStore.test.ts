import { useServiceStore } from "../../stores/serviceStore";
import { Service } from "@yosemite-crew/types";

// --- Mock Data ---
// Casting to unknown first to avoid strict type errors for missing properties
const mockService1: Service = {
  id: "srv-1",
  name: "Vaccination",
  organisationId: "org-A",
  specialityId: "spec-X",
  duration: 30,
} as unknown as Service;

const mockService2: Service = {
  id: "srv-2",
  name: "Surgery",
  organisationId: "org-A",
  specialityId: "spec-Y",
  duration: 60,
} as unknown as Service;

const mockService3: Service = {
  id: "srv-3",
  name: "Grooming",
  organisationId: "org-B",
  specialityId: "spec-X", // Same speciality as srv-1 but diff org
  duration: 45,
} as unknown as Service;

const mockServiceNoSpec: Service = {
  id: "srv-4",
  name: "General Checkup",
  organisationId: "org-A",
  // No specialityId
} as unknown as Service;

const mockServiceNoId: Service = {
  name: "Fallback Name Service",
  organisationId: "org-A",
} as unknown as Service;

describe("Service Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useServiceStore.setState({
      servicesById: {},
      serviceIdsByOrgId: {},
      serviceIdsBySpecialityId: {},
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization ---
  describe("Initialization", () => {
    it("initializes with default empty state", () => {
      const state = useServiceStore.getState();
      expect(state.servicesById).toEqual({});
      expect(state.serviceIdsByOrgId).toEqual({});
      expect(state.serviceIdsBySpecialityId).toEqual({});
    });

    it("clears the entire store", () => {
      const store = useServiceStore.getState();
      store.setServices([mockService1]);

      store.clearServices();

      const state = useServiceStore.getState();
      expect(state.servicesById).toEqual({});
      expect(state.serviceIdsByOrgId).toEqual({});
    });
  });

  // --- Section 2: Bulk Operations (Set & Get) ---
  describe("Bulk Operations", () => {
    it("sets multiple services and builds all indexes", () => {
      const store = useServiceStore.getState();
      // srv-1 (org-A, spec-X), srv-3 (org-B, spec-X), srv-4 (org-A, no spec)
      store.setServices([mockService1, mockService3, mockServiceNoSpec]);

      const state = useServiceStore.getState();

      // Services by ID
      expect(state.servicesById["srv-1"]).toBeDefined();
      expect(state.servicesById["srv-3"]).toBeDefined();
      expect(state.servicesById["srv-4"]).toBeDefined();

      // Org Index
      expect(state.serviceIdsByOrgId["org-A"]).toHaveLength(2); // srv-1, srv-4
      expect(state.serviceIdsByOrgId["org-B"]).toHaveLength(1); // srv-3

      // Speciality Index
      expect(state.serviceIdsBySpecialityId["spec-X"]).toHaveLength(2); // srv-1, srv-3
    });

    it("handles services without IDs (fallback to name)", () => {
      const store = useServiceStore.getState();
      store.setServices([mockServiceNoId]);

      const state = useServiceStore.getState();
      expect(state.servicesById["Fallback Name Service"]).toBeDefined();
      expect(state.serviceIdsByOrgId["org-A"]).toContain("Fallback Name Service");
    });

    it("retrieves services by Org ID", () => {
      useServiceStore.getState().setServices([mockService1, mockService3]);

      const orgAServices = useServiceStore.getState().getServicesByOrgId("org-A");
      expect(orgAServices).toHaveLength(1);
      expect(orgAServices[0].id).toBe("srv-1");

      // Non-existent
      expect(useServiceStore.getState().getServicesByOrgId("org-C")).toEqual([]);
    });

    it("retrieves services by Speciality ID", () => {
      useServiceStore.getState().setServices([mockService1, mockService3]);

      const specXServices = useServiceStore.getState().getServicesBySpecialityId("spec-X");
      expect(specXServices).toHaveLength(2); // srv-1 and srv-3

      // Non-existent
      expect(useServiceStore.getState().getServicesBySpecialityId("spec-Z")).toEqual([]);
    });
  });

  // --- Section 3: CRUD Operations (Add/Update) ---
  describe("CRUD Operations", () => {
    it("adds a new service and updates indexes", () => {
      const store = useServiceStore.getState();
      store.addService(mockService1);

      const state = useServiceStore.getState();
      expect(state.servicesById["srv-1"]).toBeDefined();
      expect(state.serviceIdsByOrgId["org-A"]).toContain("srv-1");
      expect(state.serviceIdsBySpecialityId["spec-X"]).toContain("srv-1");
    });

    it("updates an existing service via addService (Upsert) without duplicating index", () => {
      const store = useServiceStore.getState();
      store.addService(mockService1);

      // Add same service again
      store.addService(mockService1);

      const state = useServiceStore.getState();
      // ID lists should remain length 1
      expect(state.serviceIdsByOrgId["org-A"]).toHaveLength(1);
      expect(state.serviceIdsBySpecialityId["spec-X"]).toHaveLength(1);
    });

    it("adds a service without a speciality", () => {
      const store = useServiceStore.getState();
      store.addService(mockServiceNoSpec);

      const state = useServiceStore.getState();
      expect(state.serviceIdsByOrgId["org-A"]).toContain("srv-4");
      // Should not be in any speciality index
      expect(Object.keys(state.serviceIdsBySpecialityId)).toHaveLength(0);
    });

    it("updates a service using updateService", () => {
      const store = useServiceStore.getState();
      store.addService(mockService1);

      const updated = { ...mockService1, name: "Updated Vax" } as unknown as Service;
      store.updateService(updated);

      const state = useServiceStore.getState();
      expect(state.servicesById["srv-1"].name).toBe("Updated Vax");
    });

    it("ignores updateService for non-existent service", () => {
      const store = useServiceStore.getState();
      const initialSnapshot = JSON.stringify(store);

      store.updateService(mockService1); // Store is empty

      const finalSnapshot = JSON.stringify(useServiceStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });
  });

  // --- Section 4: Complex Set & Removal Logic ---
  describe("Complex Set & Removal", () => {
    it("replaces services for an org and cleans up old indexes (removeFromIndex logic)", () => {
      const store = useServiceStore.getState();
      // Initial: Org A has srv-1 (spec-X) and srv-2 (spec-Y)
      store.setServices([mockService1, mockService2]);

      // Update Org A: Replace with ONLY srv-4 (no spec)
      // expected: srv-1 and srv-2 removed. spec-X and spec-Y indexes cleared.
      store.setServicesForOrg("org-A", [mockServiceNoSpec]);

      const state = useServiceStore.getState();

      // Check Org Index
      expect(state.serviceIdsByOrgId["org-A"]).toEqual(["srv-4"]);

      // Check ID Map
      expect(state.servicesById["srv-1"]).toBeUndefined();
      expect(state.servicesById["srv-2"]).toBeUndefined();
      expect(state.servicesById["srv-4"]).toBeDefined();

      // Check Speciality Index Cleanup
      // spec-X should be empty (or removed)
      expect(state.serviceIdsBySpecialityId["spec-X"]).toEqual([]);
      expect(state.serviceIdsBySpecialityId["spec-Y"]).toEqual([]);
    });

    it("clears services for an org and updates speciality indexes", () => {
      const store = useServiceStore.getState();
      // srv-1 (Org A, Spec X), srv-3 (Org B, Spec X)
      store.setServices([mockService1, mockService3]);

      store.clearServicesForOrg("org-A");

      const state = useServiceStore.getState();

      // Org A gone
      expect(state.serviceIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.servicesById["srv-1"]).toBeUndefined();

      // Org B remains
      expect(state.serviceIdsByOrgId["org-B"]).toEqual(["srv-3"]);
      expect(state.servicesById["srv-3"]).toBeDefined();

      // Spec X index should now only contain srv-3 (srv-1 removed)
      expect(state.serviceIdsBySpecialityId["spec-X"]).toEqual(["srv-3"]);
    });

    it("handles clearing an org with no services safely", () => {
      const store = useServiceStore.getState();
      store.setServices([mockService1]);

      store.clearServicesForOrg("org-Empty");

      const state = useServiceStore.getState();
      expect(state.serviceIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.servicesById["srv-1"]).toBeDefined();
    });

    it("handles removeFromIndex edge case (empty array)", () => {
      // This indirectly tests the `if (!arr.length) return idx` line in removeFromIndex
      // by attempting to clean up indexes for an org that thinks it has IDs but the spec index is empty
      const store = useServiceStore.getState();

      // Manually corrupt state to have an ID in org list but not in spec list
      useServiceStore.setState({
        serviceIdsByOrgId: { "org-A": ["srv-1"] },
        servicesById: { "srv-1": mockService1 },
        serviceIdsBySpecialityId: { "spec-X": [] } // Empty spec index
      });

      // Clearing org A will trigger removal logic for srv-1 (which has spec-X)
      // It attempts to remove srv-1 from spec-X index, which is already empty.
      store.clearServicesForOrg("org-A");

      const state = useServiceStore.getState();
      expect(state.serviceIdsByOrgId["org-A"]).toBeUndefined();
    });
  });
});