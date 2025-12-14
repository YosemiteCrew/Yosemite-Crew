import { useParentStore } from "@/app/stores/parentStore";
import { StoredParent } from "@/app/pages/Companions/types";
import { act } from "@testing-library/react";

// Mock data
// Fixed: Replaced 'name' with 'firstName' and 'lastName' to match StoredParent type
const mockParent1: StoredParent = {
  id: "parent-1",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "1234567890",
  // Added other potential required fields as optional/safe defaults if needed by type
  organisationId: "org-1",
} as unknown as StoredParent;

const mockParent2: StoredParent = {
  id: "parent-2",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phone: "0987654321",
  organisationId: "org-1",
} as unknown as StoredParent;

describe("useParentStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      useParentStore.getState().clearParents();
    });
  });

  it("should have initial state", () => {
    const state = useParentStore.getState();
    expect(state.parentsById).toEqual({});
    expect(state.parentIds).toEqual([]);
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBeNull();
  });

  it("should set parents correctly", () => {
    act(() => {
      useParentStore.getState().setParents([mockParent1, mockParent2]);
    });

    const state = useParentStore.getState();
    expect(state.parentsById["parent-1"]).toEqual(mockParent1);
    expect(state.parentsById["parent-2"]).toEqual(mockParent2);
    expect(state.parentIds).toEqual(["parent-1", "parent-2"]);
    expect(state.status).toBe("loaded");
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("should upsert (add) a new parent", () => {
    act(() => {
      useParentStore.getState().upsertParent(mockParent1);
    });

    const state = useParentStore.getState();
    expect(state.parentsById["parent-1"]).toEqual(mockParent1);
    expect(state.parentIds).toContain("parent-1");
  });

  it("should upsert (update) an existing parent", () => {
    // Initial Add
    act(() => {
      useParentStore.getState().upsertParent(mockParent1);
    });

    // Update - Fixed: Updating firstName instead of name
    const updatedParent = { ...mockParent1, firstName: "John Updated" };
    act(() => {
      useParentStore.getState().upsertParent(updatedParent);
    });

    const state = useParentStore.getState();
    expect(state.parentsById["parent-1"].firstName).toBe("John Updated");
    // Ensure ID is not duplicated
    expect(state.parentIds).toEqual(["parent-1"]);
  });

  it("should add bulk parents", () => {
    // Start with one parent
    act(() => {
      useParentStore.getState().setParents([mockParent1]);
    });

    // Add another in bulk
    act(() => {
      useParentStore.getState().addBulkParents([mockParent2]);
    });

    const state = useParentStore.getState();
    expect(state.parentIds).toHaveLength(2);
    expect(state.parentsById["parent-2"]).toEqual(mockParent2);
  });

  it("should merge existing parents when adding bulk", () => {
    // Start with parent 1
    act(() => {
      useParentStore.getState().setParents([mockParent1]);
    });

    // Bulk add updated parent 1 + new parent 2
    // Fixed: Updating firstName instead of name
    const updatedParent1 = { ...mockParent1, firstName: "John Bulk Updated" };
    act(() => {
      useParentStore.getState().addBulkParents([updatedParent1, mockParent2]);
    });

    const state = useParentStore.getState();
    expect(state.parentIds).toHaveLength(2);
    expect(state.parentsById["parent-1"].firstName).toBe("John Bulk Updated");
    expect(state.parentsById["parent-2"]).toEqual(mockParent2);
  });

  it("should remove a parent", () => {
    act(() => {
      useParentStore.getState().setParents([mockParent1, mockParent2]);
    });

    act(() => {
      useParentStore.getState().removeParent("parent-1");
    });

    const state = useParentStore.getState();
    expect(state.parentsById["parent-1"]).toBeUndefined();
    expect(state.parentIds).not.toContain("parent-1");
    expect(state.parentIds).toContain("parent-2");
  });

  it("should get all parents as an array", () => {
    act(() => {
      useParentStore.getState().setParents([mockParent1, mockParent2]);
    });

    const parents = useParentStore.getState().getAllParents();
    expect(parents).toHaveLength(2);
    expect(parents).toEqual(expect.arrayContaining([mockParent1, mockParent2]));
  });

  it("should get a parent by id", () => {
    act(() => {
      useParentStore.getState().setParents([mockParent1]);
    });

    const parent = useParentStore.getState().getParentById("parent-1");
    expect(parent).toEqual(mockParent1);
  });

  it("should return null if getting a non-existent parent by id", () => {
    const parent = useParentStore.getState().getParentById("non-existent");
    expect(parent).toBeNull();
  });

  it("should handle loading states", () => {
    act(() => {
      useParentStore.getState().startLoading();
    });
    expect(useParentStore.getState().status).toBe("loading");

    act(() => {
      useParentStore.getState().endLoading();
    });
    expect(useParentStore.getState().status).toBe("loaded");
    expect(useParentStore.getState().lastFetchedAt).not.toBeNull();
  });

  it("should set error state", () => {
    act(() => {
      useParentStore.getState().setError("Failed to fetch");
    });

    const state = useParentStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBe("Failed to fetch");
  });

  it("should clear parents", () => {
    act(() => {
      useParentStore.getState().setParents([mockParent1]);
    });

    act(() => {
      useParentStore.getState().clearParents();
    });

    const state = useParentStore.getState();
    expect(state.parentsById).toEqual({});
    expect(state.parentIds).toEqual([]);
    expect(state.status).toBe("idle");
  });
});