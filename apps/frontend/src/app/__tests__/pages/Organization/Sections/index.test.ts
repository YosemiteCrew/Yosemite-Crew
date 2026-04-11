import * as OrganizationSections from "@/app/features/organization/pages/Organization/Sections";

describe("Organization sections index", () => {
  it("exports expected sections", () => {
    expect(OrganizationSections).toHaveProperty("DeleteOrg");
    expect(OrganizationSections).toHaveProperty("Documents");
    expect(OrganizationSections).toHaveProperty("Payment");
    expect(OrganizationSections).toHaveProperty("Profile");
    expect(OrganizationSections).toHaveProperty("Rooms");
    expect(OrganizationSections).toHaveProperty("Specialities");
    expect(OrganizationSections).toHaveProperty("Team");
  });
});
