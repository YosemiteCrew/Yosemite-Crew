import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 3 levels
// ----------------------------------------------------------------------
import { OrganisationRatingController } from '../../../src/controllers/app/organisationRating.controller';
import { AuthUserMobileService } from '../../../src/services/authUserMobile.service';
import { OrganizationRatingService } from '../../../src/services/organisationReting.service';
import logger from '../../../src/utils/logger';

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock('../../../src/services/authUserMobile.service', () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock('../../../src/services/organisationReting.service', () => ({
  OrganizationRatingService: {
    rateOrganisation: jest.fn(),
    isUserRatedOrganisation: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger');

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedAuthService = jest.mocked(AuthUserMobileService);
const mockedRatingService = jest.mocked(OrganizationRatingService);
const mockedLogger = jest.mocked(logger);

describe('OrganisationRatingController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: {},
      body: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. Helper: Mock Generic Error
  // ----------------------------------------------------------------------
  const mockGenericError = (mockFn: jest.Mock) => {
    // FIX: Cast to 'any' to bypass strict TS 'never' checks
    (mockFn as any).mockRejectedValue(new Error('Boom'));
  };

  // ----------------------------------------------------------------------
  // 5. Tests
  // ----------------------------------------------------------------------

  describe('rateOrganisation', () => {
    it('should 400 if rating is missing in body', async () => {
      // Setup
      (req as any).userId = 'u1';
      // FIX: Explicitly cast to any
      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      req.params = { organisationId: 'o1' };
      req.body = {};

      await OrganisationRatingController.rateOrganisation(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Rating is required.' });
    });

    it('should 400 if parentId not found for user', async () => {
      (req as any).userId = 'u1';
      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });
      req.params = { organisationId: 'o1' };
      req.body = { rating: 5 };

      await OrganisationRatingController.rateOrganisation(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Parent not found for user.' });
    });

    it('should success (200) with userId from request object (middleware)', async () => {
      (req as any).userId = 'u1';
      req.headers = {};
      req.params = { organisationId: 'o1' };
      req.body = { rating: 5, review: 'Great' };

      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      // FIX: pass undefined to mockResolvedValue
      (mockedRatingService.rateOrganisation as any).mockResolvedValue(undefined);

      await OrganisationRatingController.rateOrganisation(req as any, res as Response);

      expect(mockedAuthService.getByProviderUserId).toHaveBeenCalledWith('u1');
      expect(mockedRatingService.rateOrganisation).toHaveBeenCalledWith('o1', 'p1', 5, 'Great');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should success (200) with userId from header (x-user-id)', async () => {
      req.headers = { 'x-user-id': 'headerUser' };
      req.params = { organisationId: 'o1' };
      req.body = { rating: 4 };

      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      (mockedRatingService.rateOrganisation as any).mockResolvedValue(undefined);

      await OrganisationRatingController.rateOrganisation(req as any, res as Response);

      expect(mockedAuthService.getByProviderUserId).toHaveBeenCalledWith('headerUser');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle errors (500)', async () => {
      (req as any).userId = 'u1';
      mockGenericError(mockedAuthService.getByProviderUserId as unknown as jest.Mock);

      await OrganisationRatingController.rateOrganisation(req as any, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('isUserRatedOrganisation', () => {
    it('should 400 if parentId not found', async () => {
      (req as any).userId = 'u1';
      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: null });
      req.params = { organisationId: 'o1' };

      await OrganisationRatingController.isUserRatedOrganisation(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Parent not found for user.' });
    });

    it('should success (200) returning true', async () => {
      (req as any).userId = 'u1';
      req.params = { organisationId: 'o1' };
      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      (mockedRatingService.isUserRatedOrganisation as any).mockResolvedValue(true);

      await OrganisationRatingController.isUserRatedOrganisation(req as any, res as Response);

      expect(mockedRatingService.isUserRatedOrganisation).toHaveBeenCalledWith('o1', 'p1');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ hasRated: true });
    });

    it('should handle errors (500)', async () => {
      (req as any).userId = 'u1';
      req.params = { organisationId: 'o1' };
      (mockedAuthService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      mockGenericError(mockedRatingService.isUserRatedOrganisation as unknown as jest.Mock);

      await OrganisationRatingController.isUserRatedOrganisation(req as any, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});