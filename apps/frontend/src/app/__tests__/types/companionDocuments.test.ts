import {
  CategoryOptions,
  HealthCategoryOptions,
  HygieneCategoryOptions,
  emptyCompanionRecord,
  type Category,
  type Subcategory,
  type CompanionRecord,
  type Attachment,
  type VisitType,
  type SignedFile,
} from "@/app/types/companionDocuments";

describe("companionDocuments types", () => {
  describe("CategoryOptions", () => {
    it("has Health option", () => {
      const health = CategoryOptions.find((o) => o.value === "HEALTH");
      expect(health).toBeDefined();
      expect(health?.label).toBe("Health");
    });

    it("has Hygiene maintenance option", () => {
      const hygiene = CategoryOptions.find((o) => o.value === "HYGIENE_MAINTENANCE");
      expect(hygiene).toBeDefined();
      expect(hygiene?.label).toBe("Hygiene maintenance");
    });

    it("has exactly 2 options", () => {
      expect(CategoryOptions).toHaveLength(2);
    });
  });

  describe("HealthCategoryOptions", () => {
    it("has Hospital visits option", () => {
      const option = HealthCategoryOptions.find((o) => o.value === "HOSPITAL_VISITS");
      expect(option).toBeDefined();
      expect(option?.label).toBe("Hospital visits");
    });

    it("has Prescriptions & treatments option", () => {
      const option = HealthCategoryOptions.find(
        (o) => o.value === "PRESCRIPTIONS_AND_TREATMENTS"
      );
      expect(option).toBeDefined();
      expect(option?.label).toBe("Prescriptions & treatments");
    });

    it("has Vaccination & parasite prevention option", () => {
      const option = HealthCategoryOptions.find(
        (o) => o.value === "VACCINATION_AND_PARASITE_PREVENTION"
      );
      expect(option).toBeDefined();
      expect(option?.label).toBe("Vaccination & parasite prevention");
    });

    it("has Lab tests option", () => {
      const option = HealthCategoryOptions.find((o) => o.value === "LAB_TESTS");
      expect(option).toBeDefined();
      expect(option?.label).toBe("Lab tests");
    });

    it("has exactly 4 options", () => {
      expect(HealthCategoryOptions).toHaveLength(4);
    });
  });

  describe("HygieneCategoryOptions", () => {
    it("has Grooming visits option", () => {
      const option = HygieneCategoryOptions.find((o) => o.value === "GROOMER_VISIT");
      expect(option).toBeDefined();
      expect(option?.label).toBe("Grooming visits");
    });

    it("has Boarding records option", () => {
      const option = HygieneCategoryOptions.find((o) => o.value === "BOARDER_VISIT");
      expect(option).toBeDefined();
      expect(option?.label).toBe("Boarding records");
    });

    it("has Training & behavior reports option", () => {
      const option = HygieneCategoryOptions.find(
        (o) => o.value === "TRAINING_AND_BEHAVIOUR_REPORTS"
      );
      expect(option).toBeDefined();
      expect(option?.label).toBe("Training & behavior reports");
    });

    it("has Breeder interactions option", () => {
      const option = HygieneCategoryOptions.find((o) => o.value === "BREEDER_VISIT");
      expect(option).toBeDefined();
      expect(option?.label).toBe("Breeder interactions");
    });

    it("has exactly 4 options", () => {
      expect(HygieneCategoryOptions).toHaveLength(4);
    });
  });

  describe("emptyCompanionRecord", () => {
    it("has empty title", () => {
      expect(emptyCompanionRecord.title).toBe("");
    });

    it("has HEALTH category by default", () => {
      expect(emptyCompanionRecord.category).toBe("HEALTH");
    });

    it("has HOSPITAL_VISITS subcategory by default", () => {
      expect(emptyCompanionRecord.subcategory).toBe("HOSPITAL_VISITS");
    });

    it("has empty attachments array", () => {
      expect(emptyCompanionRecord.attachments).toEqual([]);
    });

    it("has undefined appointmentId", () => {
      expect(emptyCompanionRecord.appointmentId).toBeUndefined();
    });

    it("has HOSPITAL_VISIT visitType by default", () => {
      expect(emptyCompanionRecord.visitType).toBe("HOSPITAL_VISIT");
    });

    it("has undefined issuingBusinessName", () => {
      expect(emptyCompanionRecord.issuingBusinessName).toBeUndefined();
    });

    it("has undefined issueDate", () => {
      expect(emptyCompanionRecord.issueDate).toBeUndefined();
    });
  });

  describe("type validation", () => {
    it("allows valid Category type", () => {
      const health: Category = "HEALTH";
      const hygiene: Category = "HYGIENE_MAINTENANCE";
      expect(health).toBe("HEALTH");
      expect(hygiene).toBe("HYGIENE_MAINTENANCE");
    });

    it("allows valid Subcategory types", () => {
      const hospitalVisits: Subcategory = "HOSPITAL_VISITS";
      const groomerVisit: Subcategory = "GROOMER_VISIT";
      expect(hospitalVisits).toBe("HOSPITAL_VISITS");
      expect(groomerVisit).toBe("GROOMER_VISIT");
    });

    it("allows valid CompanionRecord", () => {
      const record: CompanionRecord = {
        id: "rec-123",
        title: "Test Record",
        category: "HEALTH",
        subcategory: "LAB_TESTS",
        attachments: [{ key: "file-key", mimeType: "application/pdf", size: 1024 }],
        appointmentId: "appt-123",
        companionId: "comp-123",
        visitType: "HOSPITAL_VISIT",
        issuingBusinessName: "Test Clinic",
        issueDate: "2024-01-15",
      };
      expect(record.title).toBe("Test Record");
    });

    it("allows valid Attachment", () => {
      const attachment: Attachment = {
        key: "file-key",
        mimeType: "image/png",
        size: 2048,
      };
      expect(attachment.key).toBe("file-key");
    });

    it("allows Attachment with only required fields", () => {
      const attachment: Attachment = { key: "minimal-key" };
      expect(attachment.key).toBe("minimal-key");
      expect(attachment.mimeType).toBeUndefined();
      expect(attachment.size).toBeUndefined();
    });

    it("allows valid SignedFile", () => {
      const signedFile: SignedFile = {
        url: "https://example.com/file.pdf",
        mimeType: "application/pdf",
        key: "signed-file-key",
      };
      expect(signedFile.url).toBe("https://example.com/file.pdf");
    });
  });
});
