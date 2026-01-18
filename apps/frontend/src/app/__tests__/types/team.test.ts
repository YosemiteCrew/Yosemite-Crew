import { EmploymentTypesProps, InviteStatusprops, RoleProps, TeamStatusProps } from "@/app/types/team";

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
});
