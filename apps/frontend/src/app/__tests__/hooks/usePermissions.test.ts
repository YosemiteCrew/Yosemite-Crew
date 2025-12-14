import { renderHook } from "@testing-library/react";
import { usePermissions, useHasPermission } from "@/app/hooks/usePermissions";
import { useOrgStore } from "@/app/stores/orgStore";

// --- Mocks ---

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

describe("usePermissions Hook", () => {
  const mockMemberships = {
    "org-1": {
      // Cast as any to bypass strict Permission type checking for test data
      effectivePermissions: ["perm:read", "perm:write"] as any,
    },
    "org-2": {
      effectivePermissions: ["perm:admin"] as any,
    },
  };

  const setupStore = (
    primaryOrgId: string | null = "org-1",
    status: string = "idle",
    memberships = mockMemberships
  ) => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId,
        membershipsByOrgId: memberships,
        status,
      })
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Basic State & ID Resolution ---

  it("resolves permissions from primaryOrgId by default", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.permissions).toEqual(["perm:read", "perm:write"]);
    expect(result.current.activeOrgId).toBe("org-1");
  });

  it("resolves permissions from explicitly passed orgId", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions("org-2"));

    expect(result.current.permissions).toEqual(["perm:admin"]);
    expect(result.current.activeOrgId).toBe("org-2");
  });

  it("returns empty permissions if no active org", () => {
    setupStore(null);
    const { result } = renderHook(() => usePermissions());

    expect(result.current.permissions).toEqual([]);
    expect(result.current.activeOrgId).toBeNull();
  });

  it("returns empty permissions if org membership does not exist", () => {
    setupStore("org-missing");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.permissions).toEqual([]);
  });

  it("reflects loading state correctly", () => {
    setupStore("org-1", "loading");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.isLoading).toBe(true);
  });

  // --- 2. Logic: hasPermission / Single Permission Check ---

  it("can() checks single string permission", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can("perm:read" as any)).toBe(true);
    expect(result.current.can("perm:admin" as any)).toBe(false);
  });

  // --- 3. Logic: canAll (Array Input) ---

  it("canAll() returns true only if ALL permissions match", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    // Both present
    expect(result.current.canAll(["perm:read", "perm:write"] as any)).toBe(true);
    // One missing
    expect(result.current.canAll(["perm:read", "perm:admin"] as any)).toBe(false);
  });

  it("canAll() handles single item input gracefully", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.canAll("perm:read" as any)).toBe(true);
  });

  it("canAll() returns false for empty input", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.canAll([] as any)).toBe(false);
  });

  it("can() delegates array input to canAll (implicit AND)", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can(["perm:read", "perm:write"] as any)).toBe(true);
    expect(result.current.can(["perm:read", "perm:missing"] as any)).toBe(false);
  });

  // --- 4. Logic: canAny (Array Input) ---

  it("canAny() returns true if AT LEAST ONE permission matches", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    // One match
    expect(result.current.canAny(["perm:read", "perm:admin"] as any)).toBe(true);
    // No match
    expect(result.current.canAny(["perm:missing", "perm:admin"] as any)).toBe(false);
  });

  it("canAny() handles single item input gracefully", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAny("perm:read" as any)).toBe(true);
  });

  it("canAny() returns false for empty input", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAny([] as any)).toBe(false);
  });

  // --- 5. Complex Logic: can({ anyOf, allOf }) ---

  it("can() supports 'anyOf' object input", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    // Has one of them
    expect(result.current.can({ anyOf: ["perm:read", "perm:admin"] } as any)).toBe(true);
    // Has none
    expect(result.current.can({ anyOf: ["perm:missing"] } as any)).toBe(false);
  });

  it("can() supports 'allOf' object input", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    // Has both
    expect(result.current.can({ allOf: ["perm:read", "perm:write"] } as any)).toBe(true);
    // Missing one
    expect(result.current.can({ allOf: ["perm:read", "perm:admin"] } as any)).toBe(false);
  });

  it("can() supports combined 'anyOf' AND 'allOf'", () => {
    setupStore("org-1"); // Has read, write
    const { result } = renderHook(() => usePermissions());

    // Success case: Meets "any" condition AND meets "all" condition
    expect(
      result.current.can({
        anyOf: ["perm:read", "perm:admin"], // Needs one of these (has read) -> Pass
        allOf: ["perm:write"], // Needs all of these (has write) -> Pass
      } as any)
    ).toBe(true);

    // Fail case: Fails 'anyOf'
    expect(
      result.current.can({
        anyOf: ["perm:admin"], // Missing -> Fail
        allOf: ["perm:write"],
      } as any)
    ).toBe(false);

    // Fail case: Fails 'allOf'
    expect(
      result.current.can({
        anyOf: ["perm:read"],
        allOf: ["perm:admin"], // Missing -> Fail
      } as any)
    ).toBe(false);
  });

  it("can() returns false if both lists in object are empty/undefined", () => {
    setupStore("org-1");
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can({} as any)).toBe(false);
    expect(result.current.can({ anyOf: [], allOf: [] } as any)).toBe(false);
  });

  // --- 6. Helper Hook: useHasPermission ---

  it("useHasPermission returns boolean directly", () => {
    setupStore("org-1");
    const { result } = renderHook(() => useHasPermission("perm:read" as any));

    expect(result.current).toBe(true);
  });

  it("useHasPermission handles array input", () => {
    setupStore("org-1");
    const { result } = renderHook(() => useHasPermission(["perm:read", "perm:admin"] as any));
    // Default array behavior in `can` is `canAll`
    expect(result.current).toBe(false);
  });
});