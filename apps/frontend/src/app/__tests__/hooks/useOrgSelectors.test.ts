import { renderHook } from "@testing-library/react";
import {
  useOrgList,
  useOrgWithMemberships,
  usePrimaryOrg,
  usePrimaryOrgWithMembership,
} from "@/app/hooks/useOrgSelectors";
import { useOrgStore } from "@/app/stores/orgStore";

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;

const orgsById = {
  "org-1": { _id: "org-1", name: "Org 1" },
  "org-2": { _id: "org-2", name: "Org 2" },
};

const membershipsByOrgId = {
  "org-1": { roleCode: "OWNER" },
};

const setupStore = (overrides: Record<string, any> = {}) => {
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({
      orgIds: ["org-1", "org-2"],
      orgsById,
      membershipsByOrgId,
      primaryOrgId: "org-1",
      ...overrides,
    })
  );
};

describe("useOrgSelectors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns org list in order", () => {
    setupStore();
    const { result } = renderHook(() => useOrgList());
    expect(result.current).toEqual([orgsById["org-1"], orgsById["org-2"]]);
  });

  it("returns orgs with memberships", () => {
    setupStore();
    const { result } = renderHook(() => useOrgWithMemberships());
    expect(result.current).toEqual([
      { org: orgsById["org-1"], membership: membershipsByOrgId["org-1"] },
      { org: orgsById["org-2"], membership: null },
    ]);
  });

  it("returns primary org and membership", () => {
    setupStore();
    const primaryOrgResult = renderHook(() => usePrimaryOrg()).result;
    expect(primaryOrgResult.current).toEqual(orgsById["org-1"]);

    const { result } = renderHook(() => usePrimaryOrgWithMembership());
    expect(result.current).toEqual({
      org: orgsById["org-1"],
      membership: membershipsByOrgId["org-1"],
    });
  });

  it("returns nulls when primary org not set", () => {
    setupStore({ primaryOrgId: null });
    const { result } = renderHook(() => usePrimaryOrgWithMembership());
    expect(result.current).toEqual({ org: null, membership: null });
  });
});
