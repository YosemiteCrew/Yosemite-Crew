import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { CompanionOrganisationController } from '../../../src/controllers/app/companion-organisation.controller';
import { CompanionOrganisationService } from '../../../src/services/companion-organisation.service';
import { ParentService } from '../../../src/services/parent.service';
import OrganizationModel from '../../../src/models/organization';
import logger from '../../../src/utils/logger';

// ----------------------------------------------------------------------
// 1. Setup Mocks with Factory to preserve the Error Class
// ----------------------------------------------------------------------

// We need the REAL Error class, but MOCKED Service methods
jest.mock('../../../src/services/companion-organisation.service', () => {
  const actual = jest.requireActual('../../../src/services/companion-organisation.service') as unknown as any;
  return {
    ...actual, // Preserves CompanionOrganisationServiceError class
    CompanionOrganisationService: {
      linkByParent: jest.fn(),
      linkByPmsUser: jest.fn(),
      parentApproveLink: jest.fn(),
      parentRejectLink: jest.fn(),
      sendInvite: jest.fn(),
      acceptInvite: jest.fn(),
      rejectInvite: jest.fn(),
      revokeLink: jest.fn(),
      getLinksForCompanion: jest.fn(),
      getLinksForOrganisation: jest.fn(),
      getLinksForCompanionByOrganisationTye: jest.fn(), // Matches the typo in controller
    },
  };
});

jest.mock('../../../src/services/parent.service');
jest.mock('../../../src/models/organization');
jest.mock('../../../src/utils/logger');

// Import the REAL class for the test helper to use
const { CompanionOrganisationServiceError } = jest.requireActual('../../../src/services/companion-organisation.service') as unknown as any;

// ----------------------------------------------------------------------
// 2. Create Typed Mock References
// ----------------------------------------------------------------------
const mockedCompanionService = jest.mocked(CompanionOrganisationService);
const mockedParentService = jest.mocked(ParentService);
const mockedOrgModel = jest.mocked(OrganizationModel);
const mockedLogger = jest.mocked(logger);

describe('CompanionOrganisationController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 3. Helpers
  // ----------------------------------------------------------------------
 const mockServiceError = (
  method: keyof typeof CompanionOrganisationService,
  status = 400,
  msg = 'Error'
) => {
  const error = new CompanionOrganisationServiceError(msg, status);
  error.statusCode = status;

  mockedCompanionService[method].mockRejectedValue(error);
};

const mockGenericError = (
  method: keyof typeof CompanionOrganisationService
) => {
  mockedCompanionService[method].mockRejectedValue(new Error('Boom'));
};


  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe('User ID Resolution (Coverage for helper)', () => {
    it('should resolve user id from header x-user-id', async () => {
      req.headers = { 'x-user-id': 'header-user' };
      // mocking findByLinkedUserId to return null to stop execution early, just testing the auth extraction
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);

      await CompanionOrganisationController.linkByParent(req as Request, res as Response);

      expect(mockedParentService.findByLinkedUserId).toHaveBeenCalledWith('header-user');
    });

    it('should resolve user id from req.userId', async () => {
      (req as any).userId = 'req-user';
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);

      await CompanionOrganisationController.linkByParent(req as Request, res as Response);

      expect(mockedParentService.findByLinkedUserId).toHaveBeenCalledWith('req-user');
    });
  });

  describe('linkByParent', () => {
    it('should return 401 if no user ID', async () => {
      (req as any).userId = undefined;
      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'User not authenticated' });
    });

    it('should return 401 if parent not found', async () => {
      (req as any).userId = 'user123';
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);
      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 400 if body is null/non-object', async () => {
      (req as any).userId = 'user1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = null;
      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 if payload is invalid (missing fields/invalid type)', async () => {
      (req as any).userId = 'user1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);

      // Missing organisationId
      req.body = { companionId: 'c1', organisationType: 'HOSPITAL' };
      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);

      // Invalid Org Type
      req.body = { companionId: 'c1', organisationId: 'o1', organisationType: 'INVALID' };
      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should success (201)', async () => {
      (req as any).userId = 'user1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { companionId: 'c1', organisationId: 'o1', organisationType: 'HOSPITAL' };

      mockedCompanionService.linkByParent.mockResolvedValue({ id: 'link1' } as any);

      await CompanionOrganisationController.linkByParent(req as Request, res as Response);

      expect(mockedCompanionService.linkByParent).toHaveBeenCalledWith({
        parentId: 'p1',
        companionId: 'c1',
        organisationId: 'o1',
        organisationType: 'HOSPITAL'
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should handle Service Error (409)', async () => {
      (req as any).userId = 'user1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { companionId: 'c1', organisationId: 'o1', organisationType: 'HOSPITAL' };

      mockServiceError('linkByParent', 409, 'Conflict');

      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Conflict' });
    });

    it('should handle Generic Error', async () => {
      (req as any).userId = 'user1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { companionId: 'c1', organisationId: 'o1', organisationType: 'HOSPITAL' };

      mockGenericError('linkByParent');

      await CompanionOrganisationController.linkByParent(req as Request, res as Response);
      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('linkByPmsUser', () => {
    it('should return 401 if unauthenticated', async () => {
      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 400 if params missing', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1' }; // missing organisationId
      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 404 if organisation not found', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1', organisationId: 'o1' };
      mockedOrgModel.findById.mockResolvedValue(null);

      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should return 404 if organisation type invalid', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1', organisationId: 'o1' };
      mockedOrgModel.findById.mockResolvedValue({ type: 'INVALID' } as any);

      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should success (201)', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1', organisationId: 'o1' };
      mockedOrgModel.findById.mockResolvedValue({ type: 'GROOMER' } as any);
      mockedCompanionService.linkByPmsUser.mockResolvedValue({ id: 'l1' } as any);

      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should handle service errors', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1', organisationId: 'o1' };
      mockedOrgModel.findById.mockResolvedValue({ type: 'GROOMER' } as any);

      mockServiceError('linkByPmsUser', 400);

      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic errors', async () => {
      (req as any).userId = 'pms';
      req.params = { companionId: 'c1', organisationId: 'o1' };
      mockedOrgModel.findById.mockResolvedValue({ type: 'GROOMER' } as any);

      mockGenericError('linkByPmsUser');

      await CompanionOrganisationController.linkByPmsUser(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('approvePendingLink', () => {
    it('should 401 if no auth', async () => {
      await CompanionOrganisationController.approvePendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should 401 if parent not found', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);
      await CompanionOrganisationController.approvePendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should success (200)', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.params = { linkId: 'l1' };
      mockedCompanionService.parentApproveLink.mockResolvedValue({} as any);

      await CompanionOrganisationController.approvePendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.params = { linkId: 'l1' };

      mockServiceError('parentApproveLink', 404);

      await CompanionOrganisationController.approvePendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should handle generic error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      mockGenericError('parentApproveLink');

      await CompanionOrganisationController.approvePendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('denyPendingLink', () => {
    it('should 401 if no auth', async () => {
      await CompanionOrganisationController.denyPendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should 401 if parent not found', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);
      await CompanionOrganisationController.denyPendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should success (200)', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.params = { linkId: 'l1' };
      mockedCompanionService.parentRejectLink.mockResolvedValue({} as any);

      await CompanionOrganisationController.denyPendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.params = { linkId: 'l1' };

      mockServiceError('parentRejectLink', 404);

      await CompanionOrganisationController.denyPendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should handle generic error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      mockGenericError('parentRejectLink');

      await CompanionOrganisationController.denyPendingLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('sendInvite', () => {
    it('should 401 if no auth', async () => {
      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should 401 if parent not found', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue(null);
      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should 400 if payload invalid (structure)', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = 'not-an-object';
      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should 400 if payload missing keys (companionId)', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { organisationType: 'HOSPITAL' };
      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should 400 if payload invalid (no contact info)', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = {
        companionId: 'c1',
        organisationType: 'HOSPITAL',
        email: '',
        name: ' ',
        placesId: undefined
      };
      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should success (201) with email', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = {
        companionId: 'c1',
        organisationType: 'HOSPITAL',
        email: 'test@test.com'
      };
      mockedCompanionService.sendInvite.mockResolvedValue({} as any);

      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(mockedCompanionService.sendInvite).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@test.com' }));
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should handle service error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { companionId: 'c1', organisationType: 'HOSPITAL', email: 'test@test.com' };

      mockServiceError('sendInvite', 400);

      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      (req as any).userId = 'u1';
      mockedParentService.findByLinkedUserId.mockResolvedValue({ _id: 'p1' } as any);
      req.body = { companionId: 'c1', organisationType: 'HOSPITAL', email: 'test@test.com' };

      mockGenericError('sendInvite');

      await CompanionOrganisationController.sendInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('acceptInvite', () => {
    it('should 400 if payload invalid (missing token/orgId)', async () => {
      req.body = { token: 't1' }; // missing orgId
      await CompanionOrganisationController.acceptInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);

      req.body = null;
      await CompanionOrganisationController.acceptInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should success (200)', async () => {
      req.body = { token: 't1', organisationId: 'o1' };
      mockedCompanionService.acceptInvite.mockResolvedValue({} as any);

      await CompanionOrganisationController.acceptInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      req.body = { token: 't1', organisationId: 'o1' };
      mockServiceError('acceptInvite', 400);
      await CompanionOrganisationController.acceptInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      req.body = { token: 't1', organisationId: 'o1' };
      mockGenericError('acceptInvite');
      await CompanionOrganisationController.acceptInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('rejectInvite', () => {
    it('should 400 if payload invalid', async () => {
      req.body = {};
      await CompanionOrganisationController.rejectInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should success (200)', async () => {
      req.body = { token: 't1', organisationId: 'o1' };
      mockedCompanionService.rejectInvite.mockResolvedValue({} as any);

      await CompanionOrganisationController.rejectInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
       req.body = { token: 't1', organisationId: 'o1' };
       // mocking explicit reject since rejectInvite in controller does check for service error
       mockServiceError('rejectInvite', 404);
       await CompanionOrganisationController.rejectInvite(req as Request, res as Response);
       expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should handle generic error', async () => {
      req.body = { token: 't1', organisationId: 'o1' };
      mockGenericError('rejectInvite');
      await CompanionOrganisationController.rejectInvite(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('revokeLink', () => {
    it('should success (200)', async () => {
      req.params = { linkId: 'l1' };
      mockedCompanionService.revokeLink.mockResolvedValue({} as any);
      await CompanionOrganisationController.revokeLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      req.params = { linkId: 'l1' };
      mockServiceError('revokeLink', 400);
      await CompanionOrganisationController.revokeLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      req.params = { linkId: 'l1' };
      mockGenericError('revokeLink');
      await CompanionOrganisationController.revokeLink(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getLinksForCompanion', () => {
    it('should success', async () => {
      req.params = { companionId: 'c1' };
      mockedCompanionService.getLinksForCompanion.mockResolvedValue([] as any);
      await CompanionOrganisationController.getLinksForCompanion(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle generic error', async () => {
      mockGenericError('getLinksForCompanion');
      await CompanionOrganisationController.getLinksForCompanion(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getLinksForOrganisation', () => {
    it('should success', async () => {
      req.params = { organisationId: 'o1' };
      mockedCompanionService.getLinksForOrganisation.mockResolvedValue([] as any);
      await CompanionOrganisationController.getLinksForOrganisation(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle generic error', async () => {
      mockGenericError('getLinksForOrganisation');
      await CompanionOrganisationController.getLinksForOrganisation(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getLinksForCompanionByOrganisationType', () => {
    it('should 400 if companionId missing', async () => {
      req.params = {};
      req.query = { type: 'HOSPITAL' };
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should 400 if type invalid', async () => {
      req.params = { companionId: 'c1' };
      req.query = { type: 'INVALID' };
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should success', async () => {
      req.params = { companionId: 'c1' };
      req.query = { type: 'HOSPITAL' };
      // Note: Typo in mocked method matches controller usage
      mockedCompanionService.getLinksForCompanionByOrganisationTye.mockResolvedValue([] as any);

      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(req as Request, res as Response);
      expect(mockedCompanionService.getLinksForCompanionByOrganisationTye).toHaveBeenCalledWith('c1', 'HOSPITAL');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      req.params = { companionId: 'c1' };
      req.query = { type: 'HOSPITAL' };
      mockServiceError('getLinksForCompanionByOrganisationTye', 400);
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      req.params = { companionId: 'c1' };
      req.query = { type: 'HOSPITAL' };
      mockGenericError('getLinksForCompanionByOrganisationTye');
      await CompanionOrganisationController.getLinksForCompanionByOrganisationType(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});