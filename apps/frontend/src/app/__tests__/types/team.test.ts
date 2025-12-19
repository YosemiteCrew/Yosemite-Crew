import {
  Invite,
  Team,
  TeamAdd,
  TeamResponse,
  TeamFormDataType,
  EmploymentTypesProps,
  InviteStatusprops,
  TeamStatusProps,
  RoleProps,
} from "../../types/team";
import { Speciality, UserOrganizationRequestDTO } from "@yosemite-crew/types";
import { BusinessType } from "../../types/org";

// --- Mocks for External Types ---
// We define these locally or cast to 'any' to ensure the test runs
// even if the external dependencies are complex.
const mockSpeciality = { _id: "spec1", name: "Surgery", organisationId: "org1" } as unknown as Speciality;
const mockBusinessType = "CLINIC" as unknown as BusinessType;
const mockUserOrgDTO = { userId: "user1", role: "ADMIN" } as unknown as UserOrganizationRequestDTO;

describe("Team Types Definition", () => {

  // --- Section 1: String Union Types ---
  // We verify that variables can be assigned the specific literal values allowed by the types.
  describe("String Union Types", () => {
    it("accepts valid EmploymentTypesProps values", () => {
      const fullTime: EmploymentTypesProps = "FULL_TIME";
      const partTime: EmploymentTypesProps = "PART_TIME";
      const contractor: EmploymentTypesProps = "CONTRACTOR";
      expect([fullTime, partTime, contractor]).toBeDefined();
    });

    it("accepts valid InviteStatusprops values", () => {
      const pending: InviteStatusprops = "PENDING";
      const accepted: InviteStatusprops = "ACCEPTED";
      expect(pending).toBe("PENDING");
      expect(accepted).toBe("ACCEPTED");
    });

    it("accepts valid TeamStatusProps values", () => {
      const available: TeamStatusProps = "Available";
      const consulting: TeamStatusProps = "Consulting";
      expect(available).toBe("Available");
      expect(consulting).toBe("Consulting");
    });

    it("accepts valid RoleProps values", () => {
      const vet: RoleProps = "VETERINARIAN";
      const admin: RoleProps = "ADMIN";
      expect(vet).toBe("VETERINARIAN");
      expect(admin).toBe("ADMIN");
    });
  });

  // --- Section 2: Invite Type Structure ---
  describe("Invite Type", () => {
    it("creates a valid Invite object", () => {
      const invite: Invite = {
        _id: "inv-123",
        organisationId: "org-1",
        organisationName: "Vet Clinic",
        organisationType: mockBusinessType,
        invitedByUserId: "user-99",
        departmentId: "dept-1",
        inviteeEmail: "test@example.com",
        role: "TECHNICIAN",
        employmentType: "FULL_TIME",
        token: "abc-123-token",
        status: "PENDING",
        expiresAt: "2024-01-01T00:00:00Z",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      };

      expect(invite.inviteeEmail).toBe("test@example.com");
      expect(invite.status).toBe("PENDING");
    });
  });

  // --- Section 3: Team & TeamAdd Structure ---
  describe("Team and TeamAdd Types", () => {
    it("creates a valid Team object (with Speciality object)", () => {
      const team: Team = {
        _id: "team-1",
        organisationId: "org-1",
        name: "Dr. Smith",
        role: "VETERINARIAN",
        speciality: mockSpeciality, // Uses the imported type structure
        status: "Available",
        weeklyWorkingHours: "40",
      };

      expect(team.name).toBe("Dr. Smith");
      expect(team.speciality).toBeDefined();
    });

    it("creates a valid TeamAdd object (with Speciality string)", () => {
      // TeamAdd uses string for speciality, unlike Team which uses the object
      const teamAdd: TeamAdd = {
        _id: "team-add-1",
        organisationId: "org-1",
        name: "Jane Doe",
        role: "ASSISTANT",
        speciality: "General",
        status: "Off-Duty",
        todayAppointment: "5",
      };

      expect(teamAdd.speciality).toBe("General");
      expect(typeof teamAdd.speciality).toBe("string");
    });
  });

  // --- Section 4: Response & Form Data Structure ---
  describe("TeamResponse and TeamFormDataType", () => {
    it("creates a valid TeamResponse object", () => {
      const response: TeamResponse = {
        userOrganisation: mockUserOrgDTO,
        name: "Response Name",
        speciality: mockSpeciality,
        currentStatus: "Requested",
        weeklyHours: "20",
        count: "10",
      };

      expect(response.currentStatus).toBe("Requested");
      expect(response.userOrganisation).toBeDefined();
    });

    it("creates a valid TeamFormDataType object", () => {
      const formData: TeamFormDataType = {
        email: "newuser@clinic.com",
        speciality: {
          name: "Dental",
          key: "dental_01",
        },
        role: "RECEPTIONIST",
        type: "PART_TIME",
      };

      expect(formData.email).toContain("@");
      expect(formData.speciality.key).toBe("dental_01");
    });
  });
});