import {
  EmploymentTypesProps,
  Invite,
  InviteStatusprops,
  RoleProps,
  Team,
  TeamAdd,
  TeamFormDataType,
  TeamResponse,
  TeamStatusProps,
} from "@/app/types/team";

describe("team types", () => {
  it("accepts known status unions", () => {
    const inviteStatus: InviteStatusprops = "PENDING";
    const role: RoleProps = "ADMIN";
    const teamStatus: TeamStatusProps = "Available";
    const employment: EmploymentTypesProps = "FULL_TIME";

    expect(inviteStatus).toBe("PENDING");
    expect(role).toBe("ADMIN");
    expect(teamStatus).toBe("Available");
    expect(employment).toBe("FULL_TIME");
  });

  it("creates typed team records", () => {
    const invite: Invite = {
      _id: "invite-1",
      organisationId: "org-1",
      organisationName: "Yosemite Vet",
      organisationType: "GROOMER",
      invitedByUserId: "user-1",
      departmentId: "dept-1",
      inviteeEmail: "test@example.com",
      role: "ADMIN",
      employmentType: "FULL_TIME",
      token: "token",
      status: "PENDING",
      expiresAt: "2025-01-01",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
    };

    const team: Team = {
      _id: "team-1",
      practionerId: "user-2",
      organisationId: "org-1",
      role: "ADMIN",
      speciality: [],
      status: "Available",
      effectivePermissions: [],
      extraPerissions: [],
    };

    const teamAdd: TeamAdd = {
      _id: "team-2",
      organisationId: "org-1",
      role: "ADMIN",
      speciality: "General",
      status: "Available",
    };

    const teamResponse: TeamResponse = {
      userOrganisation: {} as any,
      speciality: [],
      currentStatus: "Available",
    };

    const formData: TeamFormDataType = {
      email: "test@example.com",
      speciality: ["General"],
      role: "ADMIN",
      type: "FULL_TIME",
    };

    expect(invite.status).toBe("PENDING");
    expect(team.status).toBe("Available");
    expect(teamAdd.speciality).toBe("General");
    expect(teamResponse.currentStatus).toBe("Available");
    expect(formData.email).toBe("test@example.com");
  });
});
