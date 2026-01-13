import {
  SpecialityOptions,
  RoleOptions,
  StaffOptions,
  EmploymentTypes,
  RoomsTypes,
  OrgDocumentCategoryOptions,
  Room,
  Document,
  AvailabilityProps
} from "@/app/pages/Organization/types";

describe("Organization Types and Constants", () => {

  // --- 1. Type Validation (Static check simulation) ---

  it("should support valid Room object structure", () => {
    const mockRoom: Room = {
      name: "Room A",
      type: "CONSULTATION",
      assignedSpeciality: "Surgery",
      assignedStaff: "Dr. Emily brown"
    };
    expect(mockRoom.name).toBe("Room A");
  });

  it("should support valid Document object structure", () => {
    const mockDoc: Document = {
      title: "Privacy Policy",
      description: "Standard policy",
      date: "2023-01-01",
      lastUpdated: "2023-06-01"
    };
    expect(mockDoc.title).toBe("Privacy Policy");
  });

  it("should support valid AvailabilityProps object structure", () => {
    const mockAvailability: AvailabilityProps = {
      name: "Dr. Emily",
      image: "/path/to/img",
      role: "VETERINARIAN",
      speciality: "Surgery",
      todayAppointment: "5",
      weeklyWorkingHours: "40",
      status: "Available"
    };
    expect(mockAvailability.role).toBe("VETERINARIAN");
  });

  // --- 2. Constant Options Validation ---

  describe("Options Constants", () => {
    it("should have correct SpecialityOptions", () => {
      expect(SpecialityOptions).toContain("Internal medicine");
      expect(SpecialityOptions).toContain("Surgery");
      expect(SpecialityOptions).toContain("Dermatology");
      expect(SpecialityOptions).toHaveLength(3);
    });

    it("should have correct RoleOptions", () => {
      expect(RoleOptions).toEqual([
        "OWNER",
        "ADMIN",
        "SUPERVISOR",
        "VETERINARIAN",
        "TECHNICIAN",
        "ASSISTANT",
        "RECEPTIONIST",
      ]);
    });

    it("should have correct StaffOptions", () => {
      expect(StaffOptions).toContain("Dr. Emily brown");
      expect(StaffOptions).toHaveLength(3);
    });
  });

  // --- 3. Key-Value Mapping Constants ---

  describe("Mapping Constants", () => {
    it("should have valid EmploymentTypes mappings", () => {
      expect(EmploymentTypes[0]).toEqual({ name: "Full time", key: "FULL_TIME" });
      expect(EmploymentTypes).toHaveLength(3);
    });

    it("should have valid RoomsTypes mappings", () => {
      expect(RoomsTypes).toContainEqual({ label: "CONSULTATION", key: "CONSULTATION" });
      expect(RoomsTypes).toContainEqual({ label: "SURGERY", key: "SURGERY" });
      expect(RoomsTypes).toHaveLength(4);
    });

    it("should have valid OrgDocumentCategoryOptions mappings", () => {
      expect(OrgDocumentCategoryOptions).toContainEqual({
        label: "TERMS AND CONDITIONS",
        key: "TERMS_AND_CONDITIONS"
      });
      expect(OrgDocumentCategoryOptions).toContainEqual({
        label: "GENERAL",
        key: "GENERAL"
      });
      expect(OrgDocumentCategoryOptions).toHaveLength(5);
    });
  });

  // --- 4. Content Integrity ---

  it("should ensure all exported constants are defined", () => {
    expect(SpecialityOptions).toBeDefined();
    expect(RoleOptions).toBeDefined();
    expect(StaffOptions).toBeDefined();
    expect(EmploymentTypes).toBeDefined();
    expect(RoomsTypes).toBeDefined();
    expect(OrgDocumentCategoryOptions).toBeDefined();
  });
});