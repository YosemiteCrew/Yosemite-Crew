import { useOrgStore } from "../../stores/orgStore";
import { Organisation, UserOrganization } from "@yosemite-crew/types";

// --- Mock Data ---
const mockOrg1: Organisation = {
  _id: "org-1",
  name: "Yosemite Vet",
  type: "HOSPITAL",
  isActive: true,
} as unknown as Organisation;

const mockOrg2: Organisation = {
  _id: "org-2",
  name: "Sequoia Grooming",
  type: "GROOMER",
  isActive: true,
} as unknown as Organisation;

// Org with no _id, should fall back to name as ID
const mockOrgNoId: Organisation = {
  name: "Fallback Name Org",
  type: "BREEDER",
} as unknown as Organisation;

const mockMapping1: UserOrganization = {
  userId: "user-1",
  organizationReference: "org-1",
  role: "OWNER",
} as unknown as UserOrganization;

describe("Organization Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
    localStorage.clear();
  });

  // --- Section 1: Initialization, Status & Persistence ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useOrgStore.getState();
      expect(state.orgsById).toEqual({});
      expect(state.orgIds).toEqual([]);
      expect(state.primaryOrgId).toBeNull();
      expect(state.status).toBe("idle");
    });

    it("manages loading state", () => {
      const store = useOrgStore.getState();
      store.startLoading();
      expect(useOrgStore.getState().status).toBe("loading");
      expect(useOrgStore.getState().error).toBeNull();

      store.endLoading();
      expect(useOrgStore.getState().status).toBe("loaded");
    });

    it("sets error state", () => {
      const store = useOrgStore.getState();
      store.setError("Failed to fetch orgs");
      expect(useOrgStore.getState().status).toBe("error");
      expect(useOrgStore.getState().error).toBe("Failed to fetch orgs");
    });

    it("clears the store completely", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      store.clearOrgs();

      const state = useOrgStore.getState();
      expect(state.orgsById).toEqual({});
      expect(state.orgIds).toEqual([]);
      expect(state.primaryOrgId).toBeNull();
      expect(state.status).toBe("idle");
    });
  });

  // --- Section 2: Organization CRUD Operations ---
  describe("Organization CRUD", () => {
    it("sets multiple organizations and resolves IDs correctly", () => {
      const store = useOrgStore.getState();
      // Test standard ID vs Name-as-ID fallback
      store.setOrgs([mockOrg1, mockOrgNoId]);

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"]).toBeDefined();
      expect(state.orgsById["Fallback Name Org"]).toBeDefined(); // ID resolved from name
      expect(state.orgIds).toContain("org-1");
      expect(state.orgIds).toContain("Fallback Name Org");
      expect(state.status).toBe("loaded");
    });

    it("upserts (adds) a new organization", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      store.upsertOrg(mockOrg2);

      const state = useOrgStore.getState();
      expect(state.orgsById["org-2"]).toBeDefined();
      expect(state.orgIds).toContain("org-2");
      expect(state.orgIds).toHaveLength(2);
    });

    it("upserts (updates) an existing organization", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      const updatedOrg1 = { ...mockOrg1, name: "Yosemite Vet Updated" };
      store.upsertOrg(updatedOrg1);

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"].name).toBe("Yosemite Vet Updated");
      expect(state.orgIds).toHaveLength(1); // Should not duplicate ID
    });

    it("updates an organization via partial patch", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      store.updateOrg("org-1", { isActive: false });

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"].isActive).toBe(false);
      expect(state.orgsById["org-1"].name).toBe("Yosemite Vet"); // Other fields remain
    });

    it("handles updateOrg for non-existent ID gracefully", () => {
      const store = useOrgStore.getState();
      store.updateOrg("fake-id", { isActive: false });

      const state = useOrgStore.getState();
      expect(Object.keys(state.orgsById)).toHaveLength(0);
    });

    it("removes an organization", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);

      store.removeOrg("org-1");

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"]).toBeUndefined();
      expect(state.orgsById["org-2"]).toBeDefined();
      expect(state.orgIds).toEqual(["org-2"]);
    });

    it("handles removing non-existent org gracefully", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      store.removeOrg("fake-id");

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"]).toBeDefined();
    });

    it("retrieves org by ID", () => {
      useOrgStore.getState().setOrgs([mockOrg1]);
      expect(useOrgStore.getState().getOrgById("org-1")).toEqual(expect.objectContaining({ name: "Yosemite Vet" }));
      expect(useOrgStore.getState().getOrgById("missing")).toBeNull();
    });
  });

  // --- Section 3: Primary Organization Logic ---
  describe("Primary Org Logic", () => {
    it("automatically sets the first org as primary if none selected", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);

      expect(useOrgStore.getState().primaryOrgId).toBe("org-1");
    });

    it("manually sets primary org", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);

      store.setPrimaryOrg("org-2");
      expect(useOrgStore.getState().primaryOrgId).toBe("org-2");
    });

    it("ignores setting primary org to invalid ID", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      store.setPrimaryOrg("fake-id");
      expect(useOrgStore.getState().primaryOrgId).toBe("org-1"); // Stays as org-1
    });

    it("keeps existing primary if keepPrimaryIfPresent option is true", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);
      store.setPrimaryOrg("org-2"); // Explicitly set to 2

      // Refresh list, usually would reset to index 0, but we pass flag
      store.setOrgs([mockOrg1, mockOrg2], { keepPrimaryIfPresent: true });

      expect(useOrgStore.getState().primaryOrgId).toBe("org-2");
    });

    it("resets primary if keepPrimaryIfPresent is true but ID is missing in new list", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);
      store.setPrimaryOrg("org-2");

      // New list only has org-1. Org-2 (current primary) is gone.
      store.setOrgs([mockOrg1], { keepPrimaryIfPresent: true });

      expect(useOrgStore.getState().primaryOrgId).toBe("org-1"); // Fallback to first available
    });

    it("updates primary org when the current primary is removed", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1, mockOrg2]);
      store.setPrimaryOrg("org-1");

      store.removeOrg("org-1");

      const state = useOrgStore.getState();
      expect(state.orgsById["org-1"]).toBeUndefined();
      expect(state.primaryOrgId).toBe("org-2"); // Should shift to next available
    });

    it("retrieves the primary org object", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      const primary = store.getPrimaryOrg();
      expect(primary?._id).toBe("org-1");
    });

    it("returns null for getPrimaryOrg if no orgs exist", () => {
      const store = useOrgStore.getState();
      expect(store.getPrimaryOrg()).toBeNull();
    });
  });

  // --- Section 4: Membership & Mapping Operations ---
  describe("Membership & Mappings", () => {
    it("sets user organization mappings", () => {
      const store = useOrgStore.getState();
      store.setUserOrgMappings([mockMapping1]);

      const state = useOrgStore.getState();
      expect(state.membershipsByOrgId["org-1"]).toEqual(mockMapping1);
    });

    it("upserts a single user org mapping", () => {
      const store = useOrgStore.getState();
      const newMapping = { ...mockMapping1, role: "ADMIN" } as unknown as UserOrganization;

      store.upsertUserOrgMapping(newMapping);

      const state = useOrgStore.getState();
      // FIX: Cast to 'any' to avoid strict check on 'role' property
      expect((state.membershipsByOrgId["org-1"] as any).role).toBe("ADMIN");
    });

    it("retrieves mapping by org ID", () => {
      const store = useOrgStore.getState();
      store.setUserOrgMappings([mockMapping1]);

      expect(store.getUserOrgMappingsByOrgId("org-1")).toEqual(mockMapping1);
      expect(store.getUserOrgMappingsByOrgId("org-2")).toBeNull();
    });

    it("retrieves combined org and membership data", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);
      store.setUserOrgMappings([mockMapping1]);

      const result = store.getCombinedUserOrgByOrgId("org-1");
      expect(result).not.toBeNull();
      expect(result?.org._id).toBe("org-1");
      // FIX: Cast to 'any' to avoid strict check on 'role' property
      expect((result?.membership as any)?.role).toBe("OWNER");
    });

    it("returns null for combined data if org does not exist", () => {
      const store = useOrgStore.getState();
      store.setUserOrgMappings([mockMapping1]); // Membership exists but Org data missing

      const result = store.getCombinedUserOrgByOrgId("org-1");
      expect(result).toBeNull();
    });

    it("returns null membership in combined data if only org exists", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);

      const result = store.getCombinedUserOrgByOrgId("org-1");
      expect(result).not.toBeNull();
      expect(result?.org._id).toBe("org-1");
      expect(result?.membership).toBeNull();
    });

    it("removes membership data when parent org is removed", () => {
      const store = useOrgStore.getState();
      store.setOrgs([mockOrg1]);
      store.setUserOrgMappings([mockMapping1]);

      store.removeOrg("org-1");

      const state = useOrgStore.getState();
      expect(state.membershipsByOrgId["org-1"]).toBeUndefined();
    });
  });
});