import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
// Assuming this test file is at test/controllers/dashboard.controller.test.ts
// If it is inside web/, use ../../src. If directly in controllers/, use ../../src.
// Assuming it matches the FormController path structure:
import { DashboardController } from '../../src/controllers/web/dashboard.controller';
import { DashboardService, DashboardServiceError } from '../../src/services/dashboard.service';
import logger from '../../src/utils/logger';

// ----------------------------------------------------------------------
// 1. Mock Setup
// ----------------------------------------------------------------------
jest.mock('../../src/services/dashboard.service', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual('../../src/services/dashboard.service') as unknown as any;
  return {
    ...actual,
    DashboardService: {
      getSummary: jest.fn(),
      getAppointmentsTrend: jest.fn(),
      getRevenueTrend: jest.fn(),
      getAppointmentLeaders: jest.fn(),
      getRevenueLeaders: jest.fn(),
      getInventoryTurnover: jest.fn(),
      getProductTurnover: jest.fn(),
    },
  };
});

jest.mock('../../src/utils/logger');

// ----------------------------------------------------------------------
// 2. Typed Mocks
// ----------------------------------------------------------------------
const mockedDashboardService = jest.mocked(DashboardService);
const mockedLogger = jest.mocked(logger);

describe('DashboardController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {},
      params: { organisationId: 'org1' },
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 3. Error Helpers (FIXED CASTING)
  // ----------------------------------------------------------------------
  const mockServiceError = (method: keyof typeof DashboardService, status = 400, msg = 'Error') => {
    const error = new DashboardServiceError(msg, status);
    // FIX: Cast to 'any' to bypass 'never' check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedDashboardService[method] as any).mockRejectedValue(error);
  };

  const mockGenericError = (method: keyof typeof DashboardService) => {
    // FIX: Cast to 'any'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedDashboardService[method] as any).mockRejectedValue(new Error('Boom'));
  };

  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe('summary', () => {
    it('should success with default range (last_week)', async () => {
      req.query = {}; // No range provided
      mockedDashboardService.getSummary.mockResolvedValue({ totalAppointments: 10 } as any);

      await DashboardController.summary(req as any, res as Response);

      expect(mockedDashboardService.getSummary).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_week',
      });
      expect(jsonMock).toHaveBeenCalledWith({ totalAppointments: 10 });
    });

    it('should success with explicit range', async () => {
      req.query = { range: 'last_month' };
      mockedDashboardService.getSummary.mockResolvedValue({ totalAppointments: 50 } as any);

      await DashboardController.summary(req as any, res as Response);

      expect(mockedDashboardService.getSummary).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_month',
      });
      expect(jsonMock).toHaveBeenCalledWith({ totalAppointments: 50 });
    });

    it('should handle service error', async () => {
      mockServiceError('getSummary', 400);
      await DashboardController.summary(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getSummary');
      await DashboardController.summary(req as any, res as Response);
      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('appointmentsTrend', () => {
    it('should success with default months (6)', async () => {
      req.query = {};
      mockedDashboardService.getAppointmentsTrend.mockResolvedValue([] as any);

      await DashboardController.appointmentsTrend(req as any, res as Response);

      expect(mockedDashboardService.getAppointmentsTrend).toHaveBeenCalledWith({
        organisationId: 'org1',
        months: 6,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should success with explicit months', async () => {
      req.query = { months: '12' };
      mockedDashboardService.getAppointmentsTrend.mockResolvedValue([] as any);

      await DashboardController.appointmentsTrend(req as any, res as Response);

      expect(mockedDashboardService.getAppointmentsTrend).toHaveBeenCalledWith({
        organisationId: 'org1',
        months: 12,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle service error', async () => {
      mockServiceError('getAppointmentsTrend', 400);
      await DashboardController.appointmentsTrend(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getAppointmentsTrend');
      await DashboardController.appointmentsTrend(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('revenueTrend', () => {
    it('should success with default months (6)', async () => {
      req.query = {};
      mockedDashboardService.getRevenueTrend.mockResolvedValue([] as any);

      await DashboardController.revenueTrend(req as any, res as Response);

      expect(mockedDashboardService.getRevenueTrend).toHaveBeenCalledWith({
        organisationId: 'org1',
        months: 6,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should success with explicit months', async () => {
      req.query = { months: '3' };
      mockedDashboardService.getRevenueTrend.mockResolvedValue([] as any);

      await DashboardController.revenueTrend(req as any, res as Response);

      expect(mockedDashboardService.getRevenueTrend).toHaveBeenCalledWith({
        organisationId: 'org1',
        months: 3,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle service error', async () => {
      mockServiceError('getRevenueTrend', 400);
      await DashboardController.revenueTrend(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getRevenueTrend');
      await DashboardController.revenueTrend(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('appointmentLeaders', () => {
    it('should success with defaults', async () => {
      req.query = {};
      mockedDashboardService.getAppointmentLeaders.mockResolvedValue([] as any);

      await DashboardController.appointmentLeaders(req as any, res as Response);

      expect(mockedDashboardService.getAppointmentLeaders).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_week',
        limit: 5,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should success with explicit params', async () => {
      req.query = { range: 'last_month', limit: '10' };
      mockedDashboardService.getAppointmentLeaders.mockResolvedValue([] as any);

      await DashboardController.appointmentLeaders(req as any, res as Response);

      expect(mockedDashboardService.getAppointmentLeaders).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_month',
        limit: 10,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle service error', async () => {
      mockServiceError('getAppointmentLeaders', 400);
      await DashboardController.appointmentLeaders(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getAppointmentLeaders');
      await DashboardController.appointmentLeaders(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('revenueLeaders', () => {
    it('should success with defaults', async () => {
      req.query = {};
      mockedDashboardService.getRevenueLeaders.mockResolvedValue([] as any);

      await DashboardController.revenueLeaders(req as any, res as Response);

      expect(mockedDashboardService.getRevenueLeaders).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_week',
        limit: 5,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should success with explicit params', async () => {
      req.query = { range: 'last_year', limit: '3' };
      mockedDashboardService.getRevenueLeaders.mockResolvedValue([] as any);

      await DashboardController.revenueLeaders(req as any, res as Response);

      expect(mockedDashboardService.getRevenueLeaders).toHaveBeenCalledWith({
        organisationId: 'org1',
        range: 'last_year',
        limit: 3,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle service error', async () => {
      mockServiceError('getRevenueLeaders', 400);
      await DashboardController.revenueLeaders(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getRevenueLeaders');
      await DashboardController.revenueLeaders(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('inventoryTurnover', () => {
    it('should success without optional params', async () => {
      req.query = {};
      mockedDashboardService.getInventoryTurnover.mockResolvedValue({ turnoverRate: 5 } as any);

      await DashboardController.inventoryTurnover(req as any, res as Response);

      expect(mockedDashboardService.getInventoryTurnover).toHaveBeenCalledWith({
        organisationId: 'org1',
        year: undefined,
        targetTurnsPerYear: undefined,
      });
      expect(jsonMock).toHaveBeenCalledWith({ turnoverRate: 5 });
    });

    it('should success with optional params', async () => {
      req.query = { year: '2023', targetTurns: '12' };
      mockedDashboardService.getInventoryTurnover.mockResolvedValue({ turnoverRate: 10 } as any);

      await DashboardController.inventoryTurnover(req as any, res as Response);

      expect(mockedDashboardService.getInventoryTurnover).toHaveBeenCalledWith({
        organisationId: 'org1',
        year: 2023,
        targetTurnsPerYear: 12,
      });
      expect(jsonMock).toHaveBeenCalledWith({ turnoverRate: 10 });
    });

    it('should handle service error', async () => {
      mockServiceError('getInventoryTurnover', 400);
      await DashboardController.inventoryTurnover(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getInventoryTurnover');
      await DashboardController.inventoryTurnover(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('productTurnover', () => {
    it('should success with defaults', async () => {
      req.query = {};
      mockedDashboardService.getProductTurnover.mockResolvedValue([] as any);

      await DashboardController.productTurnover(req as any, res as Response);

      expect(mockedDashboardService.getProductTurnover).toHaveBeenCalledWith({
        organisationId: 'org1',
        year: undefined,
        limit: 10,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should success with explicit params', async () => {
      req.query = { year: '2022', limit: '20' };
      mockedDashboardService.getProductTurnover.mockResolvedValue([] as any);

      await DashboardController.productTurnover(req as any, res as Response);

      expect(mockedDashboardService.getProductTurnover).toHaveBeenCalledWith({
        organisationId: 'org1',
        year: 2022,
        limit: 20,
      });
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle service error', async () => {
      mockServiceError('getProductTurnover', 400);
      await DashboardController.productTurnover(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle generic error', async () => {
      mockGenericError('getProductTurnover');
      await DashboardController.productTurnover(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});