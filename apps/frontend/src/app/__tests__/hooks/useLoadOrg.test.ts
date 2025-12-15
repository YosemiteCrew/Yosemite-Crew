import { renderHook } from "@testing-library/react";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { loadOrgs } from "@/app/services/orgService";

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));
jest.mock("@/app/services/orgService", () => ({
  loadOrgs: jest.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockUseOrgStore = useOrgStore as unknown as jest.Mock;

describe("useLoadOrg", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls loadOrgs when authenticated and org status is idle", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ status: "authenticated" })
    );
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ status: "idle" })
    );

    renderHook(() => useLoadOrg());
    expect(loadOrgs).toHaveBeenCalled();
  });

  it("does not load when unauthenticated or already loading", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ status: "unauthenticated" })
    );
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ status: "idle" })
    );
    renderHook(() => useLoadOrg());
    expect(loadOrgs).not.toHaveBeenCalled();

    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ status: "authenticated" })
    );
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ status: "loading" })
    );
    renderHook(() => useLoadOrg());
    expect(loadOrgs).not.toHaveBeenCalled();
  });
});
