import { useCompanionStore } from "@/app/stores/companionStore";
import { StoredCompanion } from "@/app/pages/Companions/types";

// Helper to create mock companions
const createMockCompanion = (
  id: string,
  orgId: string,
  parentId?: string
): StoredCompanion => ({
  id,
  organisationId: orgId,
  name: `Companion ${id}`,
  species: "Dog",
  breed: "Labrador",
  dateOfBirth: new Date(),
  gender: "Male",
  weight: "10",
  weightUnit: "kg",
  microchipNumber: "123",
  bio: "Good boy",
  profileUrl: "",
  files: [],
  parentId: parentId || "", // Type definition might vary, casting typically handles this
} as unknown as StoredCompanion);

describe("companionStore", () => {
  const initialState = useCompanionStore.getState();

  beforeEach(() => {
    useCompanionStore.setState(initialState, true); // Reset store
  });

  // --- 1. Basic Status Actions ---

  it("should handle loading state", () => {
    const { startLoading, endLoading } = useCompanionStore.getState();

    startLoading();
    expect(useCompanionStore.getState().status).toBe("loading");
    expect(useCompanionStore.getState().error).toBeNull();

    endLoading();
    expect(useCompanionStore.getState().status).toBe("loaded");
    expect(useCompanionStore.getState().lastFetchedAt).not.toBeNull();
  });

  it("should handle error state", () => {
    const { setError } = useCompanionStore.getState();
    setError("Something went wrong");

    expect(useCompanionStore.getState().status).toBe("error");
    expect(useCompanionStore.getState().error).toBe("Something went wrong");
  });

  it("should clear all companions", () => {
    const { setCompanions, clearCompanions } = useCompanionStore.getState();
    const c1 = createMockCompanion("c1", "org1");
    setCompanions([c1]);

    expect(useCompanionStore.getState().companionsById["c1"]).toBeDefined();

    clearCompanions();

    const state = useCompanionStore.getState();
    expect(state.companionsById).toEqual({});
    expect(state.companionsIdsByOrgId).toEqual({});
    expect(state.companionIdsByParentId).toEqual({});
    expect(state.status).toBe("idle");
  });

  // --- 2. Set Companions (Bulk Load) ---

  it("should set companions and build indexes correctly", () => {
    const { setCompanions, getCompanionsByOrgId, getCompanionsByParentId } = useCompanionStore.getState();
    const c1 = createMockCompanion("c1", "org1", "p1");
    const c2 = createMockCompanion("c2", "org1", "p2");
    const c3 = createMockCompanion("c3", "org2", "p1");

    setCompanions([c1, c2, c3]);

    const state = useCompanionStore.getState();

    // Check By ID
    expect(state.companionsById["c1"]).toEqual(c1);
    expect(state.companionsById["c3"]).toEqual(c3);

    // Check By Org Index (via selector)
    const org1Companions = getCompanionsByOrgId("org1");
    expect(org1Companions).toHaveLength(2);
    expect(org1Companions.map(c => c.id)).toContain("c1");
    expect(org1Companions.map(c => c.id)).toContain("c2");

    // Check By Parent Index (via selector)
    const p1Companions = getCompanionsByParentId("p1");
    expect(p1Companions).toHaveLength(2); // c1 and c3
    expect(p1Companions.map(c => c.id)).toContain("c1");
    expect(p1Companions.map(c => c.id)).toContain("c3");
  });

  it("should handle setting companions without parentId", () => {
      const { setCompanions } = useCompanionStore.getState();
      // Cast as any to omit parentId if types require it strictly, simulates optional
      const cNoParent = { ...createMockCompanion("c4", "org1"), parentId: undefined };

      setCompanions([cNoParent]);

      const state = useCompanionStore.getState();
      expect(state.companionsById["c4"]).toBeDefined();
      expect(state.companionsIdsByOrgId["org1"]).toContain("c4");
      // Should not exist in any parent index
      expect(Object.keys(state.companionIdsByParentId)).toHaveLength(0);
  });

  // --- 3. Set Companions For Org ---

  it("should replace companions for a specific org", () => {
    const { setCompanions, setCompanionsForOrg } = useCompanionStore.getState();

    // Initial state: Org1 has c1, Org2 has c2
    const c1 = createMockCompanion("c1", "org1", "p1");
    const c2 = createMockCompanion("c2", "org2", "p1");
    setCompanions([c1, c2]);

    // Update Org1: remove c1, add c3
    const c3 = createMockCompanion("c3", "org1", "p1");
    setCompanionsForOrg("org1", [c3]);

    const state = useCompanionStore.getState();

    // c1 should be gone
    expect(state.companionsById["c1"]).toBeUndefined();
    // c2 (Org2) should remain
    expect(state.companionsById["c2"]).toBeDefined();
    // c3 should be added
    expect(state.companionsById["c3"]).toBeDefined();

    // Indexes check
    expect(state.companionsIdsByOrgId["org1"]).toEqual(["c3"]);
    expect(state.companionsIdsByOrgId["org2"]).toEqual(["c2"]);

    // Parent Index check (p1 had c1,c2 -> now c2,c3)
    const p1Ids = state.companionIdsByParentId["p1"];
    expect(p1Ids).not.toContain("c1");
    expect(p1Ids).toContain("c2");
    expect(p1Ids).toContain("c3");
  });

  // --- 4. Upsert (Add/Update) ---

  it("should add a new companion", () => {
    const { upsertCompanion } = useCompanionStore.getState();
    const c1 = createMockCompanion("c1", "org1", "p1");

    upsertCompanion(c1);

    const state = useCompanionStore.getState();
    expect(state.companionsById["c1"]).toEqual(c1);
    expect(state.companionsIdsByOrgId["org1"]).toEqual(["c1"]);
    expect(state.companionIdsByParentId["p1"]).toEqual(["c1"]);
  });

  it("should update an existing companion", () => {
    const { upsertCompanion } = useCompanionStore.getState();
    const c1 = createMockCompanion("c1", "org1", "p1");
    upsertCompanion(c1);

    const c1Updated = { ...c1, name: "Updated Name" };
    upsertCompanion(c1Updated);

    const state = useCompanionStore.getState();
    expect(state.companionsById["c1"].name).toBe("Updated Name");
    // Indexes shouldn't change
    expect(state.companionsIdsByOrgId["org1"]).toHaveLength(1);
  });

  it("should handle parent reassignment (move indexes)", () => {
    const { upsertCompanion } = useCompanionStore.getState();
    // Start with Parent p1
    const c1 = createMockCompanion("c1", "org1", "p1");
    upsertCompanion(c1);

    // Update to Parent p2
    const c1Moved = { ...c1, parentId: "p2" };
    upsertCompanion(c1Moved);

    const state = useCompanionStore.getState();

    // Check p1 is empty
    expect(state.companionIdsByParentId["p1"]).toEqual([]); // or filtered out
    // Check p2 has it
    expect(state.companionIdsByParentId["p2"]).toEqual(["c1"]);
    // ID record updated
    expect(state.companionsById["c1"].parentId).toBe("p2");
  });

  it("should handle upsert with undefined parents", () => {
      const { upsertCompanion } = useCompanionStore.getState();
      // Add with no parent
      const c1 = { ...createMockCompanion("c1", "org1"), parentId: undefined };
      upsertCompanion(c1);

      let state = useCompanionStore.getState();
      expect(state.companionsById["c1"]).toBeDefined();
      expect(Object.keys(state.companionIdsByParentId)).toHaveLength(0);

      // Update to have parent
      const c1WithParent = { ...c1, parentId: "p1" };
      upsertCompanion(c1WithParent);

      state = useCompanionStore.getState();
      expect(state.companionIdsByParentId["p1"]).toEqual(["c1"]);
  });

  // --- 5. Remove ---

  it("should remove a companion and clean indexes", () => {
    const { setCompanions, removeCompanion } = useCompanionStore.getState();
    const c1 = createMockCompanion("c1", "org1", "p1");
    setCompanions([c1]);

    removeCompanion("c1");

    const state = useCompanionStore.getState();
    expect(state.companionsById["c1"]).toBeUndefined();
    expect(state.companionsIdsByOrgId["org1"]).toEqual([]);
    expect(state.companionIdsByParentId["p1"]).toEqual([]);
  });

  it("should do nothing if removing non-existent companion", () => {
    const { removeCompanion } = useCompanionStore.getState();
    // Should not crash
    removeCompanion("non-existent");
    expect(useCompanionStore.getState().companionsById).toEqual({});
  });

  // --- 6. Selectors ---

  it("should return empty array if org or parent not found", () => {
    const { getCompanionsByOrgId, getCompanionsByParentId } = useCompanionStore.getState();
    expect(getCompanionsByOrgId("unknown")).toEqual([]);
    expect(getCompanionsByParentId("unknown")).toEqual([]);
  });

  // --- 7. Internal Helpers (Index Logic via store actions) ---

  it("should not duplicate ids in indexes (addToIndex logic check)", () => {
     // This verifies `if (arr.includes(id)) return idx;` inside addToIndex indirectly
     const { upsertCompanion } = useCompanionStore.getState();
     const c1 = createMockCompanion("c1", "org1", "p1");

     upsertCompanion(c1);
     upsertCompanion(c1); // Call again

     const state = useCompanionStore.getState();
     expect(state.companionsIdsByOrgId["org1"]).toHaveLength(1);
     expect(state.companionIdsByParentId["p1"]).toHaveLength(1);
  });
});