import { Types } from 'mongoose';
import { FormService } from '../../src/services/form.service';
import {
  FormModel,
  FormFieldModel,
  FormVersionModel,
  FormSubmissionModel,
} from '../../src/models/form';
import AppointmentModel from '../../src/models/appointment';
import { DocumensoService } from '../../src/services/documenso.service';
import { renderPdf, buildPdfViewModel } from '../../src/services/formPDF.service';
import * as TypesLib from '@yosemite-crew/types';

// --- Mocks ---
jest.mock('../../src/models/form');
jest.mock('../../src/models/appointment');
jest.mock('../../src/services/documenso.service');
jest.mock('../../src/services/formPDF.service');

// Mock types lib
jest.mock('@yosemite-crew/types', () => {
  const actual = jest.requireActual('@yosemite-crew/types');
  return {
    ...actual,
    toFormResponseDTO: jest.fn((doc) => ({ ...doc, id: doc._id?.toString() })),
    toFHIRQuestionnaire: jest.fn(() => ({ resourceType: 'Questionnaire' })),
    toFHIRQuestionnaireResponse: jest.fn((sub) => ({
      resourceType: 'QuestionnaireResponse',
      ...sub
    })),
  };
});

// --- Helper for Mongoose Chains ---
const mockMongooseChain = (finalResult: any) => {
  return {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(finalResult),
  };
};

const mockFindOneSortChain = (finalResult: any) => {
  return {
    sort: jest.fn().mockResolvedValue(finalResult)
  };
};

describe('FormService', () => {
  const mockOrgId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();
  const mockFormId = new Types.ObjectId();
  const mockSubmissionId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Helper Tests ---
  describe('Utilities (ObjectId helpers)', () => {
    it('should throw error for invalid ObjectId in ensureObjectId', async () => {
      await expect(FormService.getFormForAdmin(mockOrgId, 'invalid-id-format'))
        .rejects.toThrow('Invalid formId');
    });

    it('should handle normalizable ObjectId', async () => {
        const mockSub = {
            _id: mockSubmissionId,
            formId: new Types.ObjectId(),
            formVersion: 1,
            answers: {},
        };
        (FormSubmissionModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockSub),
        });
        (FormVersionModel.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ schemaSnapshot: [] }),
        });

        await FormService.getSubmission(mockSubmissionId.toString());
        expect(TypesLib.toFHIRQuestionnaireResponse).toHaveBeenCalled();
    });

    it('should handle string formId in normalizeObjectId', async () => {
         const mockSub = {
            _id: mockSubmissionId,
            formId: "some-string-id",
            formVersion: 1,
            answers: {},
        };
        (FormSubmissionModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockSub),
        });
        (FormVersionModel.findOne as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });

        await FormService.getSubmission(mockSubmissionId.toString());
        expect(TypesLib.toFHIRQuestionnaireResponse).toHaveBeenCalled();
    });
  });

  // --- CRUD Operations ---
  describe('create', () => {
    it('should create a form and sync fields', async () => {
      const mockRequest = {
        resourceType: 'Questionnaire',
        status: 'draft',
        name: 'Test Form',
        category: 'General',
        item: [],
        schema: [
            { id: 'f1', type: 'text', label: 'Field 1', required: true },
        ],
      } as any;

      (FormModel.create as jest.Mock).mockResolvedValue({
        _id: mockFormId,
        toObject: jest.fn().mockReturnValue({ ...mockRequest, _id: mockFormId }),
      });

      const result = await FormService.create(mockOrgId, mockRequest, mockUserId);

      expect(FormModel.create).toHaveBeenCalledWith(expect.objectContaining({
        orgId: new Types.ObjectId(mockOrgId),
        status: 'draft',
      }));
      expect(FormFieldModel.deleteMany).toHaveBeenCalledWith({ formId: mockFormId.toString() });
      expect(result).toHaveProperty('id');
    });
  });

  describe('getFormForAdmin', () => {
    it('should return form if found', async () => {
      (FormModel.findOne as jest.Mock).mockResolvedValue({
        toObject: jest.fn().mockReturnValue({ _id: mockFormId }),
      });

      const result = await FormService.getFormForAdmin(mockOrgId, mockFormId.toString());
      expect(result).toBeDefined();
    });

    it('should throw 404 if not found', async () => {
      (FormModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(FormService.getFormForAdmin(mockOrgId, mockFormId.toString()))
        .rejects.toThrow('Form not found');
    });
  });

  describe('getFormForUser', () => {
    it('should throw 400 if no published version', async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      await expect(FormService.getFormForUser(mockFormId.toString()))
        .rejects.toThrow('Form has no published version');
    });

    it('should throw 404 if parent form deleted', async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue({ formId: mockFormId, version: 1 }),
      });
      (FormModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(FormService.getFormForUser(mockFormId.toString()))
        .rejects.toThrow('Form not found');
    });

    it('should return simplified FHIR form', async () => {
      (FormVersionModel.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue({ formId: mockFormId, version: 1, schemaSnapshot: [] }),
      });
      (FormModel.findById as jest.Mock).mockResolvedValue({
        visibilityType: 'Public',
        status: 'published',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await FormService.getFormForUser(mockFormId.toString());
      expect((result as any).orgId).toBe("");
    });
  });

  describe('update', () => {
    it('should update form and reset status to draft', async () => {
      const mockDoc = {
        orgId: mockOrgId,
        save: jest.fn(),
        toObject: jest.fn().mockReturnValue({}),
        schema: [],
      };
      (FormModel.findById as jest.Mock).mockResolvedValue(mockDoc);

      const fhirUpdate = {
        resourceType: 'Questionnaire',
        name: 'Updated',
        status: 'active',
        item: []
      } as any;

      await FormService.update(mockFormId.toString(), fhirUpdate, mockUserId, mockOrgId);

      expect(mockDoc.save).toHaveBeenCalled();
      expect(FormFieldModel.deleteMany).toHaveBeenCalled();
    });

    it('should throw 404 if not found', async () => {
      (FormModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(FormService.update(mockFormId.toString(), {} as any, 'u', 'o'))
        .rejects.toThrow('Form not found');
    });

    it('should throw 400 if org mismatch', async () => {
      (FormModel.findById as jest.Mock).mockResolvedValue({ orgId: 'other-org' });
      await expect(FormService.update(mockFormId.toString(), {} as any, 'u', mockOrgId))
        .rejects.toThrow('Form is not part of your organisation');
    });
  });

  // --- Publish / Archive Actions ---
  describe('publish', () => {
    it('should publish first version', async () => {
      const mockDoc = { _id: mockFormId, schema: [], save: jest.fn() };
      (FormModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (FormFieldModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      (FormVersionModel.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const result = await FormService.publish(mockFormId.toString(), mockUserId);

      expect(result.version).toBe(1);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('should increment version', async () => {
      const mockDoc = { _id: mockFormId, schema: [], save: jest.fn() };
      (FormModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (FormFieldModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      (FormVersionModel.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue({ version: 5 }),
      });

      const result = await FormService.publish(mockFormId.toString(), mockUserId);
      expect(result.version).toBe(6);
    });

    it('should throw 404', async () => {
        (FormModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(FormService.publish(mockFormId.toString(), mockUserId)).rejects.toThrow('Form not found');
    });
  });

  describe('unpublish & archive', () => {
    it('should unpublish', async () => {
      const mockDoc = { save: jest.fn(), toObject: jest.fn() };
      (FormModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await FormService.unpublish(mockFormId.toString(), mockUserId);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('should archive', async () => {
      const mockDoc = { save: jest.fn(), toObject: jest.fn() };
      (FormModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await FormService.archive(mockFormId.toString(), mockUserId);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('should handle 404s', async () => {
        (FormModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(FormService.unpublish(mockFormId.toString(), mockUserId)).rejects.toThrow('Form not found');
        await expect(FormService.archive(mockFormId.toString(), mockUserId)).rejects.toThrow('Form not found');
    });
  });

  // --- Submissions ---
  describe('submitFHIR', () => {
    it('should create submission', async () => {
      (FormSubmissionModel.create as jest.Mock).mockResolvedValue({
        toObject: jest.fn().mockReturnValue({ _id: 'sub1' }),
      });
      const mockPayload = {
        resourceType: 'QuestionnaireResponse',
        questionnaire: 'f1',
        item: []
      } as any;

      const result = await FormService.submitFHIR(mockPayload);
      expect(result._id).toBe('sub1');
    });
  });

  describe('getSubmission', () => {
     it('should handle missing submission', async () => {
        (FormSubmissionModel.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        const validId = new Types.ObjectId().toHexString();
        await expect(FormService.getSubmission(validId)).rejects.toThrow('Submission not found');
     });
  });

  describe('listSubmissions', () => {
      it('should return list', async () => {
          (FormSubmissionModel.find as jest.Mock).mockReturnValue(mockMongooseChain([]));
          await FormService.listSubmissions(mockFormId.toString());
          expect(FormSubmissionModel.find).toHaveBeenCalledWith({ formId: mockFormId });
      });
  });

  describe('generatePDFForSubmission', () => {
      it('should generate pdf buffer', async () => {
          (FormSubmissionModel.findById as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue({ formId: mockFormId, version: 1, answers: {} })
          });
          (FormVersionModel.findOne as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue({ schemaSnapshot: [] })
          });
          (buildPdfViewModel as jest.Mock).mockReturnValue({});
          (renderPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));

          const res = await FormService.generatePDFForSubmission(mockSubmissionId.toString());
          expect(res).toBeInstanceOf(Buffer);
      });

      it('should throw 404 if submission missing', async () => {
        (FormSubmissionModel.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        await expect(FormService.generatePDFForSubmission(mockSubmissionId.toString())).rejects.toThrow('Submission not found');
      });

      it('should throw 404 if version missing', async () => {
        (FormSubmissionModel.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ formId: mockFormId }) });
        (FormVersionModel.findOne as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
        await expect(FormService.generatePDFForSubmission(mockSubmissionId.toString())).rejects.toThrow('Form version not found');
      });
  });

  // --- Specialized Business Logic ---
  describe('getAutoSendForms', () => {
      it('should filter by serviceId', async () => {
        (FormModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
        await FormService.getAutoSendForms(mockOrgId, 'srv1');
        expect(FormModel.find).toHaveBeenCalledWith(expect.objectContaining({
            serviceId: { $in: ['srv1'] }
        }));
      });
      it('should return all if no serviceId', async () => {
        (FormModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
        await FormService.getAutoSendForms(mockOrgId);
        expect(FormModel.find).toHaveBeenCalledWith(expect.not.objectContaining({ serviceId: expect.anything() }));
      });
  });

  describe('listFormsForOrganisation', () => {
      it('should return mapped dtos', async () => {
          (FormModel.find as jest.Mock).mockResolvedValue([{ _id: '1', toObject: ()=>({}) }]);
          const res = await FormService.listFormsForOrganisation(mockOrgId);
          expect(res).toHaveLength(1);
      });
  });

  describe('getSOAPNotesByAppointment', () => {
    it('should return empty structure if no submissions', async () => {
        (FormSubmissionModel.find as jest.Mock).mockReturnValue(mockMongooseChain([]));
        const res = await FormService.getSOAPNotesByAppointment('appt1');
        expect(res.soapNotes.Subjective).toEqual([]);
    });
  });

  describe('getConsentFormForParent', () => {
    it('should throw if form not found', async () => {
        (FormModel.findOne as jest.Mock).mockReturnValue(mockFindOneSortChain(null));
        await expect(FormService.getConsentFormForParent(mockOrgId)).rejects.toThrow('Consent form not found');
    });
  });

  describe('getFormsForAppointment', () => {
      const apptId = new Types.ObjectId();

      it('should return empty if appointment has no forms', async () => {
          (AppointmentModel.findById as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue({ formIds: [] })
          });
          const res = await FormService.getFormsForAppointment({ appointmentId: apptId.toString() });
          expect(res.items).toHaveLength(0);
      });

      it('should throw 404 if appointment missing', async () => {
          (AppointmentModel.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
          await expect(FormService.getFormsForAppointment({ appointmentId: apptId.toString() })).rejects.toThrow('Appointment not found');
      });

      it('should aggregate forms, versions, and submissions correctly', async () => {
          const fid1 = new Types.ObjectId();

          (AppointmentModel.findById as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue({ formIds: [fid1] })
          });

          (FormModel.find as jest.Mock).mockReturnValue({
              lean: jest.fn().mockResolvedValue([{ _id: fid1, status: 'published' }])
          });

          (FormVersionModel.aggregate as jest.Mock).mockResolvedValue([
              { formId: fid1, version: 1, schemaSnapshot: [] }
          ]);

          (FormSubmissionModel.aggregate as jest.Mock).mockResolvedValue([
              {
                  _id: new Types.ObjectId(),
                  formId: fid1,
                  signing: { documentId: '999' }
              }
          ]);

          (DocumensoService.downloadSignedDocument as jest.Mock).mockResolvedValue({ downloadUrl: 'http://pdf' });

          const res = await FormService.getFormsForAppointment({ appointmentId: apptId.toString() });

          expect(res.items).toHaveLength(1);
          expect(res.items[0].status).toBe('completed');
          expect(DocumensoService.downloadSignedDocument).toHaveBeenCalledWith(999);
          expect((res.items[0].questionnaireResponse as any)?.signing?.pdf?.url).toBe('http://pdf');
      });

      it('should skip forms with no version', async () => {
        const fid1 = new Types.ObjectId();
        (AppointmentModel.findById as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ formIds: [fid1] }) });
        (FormModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: fid1 }]) });
        (FormVersionModel.aggregate as jest.Mock).mockResolvedValue([]);

        const res = await FormService.getFormsForAppointment({ appointmentId: apptId.toString() });
        expect(res.items).toHaveLength(0);
      });
  });
});