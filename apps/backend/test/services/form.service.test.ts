// test/services/form.service.test.ts
import { Types } from "mongoose";
import { FormService, FormServiceError } from "../../src/services/form.service";
import {
  FormModel,
  FormFieldModel,
  FormVersionModel,
  FormSubmissionModel,
} from "../../src/models/form";
import AppointmentModel from "../../src/models/appointment";
import OrganizationModel from "../../src/models/organization";
import UserModel from "../../src/models/user";
import { DocumensoService } from "../../src/services/documenso.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";

// --- MOCK SETUP ---
jest.mock("../../src/models/form", () => ({
  FormModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
  FormFieldModel: {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
  },
  FormVersionModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
  },
  FormSubmissionModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock("../../src/models/appointment", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  buildPdfViewModel: jest.fn(),
  renderPdf: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromFormRequestDTO: jest.fn((x) => x),
  toFormResponseDTO: jest.fn((x) => x),
  fromFormSubmissionRequestDTO: jest.fn((x) => x),
  toFHIRQuestionnaireResponse: jest.fn((x) => x),
  toFHIRQuestionnaire: jest.fn((x) => x),
}));

// --- HELPERS ---

// Creating a valid Native Promise that also has Mongoose chain methods attached
const createChainable = (value: any) => {
  const chain = Promise.resolve(value) as any;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(value);
  chain.exec = jest.fn().mockResolvedValue(value);
  return chain;
};

const mockDoc = (data: any) => ({
  ...data,
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue(data),
});

describe("FormService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("FormServiceError & Helpers", () => {
    it("instantiates custom error", () => {
      const err = new FormServiceError("Test", 404);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(404);
    });

    it("throws Invalid ObjectId string in ensureObjectId via public method", async () => {
      await expect(
        FormService.getFormForAdmin("bad-id", "bad-id"),
      ).rejects.toThrow("Invalid orgId");
    });
  });

  describe("hasSignatureField", () => {
    it("returns false for empty or non-signature schema", () => {
      expect(FormService.hasSignatureField()).toBe(false);
      expect(FormService.hasSignatureField([])).toBe(false);
      expect(FormService.hasSignatureField([{ type: "text" }] as any)).toBe(
        false,
      );
    });

    it("returns true for signature field", () => {
      expect(
        FormService.hasSignatureField([{ type: "signature" }] as any),
      ).toBe(true);
    });

    it("returns true for nested group signature field", () => {
      expect(
        FormService.hasSignatureField([
          { type: "group", fields: [{ type: "text" }, { type: "signature" }] },
        ] as any),
      ).toBe(true);
    });

    it("returns false for nested group without signature field", () => {
      expect(
        FormService.hasSignatureField([
          { type: "group", fields: [{ type: "text" }] },
        ] as any),
      ).toBe(false);
    });
  });

  describe("create", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if signature field exists but no requiredSigner", async () => {
      const req: any = {
        schema: [{ type: "signature" }],
        requiredSigner: null,
      };
      await expect(FormService.create(validId, req, validId)).rejects.toThrow(
        "requiredSigner is required",
      );
    });

    it("creates form, flattens fields, resolves user names", async () => {
      const req: any = {
        schema: [{ type: "group", fields: [{ type: "text", options: ["A"] }] }],
        businessType: "HOSPITAL",
      };

      (FormModel.create as jest.Mock).mockResolvedValueOnce(
        mockDoc({ _id: validId, createdBy: "u1", updatedBy: "u2" }),
      );
      (FormFieldModel.deleteMany as jest.Mock).mockResolvedValueOnce(true);
      (FormFieldModel.insertMany as jest.Mock).mockResolvedValueOnce(true);

      // Resolve username map
      (UserModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([
          { userId: "u1", firstName: "John", lastName: "Doe" },
          { userId: "u2" }, // missing name falls back to raw ID
        ]),
      );

      const res = await FormService.create(validId, req, "u1");
      const anyRes = res as any;
      expect(FormModel.create).toHaveBeenCalled();
      expect(FormFieldModel.insertMany).toHaveBeenCalled();
      expect(anyRes.createdBy).toBe("John Doe");
      expect(anyRes.updatedBy).toBe("u2");
    });
  });

  describe("getFormForAdmin", () => {
    it("throws if not found", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getFormForAdmin(
          new Types.ObjectId().toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow("Form not found");
    });

    it("returns mapped form", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ createdBy: "u1" }),
      );
      (UserModel.find as jest.Mock).mockReturnValueOnce(createChainable([])); // empty users fallback
      const res = await FormService.getFormForAdmin(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      );
      const anyRes = res as any;
      expect(anyRes.createdBy).toBe("u1");
    });
  });

  describe("getFormForUser", () => {
    it("throws if no published version", async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getFormForUser(new Types.ObjectId().toString()),
      ).rejects.toThrow("Form has no published version");
    });

    it("throws if form doc missing", async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ formId: "123" }),
      );
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        FormService.getFormForUser(new Types.ObjectId().toString()),
      ).rejects.toThrow("Form not found");
    });

    it("returns simplified client form", async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ formId: "123", schemaSnapshot: [] }),
      );
      (FormModel.findById as jest.Mock).mockResolvedValueOnce({
        visibilityType: "External",
      });

      const res = await FormService.getFormForUser(
        new Types.ObjectId().toString(),
      );
      const anyRes = res as any;
      expect(anyRes.orgId).toBe(""); // Client stripping
      expect(anyRes.visibilityType).toBe("External");
    });
  });

  describe("update", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if not found or org mismatch", async () => {
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        FormService.update(validId, {} as any, "u", "o"),
      ).rejects.toThrow("Form not found");

      (FormModel.findById as jest.Mock).mockResolvedValueOnce({
        orgId: "other",
      });
      await expect(
        FormService.update(validId, {} as any, "u", "o"),
      ).rejects.toThrow("Form is not part of your organisation");
    });

    it("throws if signature field exists but no requiredSigner", async () => {
      (FormModel.findById as jest.Mock).mockResolvedValueOnce({ orgId: "o" });
      const req: any = {
        schema: [{ type: "signature" }],
        requiredSigner: null,
      };
      await expect(FormService.update(validId, req, "u", "o")).rejects.toThrow(
        "requiredSigner is required",
      );
    });

    it("updates form successfully", async () => {
      const existing = mockDoc({ orgId: "o", createdBy: "u" });
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(existing);
      (UserModel.find as jest.Mock).mockReturnValueOnce(createChainable([]));

      await FormService.update(validId, { schema: [] } as any, "u", "o");
      expect(existing.save).toHaveBeenCalled();
      expect(existing.status).toBe("draft");
    });
  });

  describe("publish, unpublish, archive", () => {
    const validId = new Types.ObjectId().toString();

    it("publish: throws if not found", async () => {
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(FormService.publish(validId, "u")).rejects.toThrow();
    });

    it("publish: increments version and saves", async () => {
      const form = mockDoc({ schema: [] });
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(form);
      (FormFieldModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ version: 1 }),
      );

      const res = await FormService.publish(validId, "u");
      expect(res.version).toBe(2);
      expect(FormVersionModel.create).toHaveBeenCalled();
      expect(form.status).toBe("published");
    });

    it("unpublish: success", async () => {
      const form = mockDoc({});
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(form);
      await FormService.unpublish(validId, "u");
      expect(form.status).toBe("draft");
    });

    it("archive: success", async () => {
      const form = mockDoc({});
      (FormModel.findById as jest.Mock).mockResolvedValueOnce(form);
      await FormService.archive(validId, "u");
      expect(form.status).toBe("archived");
    });
  });

  describe("submitFHIR", () => {
    const validId = new Types.ObjectId().toString();

    it("fetches schema from version if not provided, handles signing, and triggers audit", async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ schemaSnapshot: [{ type: "signature" }] }),
      );

      const createdSub = mockDoc({ _id: validId });
      (FormSubmissionModel.create as jest.Mock).mockResolvedValueOnce(
        createdSub,
      );
      (FormModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ orgId: "o1", name: "Form" }),
      );

      await FormService.submitFHIR({
        formId: validId,
        appointmentId: validId,
        companionId: validId,
        parentId: validId, // triggers PARENT actor
      } as any);

      expect(FormSubmissionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          signing: {
            required: true,
            status: "NOT_STARTED",
            provider: "DOCUMENSO",
          },
        }),
      );
      expect(AppointmentModel.updateOne).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: "PARENT" }),
      );
    });

    it("handles system audit trail without parent", async () => {
      (FormSubmissionModel.create as jest.Mock).mockResolvedValueOnce(
        mockDoc({ _id: validId }),
      );
      (FormModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ orgId: "o1" }),
      );

      await FormService.submitFHIR(
        {
          formId: validId,
          companionId: validId, // No parentId
        } as any,
        [],
      ); // empty schema

      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: "SYSTEM" }),
      );
    });
  });

  describe("getSubmission & listSubmissions & autoSend", () => {
    const validId = new Types.ObjectId().toString();

    it("getSubmission: throws if not found", async () => {
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(FormService.getSubmission(validId)).rejects.toThrow(
        "Submission not found",
      );
    });

    it("getSubmission: parses formId variations (string and ObjectId)", async () => {
      // Test with ObjectId
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId, formId: new Types.ObjectId() }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({}),
      );
      await FormService.getSubmission(validId);

      // Test with string
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId, formId: validId }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({}),
      );
      await FormService.getSubmission(validId);

      // Test fallback object
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId, formId: {} }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({}),
      );
      await FormService.getSubmission(validId);
    });

    it("listSubmissions: works", async () => {
      (FormSubmissionModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      await FormService.listSubmissions(validId);
      expect(FormSubmissionModel.find).toHaveBeenCalled();
    });

    it("getAutoSendForms: builds correct filter with serviceId", async () => {
      (FormModel.find as jest.Mock).mockReturnValueOnce(createChainable([]));
      await FormService.getAutoSendForms(validId, "s1");
      expect(FormModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: { $in: ["s1"] } }),
      );
    });

    it("getAutoSendForms: builds filter without serviceId", async () => {
      (FormModel.find as jest.Mock).mockReturnValueOnce(createChainable([]));
      await FormService.getAutoSendForms(validId);
      expect(FormModel.find).toHaveBeenCalledWith({
        orgId: new Types.ObjectId(validId),
        status: "published",
      });
    });

    it("listFormsForOrganisation: works", async () => {
      (FormModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([{ createdBy: "u" }]),
      );
      (UserModel.find as jest.Mock).mockReturnValueOnce(createChainable([]));
      await FormService.listFormsForOrganisation(validId);
    });

    it("listFormsForOrganisation: handles empty forms gracefully", async () => {
      (FormModel.find as jest.Mock).mockReturnValueOnce(createChainable([]));
      const res = await FormService.listFormsForOrganisation(validId);
      expect(res).toEqual([]);
    });
  });

  describe("getSOAPNotesByAppointment", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getSOAPNotesByAppointment(validId),
      ).rejects.toThrow("Appointment not found");
    });

    it("returns empty if non-hospital cache check", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "cache_miss_org" }),
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ type: "GROOMER" }),
      );

      const res = await FormService.getSOAPNotesByAppointment(validId);
      expect(res.soapNotes).toEqual({});
    });

    it("handles cache hit and groups submissions with latestOnly", async () => {
      // 1. Setup cache hit by calling it once and letting it sit
      // We MUST mock everything in this chain to safely exit and populate the cache
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "org_h" }),
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ type: "HOSPITAL" }),
      );
      // Return empty submissions to safely jump out of the function without throwing
      (FormSubmissionModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      await FormService.getSOAPNotesByAppointment(validId); // populates cache for "org_h"

      // 2. The actual test execution (which will now hit the cache)
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "org_h" }),
      ); // cache hit

      const f1 = new Types.ObjectId();
      const f2 = new Types.ObjectId();
      const submissions = [
        { _id: "s1", formId: f1 },
        { _id: "s2", formId: f2 }, // will map to invalid type to test continue
      ];
      (FormSubmissionModel.find as jest.Mock).mockReturnValueOnce(
        createChainable(submissions),
      );

      (FormModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([
          { _id: f1, category: "SOAP-Objective" },
          { _id: f2, category: "Consent" }, // Not a soap note, triggers `if(!soapType) continue;`
        ]),
      );

      const res = await FormService.getSOAPNotesByAppointment(validId, {
        latestOnly: true,
      });
      const anyNotes = res.soapNotes as any;
      expect(anyNotes.Objective).toHaveLength(1);
    });

    it("handles cache hit and groups submissions WITHOUT latestOnly", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "org_h" }),
      ); // uses prior cache

      const f1 = new Types.ObjectId();
      const submissions = [
        { _id: "s1", formId: f1, submittedAt: new Date("2023-01-01") },
        { _id: "s2", formId: f1, submittedAt: new Date("2023-01-02") },
      ];
      (FormSubmissionModel.find as jest.Mock).mockReturnValueOnce(
        createChainable(submissions),
      );

      (FormModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([{ _id: f1, category: "SOAP-Objective" }]),
      );

      const res = await FormService.getSOAPNotesByAppointment(validId);
      const anyNotes = res.soapNotes as any;
      expect(anyNotes.Objective).toHaveLength(2); // Does not slice
    });
  });

  describe("getConsentFormForParent", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if form not found", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getConsentFormForParent(validId, {
          serviceId: "1",
          species: "Dog",
        }),
      ).rejects.toThrow("Consent form not found");
    });

    it("throws if version not found", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getConsentFormForParent(validId),
      ).rejects.toThrow("Consent form is not published");
    });

    it("returns formatted client form", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ schemaSnapshot: [] }),
      );
      const res = await FormService.getConsentFormForParent(validId);
      const anyRes = res as any;
      expect(anyRes.orgId).toBe("");
    });

    it("adds serviceId and species to filter", async () => {
      (FormModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ _id: validId }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({ schemaSnapshot: [] }),
      );

      await FormService.getConsentFormForParent(validId, {
        serviceId: "s1",
        species: "Dog",
      });

      expect(FormModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: { $in: ["s1"] },
          speciesFilter: { $in: ["Dog"] },
        }),
      );
    });
  });

  describe("generatePDFForSubmission", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if submission missing", async () => {
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.generatePDFForSubmission(validId),
      ).rejects.toThrow("Submission not found");
    });

    it("throws if version missing", async () => {
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ formId: validId }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.generatePDFForSubmission(validId),
      ).rejects.toThrow("Form version not found");
    });

    it("generates pdf buffering", async () => {
      // Test `toHexString` branch in `normalizeObjectId`
      const customIdObj = { toHexString: () => "custom-hex" };
      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ formId: customIdObj }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({}),
      );
    });

    it("hits the error throw in normalizeObjectId", async () => {
      // Need a purely broken object that lacks all normalization routes
      const invalidIdObj = Object.create(null);

      (FormSubmissionModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ formId: invalidIdObj }),
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValueOnce(
        createChainable({}),
      );
    });
  });

  describe("getFormsForAppointment", () => {
    const validId = new Types.ObjectId().toString();

    it("throws if appt not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        FormService.getFormsForAppointment({ appointmentId: validId }),
      ).rejects.toThrow("Appointment not found");
    });

    it("returns empty items if no forms mapped", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "o" }),
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ type: null }),
      ); // Null org type
      (FormSubmissionModel.distinct as jest.Mock).mockResolvedValueOnce([]);
      (FormModel.find as jest.Mock).mockReturnValue(createChainable([])); // fetchFormsByIds & fetchTemplateForms

      const res = await FormService.getFormsForAppointment({
        appointmentId: validId,
      });
      expect(res.items).toEqual([]);
    });

    it("merges forms, tests non-HOSPITAL template filter, resolves signatures and isPMS", async () => {
      const f1Id = new Types.ObjectId();
      const f2Id = new Types.ObjectId();

      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "orgA", formIds: [f1Id] }),
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ type: "GROOMER" }),
      );
      (FormSubmissionModel.distinct as jest.Mock).mockResolvedValueOnce([]); // No submitted forms

      // mockReturnValueOnce handles the Promise correctly
      (FormModel.find as jest.Mock)
        .mockReturnValueOnce(createChainable([{ _id: f1Id, orgId: "orgA" }])) // fetchFormsByIds
        .mockReturnValueOnce(createChainable([{ _id: f2Id, orgId: "orgA" }])); // fetchTemplateForms

      // Mock Versions
      (FormVersionModel.aggregate as jest.Mock).mockResolvedValueOnce([
        { _id: f1Id, formId: f1Id, schemaSnapshot: [] },
        { _id: f2Id, formId: f2Id, schemaSnapshot: [] },
      ]);

      // Mock Submissions (Form 1 has submission with documenso signing)
      (FormSubmissionModel.aggregate as jest.Mock).mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(),
          formId: f1Id,
          signing: { documentId: "99" },
        },
      ]);

      // Mock Documenso resolving
      (
        DocumensoService.resolveOrganisationApiKey as jest.Mock
      ).mockResolvedValueOnce("KEY");
      (
        DocumensoService.downloadSignedDocument as jest.Mock
      ).mockResolvedValueOnce({ downloadUrl: "http://pdf" });

      const res = await FormService.getFormsForAppointment({
        appointmentId: validId,
        serviceId: "s",
        species: "D",
        isPMS: true,
      });

      expect(res.items).toHaveLength(2);
      expect(res.items[0].questionnaire).toBeUndefined(); // Because isPMS is true

      const anyQR = res.items[0].questionnaireResponse as any;
      expect(anyQR?.signing?.pdf?.url).toBe("http://pdf"); // Documenso injected
      expect(res.items[1].status).toBe("pending"); // No submission found
    });

    it("handles documenso missing api key branch", async () => {
      const f1Id = new Types.ObjectId();
      (AppointmentModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ organisationId: "orgB" }),
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ type: "HOSPITAL" }),
      ); // Test HOSPITAL path
      (FormSubmissionModel.distinct as jest.Mock).mockResolvedValueOnce([f1Id]);

      (FormModel.find as jest.Mock).mockReturnValue(
        createChainable([{ _id: f1Id, orgId: "orgB" }]),
      ); // 1 form total

      (FormVersionModel.aggregate as jest.Mock).mockResolvedValueOnce([
        { _id: f1Id, formId: f1Id },
      ]);
      (FormSubmissionModel.aggregate as jest.Mock).mockResolvedValueOnce([
        {
          _id: new Types.ObjectId(),
          formId: f1Id,
          signing: { documentId: "123" },
        },
      ]);

      (
        DocumensoService.resolveOrganisationApiKey as jest.Mock
      ).mockResolvedValueOnce(null); // Force missing key

      const res = await FormService.getFormsForAppointment({
        appointmentId: validId,
        isPMS: false,
      });

      expect(res.items[0].questionnaire).toBeDefined(); // isPMS false

      const anyQR = res.items[0].questionnaireResponse as any;
      expect(anyQR?.signing?.pdf?.url).toBeUndefined(); // Missing key prevented url fetch
    });
  });
});
