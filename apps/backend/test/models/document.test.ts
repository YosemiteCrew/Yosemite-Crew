import { describe, it, expect } from "@jest/globals";
import { Types } from "mongoose";
import DocumentModel from "../../src/models/document";

describe("Document Model", () => {
  // ======================================================================
  // 1. Validation Logic (Required Fields & Types)
  // ======================================================================
  describe("Schema Validation", () => {
    it("should be valid if all required fields are present", () => {
      const doc = new DocumentModel({
        companionId: new Types.ObjectId(),
        category: "Medical",
        title: "Vaccination Report",
        attachments: [
          { key: "s3-key", mimeType: "application/pdf", size: 1024 },
        ],
        pmsVisible: true,
        syncedFromPms: false,
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it("should trigger validation error if required fields are missing", () => {
      const doc = new DocumentModel({}); // Empty object

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["companionId"]).toBeDefined();
      expect(err?.errors["category"]).toBeDefined();
      expect(err?.errors["title"]).toBeDefined();
      expect(err?.errors["attachments"]).toBeDefined();
    });

    it('should validate "attachments" must be a non-empty array', () => {
      const docEmpty = new DocumentModel({
        companionId: new Types.ObjectId(),
        category: "Medical",
        title: "Test",
        attachments: [], // Empty array
      });

      const err = docEmpty.validateSync();
      expect(err?.errors["attachments"]).toBeDefined();
    });

    it("should validate attachment structure inside array", () => {
      const docInvalidAttachment = new DocumentModel({
        companionId: new Types.ObjectId(),
        category: "Medical",
        title: "Test",
        attachments: [{ key: "only-key" }], // Missing mimeType
      });

      const err = docInvalidAttachment.validateSync();
      expect(err?.errors["attachments.0.mimeType"]).toBeDefined();
    });
  });

  // ======================================================================
  // 2. Default Values
  // ======================================================================
  describe("Default Values", () => {
    it("should set default values for optional fields", () => {
      const doc = new DocumentModel({
        companionId: new Types.ObjectId(),
        category: "Lab",
        title: "Blood Test",
        attachments: [{ key: "k", mimeType: "t" }],
      });

      expect(doc.pmsVisible).toBe(false);
      expect(doc.syncedFromPms).toBe(false);
      expect(doc.appointmentId).toBeNull();
      expect(doc.subcategory).toBeNull();
      expect(doc.visitType).toBeNull();
      expect(doc.issuingBusinessName).toBeNull();
      expect(doc.issueDate).toBeNull();
      expect(doc.uploadedByParentId).toBeNull();
      expect(doc.uploadedByPmsUserId).toBeNull();
    });
  });

  // ======================================================================
  // 3. Types & Interfaces (Static Check via compilation + runtime check)
  // ======================================================================
  describe("Data Types", () => {
    it("should cast compatible types (e.g. string to ObjectId)", () => {
      const idString = new Types.ObjectId().toString();
      const doc = new DocumentModel({
        companionId: idString, // String passed instead of ObjectId
        category: "Cat",
        title: "Title",
        attachments: [{ key: "k", mimeType: "m" }],
      });

      expect(doc.companionId).toBeInstanceOf(Types.ObjectId);
      expect(doc.companionId.toString()).toBe(idString);
    });

    it("should handle dates correctly", () => {
      const dateStr = "2023-01-01";
      const doc = new DocumentModel({
        companionId: new Types.ObjectId(),
        category: "Cat",
        title: "Title",
        attachments: [{ key: "k", mimeType: "m" }],
        issueDate: dateStr,
      });

      expect(doc.issueDate).toBeInstanceOf(Date);
      // Loose check for validity
      expect(doc.issueDate?.toISOString().startsWith("2023-01-01")).toBe(true);
    });
  });

  // ======================================================================
  // 4. Indexes (Definition Verification)
  // ======================================================================
  describe("Indexes", () => {
    it("should have defined indexes", () => {
      const indexes = DocumentModel.schema.indexes();

      // We expect specific compound and single field indexes based on the schema definition:
      // 1. { companionId: 1, category: 1 }
      // 2. { companionId: 1, pmsVisible: 1 }
      // 3. { appointmentId: 1 }
      // + default timestamps usually add createdAt/updatedAt if configured (depends on plugin, but base schema has explicit ones above)

      const hasCategoryIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["companionId"] === 1 && keys["category"] === 1;
      });

      const hasPmsVisibleIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["companionId"] === 1 && keys["pmsVisible"] === 1;
      });

      const hasAppointmentIndex = indexes.some((idx) => {
        const keys = idx[0];
        return keys["appointmentId"] === 1;
      });

      expect(hasCategoryIndex).toBe(true);
      expect(hasPmsVisibleIndex).toBe(true);
      expect(hasAppointmentIndex).toBe(true);
    });
  });
});
