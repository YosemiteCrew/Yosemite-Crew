import {
  OrgDocumentCategory,
  OrganizationDocument,
  OrganisationDocumentResponse,
  Document,
} from "../../types/document";

describe("Document Types Definition", () => {

  // --- Section 1: Category Union Type ---
  describe("OrgDocumentCategory Union", () => {
    it("accepts valid category literal values", () => {
      const terms: OrgDocumentCategory = "TERMS_AND_CONDITIONS";
      const privacy: OrgDocumentCategory = "PRIVACY_POLICY";
      const cancellation: OrgDocumentCategory = "CANCELLATION_POLICY";
      const fire: OrgDocumentCategory = "FIRE_SAFETY";
      const general: OrgDocumentCategory = "GENERAL";

      expect([terms, privacy, cancellation, fire, general]).toBeDefined();
    });
  });

  // --- Section 2: OrganizationDocument Structure ---
  describe("OrganizationDocument Interface", () => {
    it("creates a valid OrganizationDocument with all required fields", () => {
      const doc: OrganizationDocument = {
        _id: "doc-1",
        organisationId: "org-1",
        title: "Fire Safety Protocol",
        fileUrl: "https://example.com/fire.pdf",
        category: "FIRE_SAFETY",
      };

      expect(doc.title).toBe("Fire Safety Protocol");
      expect(doc.category).toBe("FIRE_SAFETY");
    });

    it("allows optional description field", () => {
      const doc: OrganizationDocument = {
        _id: "doc-2",
        organisationId: "org-1",
        title: "Terms",
        description: "Standard T&C",
        fileUrl: "https://example.com/terms.pdf",
        category: "TERMS_AND_CONDITIONS",
      };

      expect(doc.description).toBe("Standard T&C");
    });
  });

  // --- Section 3: Document Interface (Detailed) ---
  describe("Document Interface", () => {
    it("creates a valid Document object with required fields", () => {
      const fullDoc: Document = {
        _id: "doc-detailed-1",
        organisationId: "org-55",
        title: "Privacy Policy",
        description: "User data handling",
        category: "PRIVACY_POLICY",
        fileUrl: "https://example.com/privacy.pdf",
      };

      expect(fullDoc.fileSize).toBeUndefined();
      expect(fullDoc._id).toBe("doc-detailed-1");
    });

    it("accepts all optional metadata fields", () => {
      const fullDoc: Document = {
        _id: "doc-detailed-2",
        organisationId: "org-55",
        title: "Archive",
        description: "Old logs",
        category: "GENERAL",
        fileUrl: "s3://bucket/key",
        fileSize: 1024,
        visibility: "PRIVATE",
        version: 2,
        createdAt: "2023-01-01",
        updatedAt: "2023-02-01",
        __v: 1,
      };

      expect(fullDoc.fileSize).toBe(1024);
      expect(fullDoc.version).toBe(2);
      expect(fullDoc.__v).toBe(1);
    });

    it("allows fileSize to be null", () => {
      const doc: Document = {
        _id: "doc-null-size",
        organisationId: "org-1",
        title: "Null Size Doc",
        description: "Testing null type",
        category: "GENERAL",
        fileUrl: "url",
        fileSize: null,
      };

      expect(doc.fileSize).toBeNull();
    });
  });

  // --- Section 4: Response Structure ---
  describe("OrganisationDocumentResponse Interface", () => {
    it("correctly nests the Document type inside the data property", () => {
      const innerDoc: Document = {
        _id: "inner-1",
        organisationId: "org-99",
        title: "Nested Doc",
        description: "Inside response",
        category: "GENERAL",
        fileUrl: "url",
      };

      const response: OrganisationDocumentResponse = {
        data: innerDoc,
      };

      expect(response.data.title).toBe("Nested Doc");
      expect(response.data._id).toBe("inner-1");
    });
  });
});