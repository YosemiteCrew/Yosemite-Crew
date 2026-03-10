import { Types } from 'mongoose';
import { CompanionController } from '../../src/controllers/app/companion.controller';
import { CompanionService, CompanionServiceError } from '../../src/services/companion.service';
import { CompanionOrganisationService } from '../../src/services/companion-organisation.service';
import OrganizationModel from '../../src/models/organization';
import { generatePresignedUrl } from 'src/middlewares/upload';
import logger from '../../src/utils/logger';

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---

jest.mock('../../src/services/companion.service', () => {
  class MockCompanionServiceError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'CompanionServiceError';
    }
  }

  return {
    __esModule: true,
    CompanionServiceError: MockCompanionServiceError,
    CompanionService: {
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByName: jest.fn(),
      listByParent: jest.fn(),
    },
  };
});

jest.mock('../../src/services/companion-organisation.service', () => ({
  __esModule: true,
  CompanionOrganisationService: {
    linkByPmsUser: jest.fn(),
  },
}));

jest.mock('../../src/models/organization', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('src/middlewares/upload', () => ({
  __esModule: true,
  generatePresignedUrl: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('CompanionController', () => {
  let req: any;
  let res: any;

  const validFHIR = { resourceType: 'Patient' };
  const validObjectId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      userId: 'auth_user_123',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe('Internal Helpers & Payload Parsing (Tested via createCompanionMobile)', () => {
    it('resolveMobileUserId: should use x-user-id header if available', async () => {
      req.headers['x-user-id'] = 'header_id';
      req.body = validFHIR;
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: 'ok' });

      await CompanionController.createCompanionMobile(req, res);

      expect(CompanionService.create).toHaveBeenCalledWith(
        validFHIR,
        { authUserId: 'header_id' }
      );
    });

    it('extractFHIRPayload: should throw 400 if body is missing completely (falsy)', async () => {
      req.body = undefined;
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Request body is required.' });
    });

    it('extractFHIRPayload: should handle extracting from nested .payload property', async () => {
      req.body = { payload: validFHIR };
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: 'ok' });

      await CompanionController.createCompanionMobile(req, res);
      expect(CompanionService.create).toHaveBeenCalledWith(validFHIR, expect.any(Object));
    });

    it('isCompanionPayload: should throw 400 if payload is not an object (string)', async () => {
      req.body = 'string payload';
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid FHIR Patient payload.' });
    });

    it('isCompanionPayload: should throw 400 if payload is null', async () => {
      req.body = { payload: null };
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('isCompanionPayload: should throw 400 if resourceType is missing', async () => {
      req.body = { someOtherField: true };
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('isCompanionPayload: should throw 400 if resourceType is not Patient', async () => {
      req.body = { resourceType: 'Observation' };
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createCompanionMobile', () => {
    it('should return 401 if unauthenticated', async () => {
      req.userId = null;
      req.body = validFHIR;
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 201 on success', async () => {
      req.body = validFHIR;
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: 'created_mobile' });
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith('created_mobile');
    });

    it('should handle generic errors', async () => {
      req.body = validFHIR;
      (CompanionService.create as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.createCompanionMobile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createCompanionPMS', () => {
    it('should return 400 if parentId is missing or invalid', async () => {
      // Isolate payload inside 'payload' key so 'parentId' is stripped from the FHIR output
      req.body = { payload: validFHIR, parentId: undefined };
      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = { payload: validFHIR, parentId: 'invalid-id' };
      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create without linking if orgId is absent', async () => {
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = {};
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: { id: 'c1' } });

      await CompanionController.createCompanionPMS(req, res);

      expect(CompanionService.create).toHaveBeenCalledWith(validFHIR, { parentMongoId: expect.any(Types.ObjectId) });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'c1' });
      expect(CompanionOrganisationService.linkByPmsUser).not.toHaveBeenCalled();
    });

    it('should return 400 if orgId is invalid', async () => {
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = { orgId: 'invalid-org' };
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: { id: 'c1' } });

      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if orgId is present but user is unauthenticated', async () => {
      req.userId = null;
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = { orgId: validObjectId };
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: { id: 'c1' } });

      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if organisation is not found', async () => {
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = { orgId: validObjectId };
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: { id: 'c1' } });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);

      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should successfully link to org and return 201', async () => {
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = { orgId: validObjectId };
      (CompanionService.create as jest.Mock).mockResolvedValue({ response: { id: 'c1' } });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ type: 'HOSPITAL' });

      await CompanionController.createCompanionPMS(req, res);

      expect(CompanionOrganisationService.linkByPmsUser).toHaveBeenCalledWith({
        pmsUserId: 'auth_user_123',
        organisationId: validObjectId,
        organisationType: 'HOSPITAL',
        companionId: 'c1',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('should handle custom and generic errors', async () => {
      req.body = { payload: validFHIR, parentId: validObjectId };
      req.params = { orgId: validObjectId };

      (CompanionService.create as jest.Mock).mockRejectedValue(new CompanionServiceError('Custom', 409));
      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(409);

      (CompanionService.create as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.createCompanionPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCompanionById', () => {
    it('should return 400 if id is missing', async () => {
      await CompanionController.getCompanionById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if not found', async () => {
      req.params.id = 'c1';
      (CompanionService.getById as jest.Mock).mockResolvedValue(null);
      await CompanionController.getCompanionById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on success', async () => {
      req.params.id = 'c1';
      (CompanionService.getById as jest.Mock).mockResolvedValue({ response: 'data' });
      await CompanionController.getCompanionById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith('data');
    });

    it('should handle errors', async () => {
      req.params.id = 'c1';
      (CompanionService.getById as jest.Mock).mockRejectedValue(new CompanionServiceError('C', 403));
      await CompanionController.getCompanionById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (CompanionService.getById as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.getCompanionById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateCompanion', () => {
    it('should return 400 if id is missing', async () => {
      await CompanionController.updateCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if not found', async () => {
      req.params.id = 'c1';
      req.body = validFHIR;
      (CompanionService.update as jest.Mock).mockResolvedValue(null);
      await CompanionController.updateCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on success', async () => {
      req.params.id = 'c1';
      req.body = validFHIR;
      (CompanionService.update as jest.Mock).mockResolvedValue({ response: 'updated' });
      await CompanionController.updateCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle errors', async () => {
      req.params.id = 'c1';
      req.body = validFHIR;
      (CompanionService.update as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.updateCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteCompanion', () => {
    it('should return 400 if id is missing', async () => {
      await CompanionController.deleteCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 204 on success', async () => {
      req.params.id = 'c1';
      await CompanionController.deleteCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(CompanionService.delete).toHaveBeenCalledWith('c1', { authUserId: 'auth_user_123' });
    });

    it('should handle custom and generic errors', async () => {
      req.params.id = 'c1';
      (CompanionService.delete as jest.Mock).mockRejectedValue(new CompanionServiceError('err', 404));
      await CompanionController.deleteCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (CompanionService.delete as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.deleteCompanion(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('searchCompanionByName', () => {
    it('should return 400 if name is missing or not a string', async () => {
      await CompanionController.searchCompanionByName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.query.name = ['array'];
      await CompanionController.searchCompanionByName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 and search results', async () => {
      req.query.name = 'Fido';
      (CompanionService.getByName as jest.Mock).mockResolvedValue({ responses: ['res1'] });
      await CompanionController.searchCompanionByName(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['res1']);
    });

    it('should handle errors', async () => {
      req.query.name = 'Fido';
      (CompanionService.getByName as jest.Mock).mockRejectedValue(new CompanionServiceError('err', 403));
      await CompanionController.searchCompanionByName(req, res);
      expect(res.status).toHaveBeenCalledWith(403);

      (CompanionService.getByName as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.searchCompanionByName(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getProfileUploadUrl', () => {
    it('should return 400 if body is null or a string', async () => {
      req.body = null;
      await CompanionController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = 'string';
      await CompanionController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if mimeType property is missing or not a string', async () => {
      req.body = { otherKey: 'val' };
      await CompanionController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = { mimeType: 123 };
      await CompanionController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with url and key on success', async () => {
      req.body = { mimeType: 'image/jpeg' };
      (generatePresignedUrl as jest.Mock).mockResolvedValue({ url: 'http://url', key: 'key1' });
      await CompanionController.getProfileUploadUrl(req, res);

      expect(generatePresignedUrl).toHaveBeenCalledWith('image/jpeg', 'temp');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: 'http://url', key: 'key1' });
    });

    it('should handle generic errors', async () => {
      req.body = { mimeType: 'image/jpeg' };
      (generatePresignedUrl as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCompanionsByParentId', () => {
    it('should return 400 if parentId is missing', async () => {
      await CompanionController.getCompanionsByParentId(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 and search results', async () => {
      req.params.parentId = 'p1';
      (CompanionService.listByParent as jest.Mock).mockResolvedValue({ responses: ['comp1'] });
      await CompanionController.getCompanionsByParentId(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['comp1']);
    });

    it('should handle custom and generic errors', async () => {
      req.params.parentId = 'p1';
      (CompanionService.listByParent as jest.Mock).mockRejectedValue(new CompanionServiceError('err', 404));
      await CompanionController.getCompanionsByParentId(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (CompanionService.listByParent as jest.Mock).mockRejectedValue(new Error('Test error'));
      await CompanionController.getCompanionsByParentId(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});