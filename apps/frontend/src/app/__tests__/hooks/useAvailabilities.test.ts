import { renderHook } from "@testing-library/react";
import { useLoadAvailabilities, usePrimaryAvailability } from "@/app/hooks/useAvailabiities";
import { useOrgStore } from "@/app/stores/orgStore";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { loadAvailability } from "@/app/services/availability";

jest.mock("@/app/stores/orgStore", () => ({ useOrgStore: jest.fn() }));
jest.mock("@/app/stores/availabilityStore", () => ({ useAvailabilityStore: jest.fn() }));
jest.mock("@/app/services/availability", () => ({
  loadAvailability: jest.fn(),
}));
jest.mock("@/app/components/Availability/utils", () => ({
  ...jest.requireActual("@/app/components/Availability/utils"),
  convertFromGetApi: jest.fn((items) => items),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseAvailabilityStore = useAvailabilityStore as unknown as jest.Mock;

describe("useLoadAvailabilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ orgIds: ["org-1"] })
    );
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ status: "idle" })
    );
  });

  it("loads availability when idle and orgs exist", () => {
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).toHaveBeenCalled();
  });

  it("skips load when no orgs or already loading", () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: [] }));
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();

    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ orgIds: ["org-1"] })
    );
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ status: "loading" })
    );
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();
  });
});

describe("usePrimaryAvailability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no primary org", () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ availabilityIdsByOrgId: {}, availabilitiesById: {} })
    );
    const { result } = renderHook(() => usePrimaryAvailability());
    expect(result.current.availabilities).toBeNull();
  });

  it("maps ids to availability objects", () => {
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ primaryOrgId: "org-1" })
    );
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { "org-1": ["a1"] },
        availabilitiesById: { a1: { id: "a1" } },
      })
    );
    const { result } = renderHook(() => usePrimaryAvailability());
    expect(result.current.availabilities).toEqual([{ id: "a1" }]);
  });
});
