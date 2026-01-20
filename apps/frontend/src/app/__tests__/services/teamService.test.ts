import {
  acceptInvite,
  loadInvites,
  loadTeam,
  sendInvite,
} from "@/app/services/teamService";

const getDataMock = jest.fn();
const postDataMock = jest.fn();

const orgState: any = { primaryOrgId: "org-1", setPrimaryOrg: jest.fn() };
const teamStoreState: any = {
  startLoading: jest.fn(),
  status: "idle",
  setTeamsForOrg: jest.fn(),
};

jest.mock("@/app/services/axios", () => ({
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: { getState: () => orgState },
}));

jest.mock("@/app/stores/teamStore", () => ({
  useTeamStore: { getState: () => teamStoreState },
}));

jest.mock("@yosemite-crew/types", () => ({
  fromUserOrganizationRequestDTO: (dto: any) => ({
    practitionerReference: dto.practitionerReference,
    organizationReference: dto.organizationReference,
    roleCode: dto.roleCode,
  }),
}));

jest.mock("@/app/services/orgService", () => ({
  loadOrgs: jest.fn(),
}));

jest.mock("@/app/services/profileService", () => ({
  loadProfiles: jest.fn(),
}));

describe("teamService", () => {
  beforeEach(() => {
    getDataMock.mockReset();
    postDataMock.mockReset();
    teamStoreState.startLoading.mockReset();
    teamStoreState.setTeamsForOrg.mockReset();
    orgState.setPrimaryOrg.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
    (console.error as jest.Mock).mockRestore?.();
  });

  it("loads team list", async () => {
    getDataMock.mockResolvedValue({
      data: [
        {
          userOrganisation: {
            practitionerReference: "u1",
            organizationReference: "org-1",
            roleCode: "ADMIN",
          },
          name: "Alex",
          profileUrl: "img",
          speciality: { name: "General" },
          currentStatus: "Available",
        },
      ],
    });

    await loadTeam();

    expect(teamStoreState.setTeamsForOrg).toHaveBeenCalledWith("org-1", [
      expect.objectContaining({ _id: "u1", name: "Alex" }),
    ]);
  });

  it("sends invite", async () => {
    postDataMock.mockResolvedValue({ data: {} });

    await sendInvite({
      email: "a@b.com",
      speciality: ["s1"],
      role: "ADMIN",
      type: "FULL_TIME",
    });

    expect(postDataMock).toHaveBeenCalledWith(
      "/fhir/v1/organization/org-1/invites",
      expect.objectContaining({ inviteeEmail: "a@b.com" })
    );
  });

  it("loads invites", async () => {
    getDataMock.mockResolvedValue({
      data: [{ invite: { token: "t1" }, token: "t1" }],
    });

    const invites = await loadInvites();

    expect(invites[0].token).toBe("t1");
  });

  it("accepts invite", async () => {
    postDataMock.mockResolvedValue({ data: [] });
    getDataMock.mockResolvedValue({ data: [] });

    await acceptInvite({ token: "tok", organisationId: "org-1" } as any);

    expect(postDataMock).toHaveBeenCalledWith(
      "/fhir/v1/organisation-invites/tok/accept"
    );
    expect(orgState.setPrimaryOrg).toHaveBeenCalledWith("org-1");
  });
});
