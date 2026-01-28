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

jest.mock('@yosemite-crew/types', () => {
  const actual = jest.requireActual('@yosemite-crew/types');
  return {
    ...actual,
    toFormResponseDTO: jest.fn((doc) => ({ ...doc, id: doc._id?.toString() })),
    toFHIRQuestionnaire: jest.fn(() => ({ resourceType: 'Questionnaire' })),
    toFHIRQuestionnaireResponse: jest.fn((sub) => ({ resourceType: 'QuestionnaireResponse', ...sub })),
  };
});

// FIX: Robust chain helper including select, lean, and then
const mockMongooseChain = (finalResult: any) => {
  const chain: any = {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(finalResult),
    exec: jest.fn().mockResolvedValue(finalResult),
  };
  // IMPORTANT: Make the chain thenable so it can be awaited directly
  chain.then = (resolve: any, reject: any) => Promise.resolve(finalResult).then(resolve, reject);
  return chain;
};

// Helper for findOne chain handling nulls
const mockFindOneChain = (finalResult: any) => {
    const chain: any = {
        lean: jest.fn().mockResolvedValue(finalResult),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(finalResult),
        select: jest.fn().mockReturnThis(),
    };
    chain.then = (resolve: any, reject: any) => Promise.resolve(finalResult).then(resolve, reject);
    return chain;
};

describe('FormService', () => {
  const mockOrgId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();
  const mockFormId = new Types.ObjectId();
  const mockSubmissionId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers(); // Ensure real timers to prevent timeouts
  });

  // --- Tests ---
  describe('submitFHIR', () => {
    it('should create submission', async () => {
      (FormSubmissionModel.create as jest.Mock).mockResolvedValue({
        toObject: jest.fn().mockReturnValue({ _id: 'sub1' }),
      });

      const validFormId = new Types.ObjectId().toString();
      const mockPayload = {
        resourceType: 'QuestionnaireResponse',
        questionnaire: validFormId,
        item: []
      } as any;

      // Mock finding version for validation (with select)
      (FormVersionModel.findOne as jest.Mock).mockReturnValue(mockFindOneChain({ schemaSnapshot: [] }));

      const result = await FormService.submitFHIR(mockPayload);
      expect(result._id).toBe('sub1');
    });
  });
});