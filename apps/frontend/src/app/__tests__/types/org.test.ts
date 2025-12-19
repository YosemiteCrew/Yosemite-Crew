import {
  BusinessTypes,
  RolesByBusinessType,
  BusinessType,
  OrgWithMembership,
  SpecialityWithServices,
  InviteProps,
  Speciality,
  ServiceWeb,
} from "../../types/org";
import {
  Organisation,
  UserOrganization,
  ServiceRequestDTO,
  SpecialityRequestDTO,
} from "@yosemite-crew/types";

// --- Mocks for External Types ---
const mockOrganisation = { _id: "org-1", name: "Test Org" } as unknown as Organisation;
const mockMembership = { userId: "user-1", role: "OWNER" } as unknown as UserOrganization;
const mockSpecRequest = { name: "Surgery" } as unknown as SpecialityRequestDTO;
const mockServiceRequest = { name: "Consult", price: 100 } as unknown as ServiceRequestDTO;

describe("Org Types Definition", () => {

  // --- Section 1: Constants Verification ---
  describe("Exported Constants", () => {
    it("BusinessTypes array contains the correct fixed values", () => {
      expect(BusinessTypes).toHaveLength(4);
      expect(BusinessTypes).toContain("HOSPITAL");
      expect(BusinessTypes).toContain("BREEDER");
      expect(BusinessTypes).toContain("BOARDER");
      expect(BusinessTypes).toContain("GROOMER");
    });

    it("RolesByBusinessType array contains the correct role strings", () => {
      const expectedRoles = [
        "Owner",
        "Admin",
        "Veterinarian",
        "Technician",
        "Supervisor",
        "Assistant",
        "Receptionist",
        "Groomer",
      ];

      expect(RolesByBusinessType).toHaveLength(expectedRoles.length);
      expectedRoles.forEach((role) => {
        expect(RolesByBusinessType).toContain(role);
      });
    });
  });

  // --- Section 2: BusinessType Union ---
  describe("BusinessType Union", () => {
    it("accepts valid BusinessType literal values", () => {
      const hospital: BusinessType = "HOSPITAL";
      const breeder: BusinessType = "BREEDER";

      expect(hospital).toBe("HOSPITAL");
      expect(breeder).toBe("BREEDER");
    });
  });

  // --- Section 3: High-Level Object Structures ---
  describe("OrgWithMembership & InviteProps", () => {
    it("creates a valid OrgWithMembership object", () => {
      const item: OrgWithMembership = {
        org: mockOrganisation,
        membership: mockMembership,
      };

      expect(item.org).toEqual(mockOrganisation);
      expect(item.membership).toEqual(mockMembership);
    });

    it("allows membership to be null in OrgWithMembership", () => {
      const item: OrgWithMembership = {
        org: mockOrganisation,
        membership: null,
      };
      expect(item.membership).toBeNull();
    });

    it("creates a valid InviteProps object", () => {
      const invite: InviteProps = {
        id: "inv-123",
        name: "John Doe",
        type: "HOSPITAL",
        role: "Veterinarian",
        employmentType: "FULL_TIME",
      };

      expect(invite.id).toBe("inv-123");
      expect(invite.role).toBe("Veterinarian");
    });
  });

  // --- Section 4: Speciality & Service Structures ---
  describe("Speciality & Service Definitions", () => {
    it("creates a valid SpecialityWithServices object", () => {
      const item: SpecialityWithServices = {
        speciality: mockSpecRequest,
        services: [mockServiceRequest],
      };

      expect(item.services).toHaveLength(1);
    });

    it("creates a valid ServiceWeb object with optional fields", () => {
      const service: ServiceWeb = {
        name: "Vaccination",
        description: "Annual shot",
        duration: 15,
        charge: 50,
        maxDiscount: 10,
      };

      expect(service.duration).toBe(15);
      expect(service.charge).toBe(50);
    });

    it("creates a valid Speciality object with nested ServiceWeb array", () => {
      const service: ServiceWeb = { name: "X-Ray" };

      const spec: Speciality = {
        name: "Radiology",
        head: "Dr. Smith",
        staff: ["Nurse A", "Tech B"],
        services: [service],
      };

      expect(spec.staff).toContain("Nurse A");
      expect(spec.services?.[0].name).toBe("X-Ray");
    });

    it("allows optional fields in Speciality to be undefined", () => {
      const simpleSpec: Speciality = {
        name: "General",
      };

      expect(simpleSpec.head).toBeUndefined();
      expect(simpleSpec.services).toBeUndefined();
    });
  });
});