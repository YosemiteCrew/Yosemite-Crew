import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { ApiDayAvailability } from "@/app/components/Availability/utils";

// Helper to create mock availability objects
const createMockAvailability = (id: string, orgId: string): ApiDayAvailability => ({
  _id: id,
  organisationId: orgId,
  // Removed 'intervals: []' from the mock object to avoid casting issues,
  // relying on the component logic to handle the full object structure.
} as unknown as ApiDayAvailability);

describe("availabilityStore", () => {
  // Reset store before each test to ensure isolation
  beforeEach(() => {
    useAvailabilityStore.setState({
      availabilitiesById: {},
      availabilityIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  // --- 1. Basic Status Actions ---

  it("should handle loading state", () => {
    const { startLoading } = useAvailabilityStore.getState();
    startLoading();

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe("loading");
    expect(state.error).toBeNull();
  });

  it("should handle error state", () => {
    const { setError } = useAvailabilityStore.getState();
    setError("Something went wrong");

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBe("Something went wrong");
  });

  it("should handle end loading state", () => {
    const { endLoading } = useAvailabilityStore.getState();
    endLoading();

    const state = useAvailabilityStore.getState();
    expect(state.status).toBe("loaded");
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("should clear all availabilities", () => {
    const { setAvailabilities, clearAvailabilities } = useAvailabilityStore.getState();
    const item = createMockAvailability("av1", "org1");

    // Setup initial state
    setAvailabilities([item]);
    expect(useAvailabilityStore.getState().availabilitiesById["av1"]).toBeDefined();

    // Clear
    clearAvailabilities();

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById).toEqual({});
    expect(state.availabilityIdsByOrgId).toEqual({});
    expect(state.status).toBe("idle");
    expect(state.lastFetchedAt).toBeNull();
  });

  // --- 2. Set Availabilities (Bulk Load) ---

  it("should set availabilities and map them correctly", () => {
    const { setAvailabilities } = useAvailabilityStore.getState();
    const item1 = createMockAvailability("av1", "org1");
    const item2 = createMockAvailability("av2", "org1");
    const item3 = createMockAvailability("av3", "org2");

    setAvailabilities([item1, item2, item3]);

    const state = useAvailabilityStore.getState();

    // Check ID Map
    expect(state.availabilitiesById["av1"]).toEqual(item1);
    expect(state.availabilitiesById["av2"]).toEqual(item2);
    expect(state.availabilitiesById["av3"]).toEqual(item3);

    // Check Org Indexes
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av1", "av2"]);
    expect(state.availabilityIdsByOrgId["org2"]).toEqual(["av3"]);

    expect(state.status).toBe("loaded");
  });

  // --- 3. Set Availabilities For Specific Org ---

  it("should replace availabilities for a specific org", () => {
    const { setAvailabilities, setAvailabilitiesForOrg } = useAvailabilityStore.getState();

    // Initial state: Org1 has av1, Org2 has av2
    const av1 = createMockAvailability("av1", "org1");
    const av2 = createMockAvailability("av2", "org2");
    setAvailabilities([av1, av2]);

    // Update Org1: Replace av1 with av3
    const av3 = createMockAvailability("av3", "org1");
    setAvailabilitiesForOrg("org1", [av3]);

    const state = useAvailabilityStore.getState();

    // av1 should be deleted from map
    expect(state.availabilitiesById["av1"]).toBeUndefined();
    // av2 (different org) should remain
    expect(state.availabilitiesById["av2"]).toBeDefined();
    // av3 should be added
    expect(state.availabilitiesById["av3"]).toEqual(av3);

    // Indexes
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av3"]);
    expect(state.availabilityIdsByOrgId["org2"]).toEqual(["av2"]);
  });

  it("should handle empty existing ids safely in setAvailabilitiesForOrg", () => {
    const { setAvailabilitiesForOrg } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");

    // No prior state
    setAvailabilitiesForOrg("org1", [av1]);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById["av1"]).toBeDefined();
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av1"]);
  });

  // --- 4. Upsert (Add or Update) ---

  it("should add a new availability via upsert", () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");

    upsertAvailabilityStore(av1);

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById["av1"]).toEqual(av1);
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av1"]);
  });

  it("should update an existing availability via upsert", () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");

    // Initial Add
    upsertAvailabilityStore(av1);

    // Update: Modify a property that should persist the update (using organisationId for this check)
    const newOrgIdForUpdate = "org1-updated";
    const av1Updated = { ...av1, organisationId: newOrgIdForUpdate } as ApiDayAvailability;

    upsertAvailabilityStore(av1Updated);

    const state = useAvailabilityStore.getState();
    // Check if the property was updated
    expect(state.availabilitiesById["av1"].organisationId).toBe(newOrgIdForUpdate);
    // Ensure ID isn't duplicated in index
    expect(state.availabilityIdsByOrgId["org1"]).toHaveLength(1);
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av1"]);
  });

  it("should handle adding to existing index via upsert", () => {
    const { upsertAvailabilityStore } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");
    const av2 = createMockAvailability("av2", "org1"); // Same org

    upsertAvailabilityStore(av1);
    upsertAvailabilityStore(av2);

    const state = useAvailabilityStore.getState();
    expect(state.availabilityIdsByOrgId["org1"]).toEqual(["av1", "av2"]);
  });

  // --- 5. Remove Availability ---

  it("should remove an availability and update index", () => {
    const { setAvailabilities, removeAvailability } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");
    setAvailabilities([av1]);

    removeAvailability("av1");

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById["av1"]).toBeUndefined();
    expect(state.availabilityIdsByOrgId["org1"]).toEqual([]);
  });

  it("should do nothing if removing non-existent availability", () => {
    const { removeAvailability } = useAvailabilityStore.getState();

    // Should not crash or change state
    removeAvailability("ghost-id");

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById).toEqual({});
  });

  it("should handle removal when org index is undefined (edge case safety)", () => {
    // Manually set state with an ID in map but no index (inconsistent state)
    useAvailabilityStore.setState({
      availabilitiesById: { "av1": createMockAvailability("av1", "org1") },
      availabilityIdsByOrgId: {} // Empty index
    });

    const { removeAvailability } = useAvailabilityStore.getState();
    removeAvailability("av1");

    const state = useAvailabilityStore.getState();
    expect(state.availabilitiesById["av1"]).toBeUndefined();
    // Should result in empty array for that org key
    expect(state.availabilityIdsByOrgId["org1"]).toEqual([]);
  });

  // --- 6. Selectors ---

  it("should retrieve availabilities by org ID", () => {
    const { setAvailabilities, getAvailabilitiesByOrgId } = useAvailabilityStore.getState();
    const av1 = createMockAvailability("av1", "org1");
    const av2 = createMockAvailability("av2", "org1");
    const av3 = createMockAvailability("av3", "org2");

    setAvailabilities([av1, av2, av3]);

    const org1Items = getAvailabilitiesByOrgId("org1");
    expect(org1Items).toHaveLength(2);
    expect(org1Items).toEqual([av1, av2]);

    const org2Items = getAvailabilitiesByOrgId("org2");
    expect(org2Items).toHaveLength(1);
    expect(org2Items).toEqual([av3]);

    const emptyItems = getAvailabilitiesByOrgId("org-none");
    expect(emptyItems).toEqual([]);
  });

  it("should filter out undefined items in selector (safety check)", () => {
      useAvailabilityStore.setState({
          availabilitiesById: {},
          availabilityIdsByOrgId: { "org1": ["missing-id"] }
      });

      const { getAvailabilitiesByOrgId } = useAvailabilityStore.getState();
      const items = getAvailabilitiesByOrgId("org1");

      expect(items).toEqual([]);
  });
});