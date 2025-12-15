import { loadAvailability, upsertAvailability } from "@/app/services/availability";
import { useAvailabilityStore } from "@/app/stores/availabilityStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { getData, postData } from "@/app/services/axios";

jest.mock("@/app/services/axios", () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock("@/app/stores/availabilityStore", () => ({
  useAvailabilityStore: {
    getState: jest.fn(),
  },
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

const mockAvailabilityStoreState = {
  setAvailabilitiesForOrg: jest.fn(),
  startLoading: jest.fn(),
  setAvailabilities: jest.fn(),
};

const mockOrgStoreState = {
  primaryOrgId: "org-1",
  orgIds: ["org-1"],
};

(useAvailabilityStore.getState as jest.Mock).mockReturnValue(
  mockAvailabilityStoreState
);
(useOrgStore.getState as jest.Mock).mockReturnValue(mockOrgStoreState);

describe("availability service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("upserts availability for provided orgId", async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { data: [{ id: "a1" }] } });

    await upsertAvailability({} as any, "org-1");

    expect(postData).toHaveBeenCalledWith("/fhir/v1/availability/org-1/base", {});
    expect(mockAvailabilityStoreState.setAvailabilitiesForOrg).toHaveBeenCalledWith(
      "org-1",
      [{ id: "a1" }]
    );
  });

  it("loads availability across orgs", async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { data: [{ id: "a1" }] } });

    await loadAvailability();

    expect(mockAvailabilityStoreState.startLoading).toHaveBeenCalled();
    expect(getData).toHaveBeenCalledWith("/fhir/v1/availability/org-1/base");
    expect(mockAvailabilityStoreState.setAvailabilities).toHaveBeenCalledWith([
      { id: "a1" },
    ]);
  });
});
