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
import { renderPdf } from "../../src/services/formPDF.service";

// --- Mocks ---
jest.mock("../../src/models/form");
jest.mock("../../src/models/appointment");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/user");
jest.mock("../../src/services/documenso.service");
jest.mock("../../src/services/audit-trail.service");
jest.mock("../../src/services/formPDF.service");

// --- Helper: Universal Chain Mock ---
const createMockChain = (finalResult: any = null) => {
  return {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(finalResult),
    then: (resolve: any, reject: any) => Promise.resolve(finalResult).then(resolve, reject),
  } as any;
};

// --- Mock External Types Helpers ---
const mockFromFormRequestDTO = jest.fn((dto) => ({
  ...dto,
  schema: dto.schema || [],
  businessType: dto.businessType || "HOSPITAL",
  requiredSigner: dto.requiredSigner,
}));

jest.mock("@yosemite-crew/types", () => ({
  fromFormRequestDTO: (dto: any) => mockFromFormRequestDTO(dto),
  toFormResponseDTO: jest.fn((form) => form),
  fromFormSubmissionRequestDTO: jest.fn((dto) => dto),
  toFHIRQuestionnaireResponse: jest.fn((sub) => sub),
  toFHIRQuestionnaire: jest.fn((form) => form),
}));

describe("FormService", () => {
  let mockOrgId: Types.ObjectId;
  let mockUserId: string;
  let mockFormId: Types.ObjectId;
  let mockApptId: Types.ObjectId;
  let mockSubmissionId: Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgId = new Types.ObjectId();
    mockUserId = "user-" + Math.random();
    mockFormId = new Types.ObjectId();
    mockApptId = new Types.ObjectId();
    mockSubmissionId = new Types.ObjectId();

    // Default mock returns
    (FormModel.find as jest.Mock).mockReturnValue(createMockChain([]));
    (FormModel.findOne as jest.Mock).mockReturnValue(createMockChain(null));
    (FormModel.findById as jest.Mock).mockReturnValue(createMockChain(null));

    (FormVersionModel.find as jest.Mock).mockReturnValue(createMockChain([]));
    (FormVersionModel.findOne as jest.Mock).mockReturnValue(createMockChain(null));

    (FormSubmissionModel.find as jest.Mock).mockReturnValue(createMockChain([]));
    (FormSubmissionModel.findById as jest.Mock).mockReturnValue(createMockChain(null));

    (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockChain(null));
    (OrganizationModel.findById as jest.Mock).mockReturnValue(createMockChain(null));
  });

  describe("Utilities & Private Helpers", () => {
    it("should handle ObjectId normalization errors", async () => {
      await expect(FormService.getSubmission("invalid-hex-string")).rejects.toThrow(
        FormServiceError
      );
    });

    it("should resolve user names correctly", async () => {
      (FormModel.find as jest.Mock).mockReturnValue(
        createMockChain([
          { createdBy: "u1", updatedBy: "u2" },
          { createdBy: "u1", updatedBy: "u1" },
        ])
      );

      (UserModel.find as jest.Mock).mockReturnValue(
        createMockChain([
          { userId: "u1", firstName: "John", lastName: "Doe" },
          { userId: "u2", firstName: "Jane" },
        ])
      );

      const result = await FormService.listFormsForOrganisation(
        mockOrgId.toHexString()
      );
      expect((result[0] as any).createdBy).toBe("John Doe");
      expect((result[0] as any).updatedBy).toBe("Jane");
    });
  });

  describe("Validation Logic", () => {
    it("hasSignatureField should return false for empty fields", () => {
      expect(FormService.hasSignatureField([])).toBe(false);
      expect(FormService.hasSignatureField(undefined)).toBe(false);
    });

    it("hasSignatureField should detect recursive signatures", () => {
      const fields: any = [
        { type: "text" },
        { type: "group", fields: [{ type: "signature" }] },
      ];
      expect(FormService.hasSignatureField(fields)).toBe(true);
    });
  });

  describe("CRUD Operations", () => {
    it("create: should throw if signature exists but requiredSigner is missing", async () => {
      const dto: any = { schema: [{ type: "signature" }], requiredSigner: null };
      await expect(
        FormService.create(mockOrgId.toHexString(), dto, mockUserId)
      ).rejects.toThrow("requiredSigner is required");
    });

    it("create: should create form and sync fields", async () => {
      const dto: any = { schema: [{ type: "text", id: "t1" }], name: "Test" };
      const mockDoc = {
        _id: mockFormId,
        ...dto,
        toObject: () => ({ _id: mockFormId, ...dto }),
      };

      (FormModel.create as jest.Mock).mockResolvedValue(mockDoc);
      (UserModel.find as jest.Mock).mockReturnValue(createMockChain([]));

      const res = await FormService.create(
        mockOrgId.toHexString(),
        dto,
        mockUserId
      );

      expect(FormModel.create).toHaveBeenCalled();
      expect(FormFieldModel.deleteMany).toHaveBeenCalled();
      expect(FormFieldModel.insertMany).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it("getFormForAdmin: should throw if not found", async () => {
      await expect(
        FormService.getFormForAdmin(
          mockOrgId.toHexString(),
          mockFormId.toHexString()
        )
      ).rejects.toThrow("Form not found");
    });

    it("getFormForUser: should throw if no version published", async () => {
      await expect(
        FormService.getFormForUser(mockFormId.toHexString())
      ).rejects.toThrow("Form has no published version");
    });

    it("getFormForUser: should throw if version exists but form deleted", async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValue(
        createMockChain({ formId: mockFormId })
      );
      await expect(
        FormService.getFormForUser(mockFormId.toHexString())
      ).rejects.toThrow("Form not found");
    });

    it("update: should throw if form org mismatch", async () => {
      (FormModel.findById as jest.Mock).mockReturnValue(createMockChain({
        orgId: "other-org",
      }));

      await expect(
        FormService.update(
          mockFormId.toHexString(),
          {} as any,
          mockUserId,
          mockOrgId.toHexString()
        )
      ).rejects.toThrow("Form is not part of your organisation");
    });

    it("update: should update and set status to draft", async () => {
      const mockSave = jest.fn();
      (FormModel.findById as jest.Mock).mockReturnValue(createMockChain({
        orgId: mockOrgId.toHexString(),
        save: mockSave,
        toObject: () => ({ createdBy: "u1" }),
      }));
      (UserModel.find as jest.Mock).mockReturnValue(createMockChain([]));

      await FormService.update(
        mockFormId.toHexString(),
        { name: "Updated" } as any,
        mockUserId,
        mockOrgId.toHexString()
      );
      expect(mockSave).toHaveBeenCalled();
    });

    it("publish: should create new version", async () => {
      const mockSave = jest.fn();
      (FormModel.findById as jest.Mock).mockReturnValue(createMockChain({
        _id: mockFormId,
        schema: [],
        save: mockSave,
      }));
      (FormFieldModel.find as jest.Mock).mockReturnValue(createMockChain([]));
      (FormVersionModel.findOne as jest.Mock).mockReturnValue(
        createMockChain({ version: 1 })
      );

      const res = await FormService.publish(mockFormId.toHexString(), mockUserId);
      expect(res.version).toBe(2);
      expect(FormVersionModel.create).toHaveBeenCalled();
    });

    it("publish: should handle first version", async () => {
      (FormModel.findById as jest.Mock).mockReturnValue(createMockChain({
        _id: mockFormId,
        save: jest.fn(),
      }));
      (FormFieldModel.find as jest.Mock).mockReturnValue(createMockChain([]));

      const res = await FormService.publish(mockFormId.toHexString(), mockUserId);
      expect(res.version).toBe(1);
    });

    it("unpublish & archive: should update status", async () => {
      const mockForm = { save: jest.fn(), toObject: () => ({}) };
      (FormModel.findById as jest.Mock).mockReturnValue(createMockChain(mockForm));

      await FormService.unpublish(mockFormId.toHexString(), mockUserId);
      expect(mockForm.save).toHaveBeenCalled();

      await FormService.archive(mockFormId.toHexString(), mockUserId);
      expect(mockForm.save).toHaveBeenCalled();
    });
  });

  describe("Submissions", () => {
    it("submitFHIR: should resolve schema if not provided", async () => {
      const dto: any = { formId: mockFormId.toHexString(), formVersion: 1 };

      (FormVersionModel.findOne as jest.Mock).mockReturnValue(
        createMockChain({ schemaSnapshot: [] })
      );
      (FormSubmissionModel.create as jest.Mock).mockResolvedValue({
        _id: mockSubmissionId,
        toObject: () => ({}),
      });

      await FormService.submitFHIR(dto);
      expect(FormVersionModel.findOne).toHaveBeenCalled();
    });

    it("submitFHIR: should handle appointments and companion audit trails", async () => {
      const dto: any = {
        formId: mockFormId.toHexString(),
        appointmentId: mockApptId.toHexString(),
        companionId: "comp-1",
        parentId: "parent-1",
      };

      (FormSubmissionModel.create as jest.Mock).mockResolvedValue({
        _id: mockSubmissionId,
        toObject: () => ({}),
      });
      (FormModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ orgId: mockOrgId, name: "Test" })
      );

      await FormService.submitFHIR(dto);

      expect(AppointmentModel.updateOne).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("listSubmissions: should return list", async () => {
      (FormSubmissionModel.find as jest.Mock).mockReturnValue(
        createMockChain([])
      );
      await FormService.listSubmissions(mockFormId.toHexString());
      expect(FormSubmissionModel.find).toHaveBeenCalled();
    });
  });

  describe("Specialized Getters", () => {
    it("getAutoSendForms: should filter by serviceId", async () => {
      await FormService.getAutoSendForms(mockOrgId.toHexString(), "srv-1");
      expect(FormModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: { $in: ["srv-1"] },
        })
      );
    });

    it("getConsentFormForParent: should throw if no form found", async () => {
      await expect(
        FormService.getConsentFormForParent(mockOrgId.toHexString())
      ).rejects.toThrow("Consent form not found");
    });

    it("generatePDFForSubmission: should generate pdf", async () => {
      (FormSubmissionModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ formId: mockFormId })
      );
      (FormVersionModel.findOne as jest.Mock).mockReturnValue(
        createMockChain({ schemaSnapshot: [] })
      );
      (renderPdf as jest.Mock).mockResolvedValue(Buffer.from("pdf"));

      const res = await FormService.generatePDFForSubmission(
        mockSubmissionId.toHexString()
      );
      expect(res).toBeInstanceOf(Buffer);
    });
  });

  describe("Complex Aggregations (SOAP & Appointments)", () => {
    it("getSOAPNotesByAppointment: returns empty if org type is not HOSPITAL", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ organisationId: mockOrgId })
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ type: "BREEDER" })
      );

      const res = await FormService.getSOAPNotesByAppointment(
        mockApptId.toHexString()
      );
      expect(res.soapNotes).toEqual({});
    });

    it("getFormsForAppointment: handles submission with Documenso signature", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createMockChain({
          organisationId: mockOrgId,
          formIds: [mockFormId.toHexString()],
        })
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ type: "HOSPITAL" })
      );
      (FormSubmissionModel.distinct as jest.Mock).mockResolvedValue([]);

      (FormModel.find as jest.Mock).mockReturnValue(
        createMockChain([{ _id: mockFormId, orgId: mockOrgId }])
      );

      (FormVersionModel.aggregate as jest.Mock).mockResolvedValue([
        { formId: mockFormId, version: 1 },
      ]);

      (FormSubmissionModel.aggregate as jest.Mock).mockResolvedValue([
        {
          formId: mockFormId,
          _id: mockSubmissionId,
          signing: { documentId: "999" },
        },
      ]);

      (DocumensoService.resolveOrganisationApiKey as jest.Mock).mockResolvedValue(
        "api-key"
      );
      (DocumensoService.downloadSignedDocument as jest.Mock).mockResolvedValue({
        downloadUrl: "http://signed.pdf",
      });

      const res = await FormService.getFormsForAppointment({
        appointmentId: mockApptId.toHexString(),
      });

      const item = res.items[0];
      expect(item.status).toBe("completed");
      expect((item.questionnaireResponse as any).signing.pdf.url).toBe(
        "http://signed.pdf"
      );
    });

    it("getFormsForAppointment: returns empty if no forms found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ organisationId: mockOrgId })
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ type: "HOSPITAL" })
      );

      (FormModel.find as jest.Mock).mockReturnValue(createMockChain([]));

      const res = await FormService.getFormsForAppointment({
        appointmentId: mockApptId.toHexString(),
      });
      expect(res.items).toEqual([]);
    });

    it("resolveOrganizationType: should use cache", async () => {
      const freshOrgId = new Types.ObjectId();

      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createMockChain({ organisationId: freshOrgId })
      );

      const mockDbCall = jest.fn().mockResolvedValue({ type: "HOSPITAL" });
      (OrganizationModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: mockDbCall,
      } as any);

      // 1. First Call
      await FormService.getSOAPNotesByAppointment(
        new Types.ObjectId().toHexString()
      );
      // 2. Second Call (should hit cache based on freshOrgId)
      await FormService.getSOAPNotesByAppointment(
        new Types.ObjectId().toHexString()
      );

      expect(mockDbCall).toHaveBeenCalledTimes(1);
    });
  });
});