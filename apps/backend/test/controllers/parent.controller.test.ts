import { ParentController } from '../../src/controllers/app/parent.controller';
import { ParentService, ParentServiceError } from '../../src/services/parent.service';
import { generatePresignedUrl } from 'src/middlewares/upload';
import logger from '../../src/utils/logger';

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---
jest.mock('../../src/services/parent.service', () => {
  class MockParentServiceError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'ParentServiceError';
    }
  }

  return {
    __esModule: true,
    ParentServiceError: MockParentServiceError,
    ParentService: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByName: jest.fn(),
    },
  };
});

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

describe('ParentController', () => {
  let req: any;
  let res: any;

  const validFHIR = { resourceType: 'RelatedPerson' };

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

  describe('Internal Helpers & Payload Parsing', () => {
    it('resolveUserIdFromRequest: should use x-user-id header if available', async () => {
      req.headers['x-user-id'] = 'header_id';
      req.body = validFHIR;
      (ParentService.create as jest.Mock).mockResolvedValue({ response: 'ok' });

      await ParentController.createParentMobile(req, res);

      expect(ParentService.create).toHaveBeenCalledWith(
        validFHIR,
        { source: 'mobile', authUserId: 'header_id' }
      );
    });

    it('extractFHIRPayload: should throw 400 if body is missing completely (falsy)', async () => {
      req.body = undefined;
      await ParentController.createParentPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Request body is required.' });
    });

    it('extractFHIRPayload: should handle extracting from nested .payload property', async () => {
      req.body = { payload: validFHIR };
      (ParentService.create as jest.Mock).mockResolvedValue({ response: 'ok' });

      await ParentController.createParentPMS(req, res);
      expect(ParentService.create).toHaveBeenCalledWith(validFHIR, expect.any(Object));
    });

    it('isParentPayload: should throw 400 if payload is not an object (string)', async () => {
      req.body = 'string payload';
      await ParentController.createParentPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid FHIR RelatedPerson payload.' });
    });

    it('isParentPayload: should throw 400 if payload is null', async () => {
      req.body = { payload: null };
      await ParentController.createParentPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('isParentPayload: should throw 400 if resourceType is missing', async () => {
      req.body = { someOtherField: true };
      await ParentController.createParentPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('isParentPayload: should throw 400 if resourceType is not RelatedPerson', async () => {
      req.body = { resourceType: 'Patient' };
      await ParentController.createParentPMS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Mobile Controllers', () => {
    describe('createParentMobile', () => {
      it('should return 401 if unauthenticated', async () => {
        req.userId = null;
        await ParentController.createParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should return 201 on success', async () => {
        req.body = validFHIR;
        (ParentService.create as jest.Mock).mockResolvedValue({ response: 'created' });
        await ParentController.createParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith('created');
      });

      it('should handle generic errors', async () => {
        req.body = validFHIR;
        (ParentService.create as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.createParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('getParentMobile', () => {
      it('should return 401 if unauthenticated', async () => {
        req.userId = null;
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should return 400 if id is missing', async () => {
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockResolvedValue(null);
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 200 on success', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockResolvedValue({ response: 'data' });
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith('data');
      });

      it('should handle custom and generic errors', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockRejectedValue(new ParentServiceError('Custom', 403));
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(403);

        (ParentService.get as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.getParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('updateParentMobile', () => {
      it('should return 401 if unauthenticated', async () => {
        req.userId = null;
        await ParentController.updateParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should return 400 if id is missing', async () => {
        await ParentController.updateParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockResolvedValue(null);
        await ParentController.updateParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 200 on success', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockResolvedValue({ response: 'updated' });
        await ParentController.updateParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle errors', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.updateParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('deleteParentMobile', () => {
      it('should return 401 if unauthenticated', async () => {
        req.userId = null;
        await ParentController.deleteParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should return 400 if id is missing', async () => {
        await ParentController.deleteParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockResolvedValue(false);
        await ParentController.deleteParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 204 on success', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockResolvedValue(true);
        await ParentController.deleteParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
      });

      it('should handle errors', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.deleteParentMobile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('PMS Controllers', () => {
    describe('createParentPMS', () => {
      it('should return 201 on success', async () => {
        req.body = validFHIR;
        (ParentService.create as jest.Mock).mockResolvedValue({ response: 'created_pms' });
        await ParentController.createParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(ParentService.create).toHaveBeenCalledWith(validFHIR, { source: 'pms' });
      });

      it('should handle errors', async () => {
        req.body = validFHIR;
        (ParentService.create as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.createParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('getParentPMS', () => {
      it('should return 400 if id missing', async () => {
        await ParentController.getParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockResolvedValue(null);
        await ParentController.getParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 200 on success', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockResolvedValue({ response: 'pms_data' });
        await ParentController.getParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle errors', async () => {
        req.params.id = 'p1';
        (ParentService.get as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.getParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('updateParentPMS', () => {
      it('should return 400 if id missing', async () => {
        await ParentController.updateParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockResolvedValue(null);
        await ParentController.updateParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 200 on success', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockResolvedValue({ response: 'pms_updated' });
        await ParentController.updateParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle errors', async () => {
        req.params.id = 'p1';
        req.body = validFHIR;
        (ParentService.update as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.updateParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('deleteParentPMS', () => {
      it('should return 400 if id missing', async () => {
        await ParentController.deleteParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should return 404 if not found', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockResolvedValue(false);
        await ParentController.deleteParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it('should return 204 on success', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockResolvedValue(true);
        await ParentController.deleteParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(204);
      });

      it('should handle errors', async () => {
        req.params.id = 'p1';
        (ParentService.delete as jest.Mock).mockRejectedValue(new Error('Test error'));
        await ParentController.deleteParentPMS(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('searchByName', () => {
    it('should return 400 if name is missing', async () => {
      await ParentController.searchByName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if name is not a string (e.g. array)', async () => {
      req.query.name = ['test'];
      await ParentController.searchByName(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 and search results', async () => {
      req.query.name = 'John';
      (ParentService.getByName as jest.Mock).mockResolvedValue({ responses: ['res1'] });
      await ParentController.searchByName(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['res1']);
    });

    it('should handle custom and generic errors', async () => {
      req.query.name = 'John';
      (ParentService.getByName as jest.Mock).mockRejectedValue(new ParentServiceError('Custom', 404));
      await ParentController.searchByName(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      (ParentService.getByName as jest.Mock).mockRejectedValue(new Error('Test error'));
      await ParentController.searchByName(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getProfileUploadUrl (Testing branch logic)', () => {
    it('should return 400 if body is null', async () => {
      req.body = null;
      await ParentController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'MIME type is required in the request body.' });
    });

    it('should return 400 if body is a string', async () => {
      req.body = 'string-body';
      await ParentController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if mimeType property is missing from object', async () => {
      req.body = { otherKey: 'val' };
      await ParentController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if mimeType is not a string', async () => {
      req.body = { mimeType: 123 };
      await ParentController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with url and key on success', async () => {
      req.body = { mimeType: 'image/jpeg' };
      (generatePresignedUrl as jest.Mock).mockResolvedValue({ url: 'http://url', key: 'key1' });
      await ParentController.getProfileUploadUrl(req, res);

      expect(generatePresignedUrl).toHaveBeenCalledWith('image/jpeg', 'temp');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: 'http://url', key: 'key1' });
    });

    it('should handle generic errors', async () => {
      req.body = { mimeType: 'image/jpeg' };
      (generatePresignedUrl as jest.Mock).mockRejectedValue(new Error('Test error'));
      await ParentController.getProfileUploadUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});