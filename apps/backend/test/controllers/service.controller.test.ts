import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 2 levels to src from test/controllers/
// ----------------------------------------------------------------------
import { ServiceController } from '../../src/controllers/web/service.controller';
import { ServiceService } from '../../src/services/service.service';
import { AuthUserMobileService } from '../../src/services/authUserMobile.service';
import { ParentModel } from '../../src/models/parent';
import helpers from '../../src/utils/helper';
import logger from '../../src/utils/logger';

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock('../../src/services/service.service');
jest.mock('../../src/services/authUserMobile.service');
jest.mock('../../src/models/parent');
jest.mock('../../src/utils/helper');
jest.mock('../../src/utils/logger');

// Retrieve REAL Error class
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ServiceServiceError: RealServiceError } = jest.requireActual('../../src/services/service.service') as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedServiceService = jest.mocked(ServiceService);
const mockedAuthMobileService = jest.mocked(AuthUserMobileService);
const mockedParentModel = jest.mocked(ParentModel);
const mockedHelpers = jest.mocked(helpers);
const mockedLogger = jest.mocked(logger);

describe('ServiceController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. ERROR HELPERS
  // ----------------------------------------------------------------------
  const mockServiceError = (method: keyof typeof ServiceService, status = 400, msg = 'Service Error') => {
    const error = new RealServiceError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedServiceService[method] as any).mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof ServiceService) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedServiceService[method] as any).mockRejectedValue(new Error('Boom'));
  };

  /* ========================================================================
   * CRUD OPERATIONS
   * ======================================================================*/

  describe('createService', () => {
    it('should success (201)', async () => {
      req.body = { name: 'New Service' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.create as any).mockResolvedValue({ id: 's1' });

      await ServiceController.createService(req as any, res as Response);
      expect(mockedServiceService.create).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ id: 's1' });
    });

    it('should handle service error', async () => {
      mockServiceError('create', 400);
      await ServiceController.createService(req as any, res as Response);
    });

    it('should handle generic error', async () => {
      mockGenericError('create');
      await ServiceController.createService(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('updateService', () => {
    it('should success (200)', async () => {
      req.params = { id: 's1' };
      req.body = { name: 'Updated' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.update as any).mockResolvedValue({});

      await ServiceController.updateService(req as any, res as Response);
      expect(mockedServiceService.update).toHaveBeenCalledWith('s1', req.body);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle service error', async () => {
      mockServiceError('update', 404);
      await ServiceController.updateService(req as any, res as Response);
    });
  });

  describe('deleteService', () => {
    it('should success (204)', async () => {
      req.params = { id: 's1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.delete as any).mockResolvedValue(undefined);

      await ServiceController.deleteService(req as any, res as Response);
      expect(mockedServiceService.delete).toHaveBeenCalledWith('s1');
      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it('should handle service error', async () => {
      mockServiceError('delete', 400);
      await ServiceController.deleteService(req as any, res as Response);
    });
  });

  describe('getServiceById', () => {
    it('should 404 if not found', async () => {
      req.params = { id: 's1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.getById as any).mockResolvedValue(null);

      await ServiceController.getServiceById(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should success (200)', async () => {
      req.params = { id: 's1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.getById as any).mockResolvedValue({ id: 's1' });

      await ServiceController.getServiceById(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: 's1' });
    });

    it('should handle service error', async () => {
      mockServiceError('getById', 500);
      await ServiceController.getServiceById(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('listServicesBySpeciality', () => {
    it('should success (200)', async () => {
      req.params = { specialityId: 'spec1' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.listBySpeciality as any).mockResolvedValue([]);

      await ServiceController.listServicesBySpeciality(req as any, res as Response);
      expect(mockedServiceService.listBySpeciality).toHaveBeenCalledWith('spec1');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle error', async () => {
      mockGenericError('listBySpeciality');
      await ServiceController.listServicesBySpeciality(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  /* ========================================================================
   * LIST ORGANISATION BY SERVICE (GEO SEARCH)
   * ======================================================================*/

  describe('listOrganisationByServiceName', () => {
    it('should 400 if serviceName missing', async () => {
      req.query = {};
      await ServiceController.listOrganisationByServiceName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    // --- Case 1: Explicit Lat/Lng ---
    it('should 400 if explicit lat/lng are invalid numbers', async () => {
      req.query = { serviceName: 'Test', lat: 'invalid', lng: '10' };
      await ServiceController.listOrganisationByServiceName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('valid numbers') }));
    });

    it('should success with explicit lat/lng', async () => {
      req.query = { serviceName: 'Test', lat: '10.5', lng: '20.5' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.listOrganisationsProvidingServiceNearby as any).mockResolvedValue([]);

      await ServiceController.listOrganisationByServiceName(req as any, res as Response);

      expect(mockedServiceService.listOrganisationsProvidingServiceNearby)
        .toHaveBeenCalledWith('Test', 10.5, 20.5);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    // --- Case 2: Resolve from User Profile ---
    it('should 400 if no lat/lng provided and user not authenticated', async () => {
      req.query = { serviceName: 'Test' };
      // No userId in req
      await ServiceController.listOrganisationByServiceName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.stringContaining('no authenticated request'));
    });

    it('should 400 if user has no address (city/pincode)', async () => {
      req.query = { serviceName: 'Test' };
      (req as any).userId = 'u1';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAuthMobileService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedParentModel.findById as any).mockResolvedValue({ address: {} }); // Missing city/code

      await ServiceController.listOrganisationByServiceName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Location not provided') }));
    });

    it('should 400 if geo location resolution fails', async () => {
      req.query = { serviceName: 'Test' };
      (req as any).userId = 'u1';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAuthMobileService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedParentModel.findById as any).mockResolvedValue({ address: { city: 'City', postalCode: '123' } });

      // Geo fails return nulls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedHelpers.getGeoLocation as any).mockResolvedValue({ lat: null, lng: null });

      await ServiceController.listOrganisationByServiceName(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Unable to resolve location') }));
    });

    it('should success with user profile location', async () => {
      req.query = { serviceName: 'Test' };
      // Header auth
      req.headers = { 'x-user-id': 'u1' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAuthMobileService.getByProviderUserId as any).mockResolvedValue({ parentId: 'p1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedParentModel.findById as any).mockResolvedValue({ address: { city: 'City', postalCode: '123' } });

      // Geo succeeds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedHelpers.getGeoLocation as any).mockResolvedValue({ lat: 40, lng: 50 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceService.listOrganisationsProvidingServiceNearby as any).mockResolvedValue([]);

      await ServiceController.listOrganisationByServiceName(req as any, res as Response);

      expect(mockedHelpers.getGeoLocation).toHaveBeenCalledWith('City 123');
      expect(mockedServiceService.listOrganisationsProvidingServiceNearby)
        .toHaveBeenCalledWith('Test', 40, 50);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle errors', async () => {
        req.query = { serviceName: 'Test', lat: '10', lng: '10' };
        mockGenericError('listOrganisationsProvidingServiceNearby');
        await ServiceController.listOrganisationByServiceName(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  /* ========================================================================
   * BOOKABLE SLOTS & ORG LIST
   * ======================================================================*/

  describe('getBookableSlotsForService', () => {
    it('should 400 if params missing', async () => {
        req.body = {};
        await ServiceController.getBookableSlotsForService(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('required') }));
    });

    it('should 400 if date invalid', async () => {
        req.body = { serviceId: 's1', organisationId: 'o1', date: 'invalid' };
        await ServiceController.getBookableSlotsForService(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Invalid date') }));
    });

    it('should success (200)', async () => {
        req.body = { serviceId: 's1', organisationId: 'o1', date: '2023-01-01' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedServiceService.getBookableSlotsService as any).mockResolvedValue([]);

        await ServiceController.getBookableSlotsForService(req as any, res as Response);
        expect(mockedServiceService.getBookableSlotsService).toHaveBeenCalledWith('s1', 'o1', new Date('2023-01-01'));
        expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle errors', async () => {
        req.body = { serviceId: 's1', organisationId: 'o1', date: '2023-01-01' };
        mockGenericError('getBookableSlotsService');
        await ServiceController.getBookableSlotsForService(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('listByOrganisation', () => {
    it('should success (200)', async () => {
        req.params = { organisationId: 'o1' };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedServiceService.listByOrganisation as any).mockResolvedValue([]);

        await ServiceController.listByOrganisation(req as any, res as Response);
        expect(mockedServiceService.listByOrganisation).toHaveBeenCalledWith('o1');
        expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle errors', async () => {
        req.params = { organisationId: 'o1' };
        mockGenericError('listByOrganisation');
        await ServiceController.listByOrganisation(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});