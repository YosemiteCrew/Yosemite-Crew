import { demoOrgs, demoInvites } from "../../demo/demo";

describe("Demo Data Configuration", () => {
  describe("demoOrgs", () => {
    it("should contain the correct number of organizations", () => {
      expect(demoOrgs).toHaveLength(3);
    });

    it("should have the correct structure for the first organization", () => {
      const org = demoOrgs[0];
      expect(org).toEqual(
        expect.objectContaining({
          _id: "1",
          isActive: false,
          isVerified: false,
          name: "Paws & Tails Health Club",
          type: "HOSPITAL",
        })
      );
    });

    it("should have specific attributes for other organizations", () => {
      expect(demoOrgs[1]._id).toBe("2");
      expect(demoOrgs[1].isVerified).toBe(true);

      expect(demoOrgs[2]._id).toBe("3");
      expect(demoOrgs[2].type).toBe("BOARDER");
    });
  });

  describe("demoInvites", () => {
    it("should contain the correct number of invites", () => {
      expect(demoInvites).toHaveLength(2);
    });

    it("should have the correct structure for the first invite", () => {
      const invite = demoInvites[0];
      expect(invite).toEqual({
        id: "1",
        name: "Paws & Tails Health Club",
        type: "Hospital",
        role: "Vet",
        employmentType: "Full time",
      });
    });

    it("should have the correct structure for the second invite", () => {
      const invite = demoInvites[1];
      expect(invite.role).toBe("Nurse");
      expect(invite.employmentType).toBe("Part time");
    });
  });
});