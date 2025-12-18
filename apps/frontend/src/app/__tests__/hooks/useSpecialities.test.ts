import { renderHook } from "@testing-library/react";
import {
  useLoadSpecialitiesForPrimaryOrg,
  useSpecialitiesForPrimaryOrg,
  useServicesForPrimaryOrgSpecialities,
  useSpecialitiesWithServiceNamesForPrimaryOrg,
} from "../../hooks/useSpecialities";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { useServiceStore } from "../../stores/serviceStore";
import { loadSpecialitiesForOrg } from "@/app/services/specialityService";

// --- Mocks ---

jest.mock("@/app/stores/orgStore");
jest.mock("@/app/stores/specialityStore");
jest.mock("../../stores/serviceStore");
jest.mock("@/app/services/specialityService", () => ({
  loadSpecialitiesForOrg: jest.fn(),
}));

describe("useSpecialities Hooks", () => {
  let mockOrgState: any;
  let mockSpecialityState: any;
  let mockServiceState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = { primaryOrgId: null };

    mockSpecialityState = {
      specialitiesById: {},
      specialityIdsByOrgId: {},
    };

    mockServiceState = {
      servicesById: {},
      serviceIdsBySpecialityId: {},
    };

    // Setup Store Mocks (Zustand selector pattern)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useSpecialityStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockSpecialityState)
    );
    (useServiceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockServiceState)
    );
  });

  // --- Section 1: useLoadSpecialitiesForPrimaryOrg ---

  describe("useLoadSpecialitiesForPrimaryOrg", () => {
    it("should trigger service call when primaryOrgId is set", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadSpecialitiesForPrimaryOrg());

      expect(loadSpecialitiesForOrg).toHaveBeenCalledWith({ force: true });
      expect(loadSpecialitiesForOrg).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger service call when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadSpecialitiesForPrimaryOrg());

      expect(loadSpecialitiesForOrg).not.toHaveBeenCalled();
    });

    it("should re-trigger service call when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadSpecialitiesForPrimaryOrg());

      expect(loadSpecialitiesForOrg).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadSpecialitiesForOrg).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useSpecialitiesForPrimaryOrg ---

  describe("useSpecialitiesForPrimaryOrg", () => {
    const mockSpecialities = {
      "spec-1": { id: "spec-1", name: "Cardiology" },
      "spec-2": { id: "spec-2", name: "Neurology" },
    };

    it("should return empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      mockSpecialityState.specialitiesById = mockSpecialities;
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1"] };

      const { result } = renderHook(() => useSpecialitiesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return mapped specialities for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-2"] };

      const { result } = renderHook(() => useSpecialitiesForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { id: "spec-1", name: "Cardiology" },
        { id: "spec-2", name: "Neurology" },
      ]);
    });

    it("should filter out undefined specialities (broken IDs)", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      // 'spec-99' exists in list but not in map
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-99"] };

      const { result } = renderHook(() => useSpecialitiesForPrimaryOrg());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockSpecialities["spec-1"]);
    });

    it("should return empty array if no specialities exist for org", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      mockSpecialityState.specialityIdsByOrgId = {}; // No entry for org-1

      const { result } = renderHook(() => useSpecialitiesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });
  });

  // --- Section 3: useServicesForPrimaryOrgSpecialities ---

  describe("useServicesForPrimaryOrgSpecialities", () => {
    const mockServices = {
      "svc-1": { id: "svc-1", name: "Consultation" },
      "svc-2": { id: "svc-2", name: "Surgery" },
    };

    it("should return empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      const { result } = renderHook(() => useServicesForPrimaryOrgSpecialities());
      expect(result.current).toEqual([]);
    });

    it("should aggregate services from all specialities of the org", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-2"] };

      mockServiceState.serviceIdsBySpecialityId = {
        "spec-1": ["svc-1"],
        "spec-2": ["svc-2"],
      };
      mockServiceState.servicesById = mockServices;

      const { result } = renderHook(() => useServicesForPrimaryOrgSpecialities());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual(expect.arrayContaining([
        { id: "svc-1", name: "Consultation" },
        { id: "svc-2", name: "Surgery" },
      ]));
    });

    it("should handle specialities with no services", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-empty"] };

      mockServiceState.serviceIdsBySpecialityId = {
        "spec-1": ["svc-1"],
        // spec-empty is missing from map or has empty array
      };
      mockServiceState.servicesById = mockServices;

      const { result } = renderHook(() => useServicesForPrimaryOrgSpecialities());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockServices["svc-1"]);
    });

    it("should filter out undefined services (broken IDs)", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1"] };

      mockServiceState.serviceIdsBySpecialityId = {
        "spec-1": ["svc-1", "svc-broken"],
      };
      mockServiceState.servicesById = mockServices;

      const { result } = renderHook(() => useServicesForPrimaryOrgSpecialities());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(mockServices["svc-1"]);
    });
  });

  // --- Section 4: useSpecialitiesWithServiceNamesForPrimaryOrg ---

  describe("useSpecialitiesWithServiceNamesForPrimaryOrg", () => {
    const mockSpecialities = {
      "spec-1": { _id: "spec-1", name: "Cardiology" },
      "spec-2": { _id: "spec-2", name: "Neurology" },
    };
    const mockServices = {
      "svc-1": { _id: "svc-1", name: "Heart Check", specialityId: "spec-1" },
      "svc-2": { _id: "svc-2", name: "Brain Scan", specialityId: "spec-2" },
      "svc-3": { _id: "svc-3", name: "ECG", specialityId: "spec-1" },
    };

    it("should return empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      const { result } = renderHook(() => useSpecialitiesWithServiceNamesForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it("should combine specialities with their filtered services", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-2"] };
      mockServiceState.servicesById = mockServices;

      const { result } = renderHook(() => useSpecialitiesWithServiceNamesForPrimaryOrg());

      expect(result.current).toHaveLength(2);

      // Check Spec 1 (Cardiology) - should have 2 services
      const spec1 = result.current.find((s) => s._id === "spec-1");
      expect(spec1).toBeDefined();
      expect(spec1?.services).toHaveLength(2);
      expect(spec1?.services).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "Heart Check" }),
        expect.objectContaining({ name: "ECG" }),
      ]));

      // Check Spec 2 (Neurology) - should have 1 service
      const spec2 = result.current.find((s) => s._id === "spec-2");
      expect(spec2).toBeDefined();
      expect(spec2?.services).toHaveLength(1);
    });

    it("should handle broken speciality references gracefully", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      // spec-broken exists in ID list but not in map
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1", "spec-broken"] };
      mockServiceState.servicesById = mockServices;

      const { result } = renderHook(() => useSpecialitiesWithServiceNamesForPrimaryOrg());

      // Should skip the broken one
      expect(result.current).toHaveLength(1);
      expect(result.current[0]._id).toBe("spec-1");
    });

    it("should return empty services array if no services match speciality", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockSpecialityState.specialitiesById = mockSpecialities;
      mockSpecialityState.specialityIdsByOrgId = { "org-1": ["spec-1"] };

      // Services exist but point to OTHER specialities (or none at all)
      mockServiceState.servicesById = {
        "svc-2": { _id: "svc-2", name: "Brain Scan", specialityId: "spec-2" }
      };

      const { result } = renderHook(() => useSpecialitiesWithServiceNamesForPrimaryOrg());

      expect(result.current).toHaveLength(1);
      expect(result.current[0].services).toEqual([]);
    });
  });
});