import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { InvoiceController } from '../../../src/controllers/app/invoice.controller';
import { InvoiceService } from '../../../src/services/invoice.service';
import logger from '../../../src/utils/logger';

// ----------------------------------------------------------------------
// 1. Mock Setup (Preserving the Error Class)
// ----------------------------------------------------------------------
jest.mock('../../../src/services/invoice.service', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual('../../../src/services/invoice.service') as unknown as any;
  return {
    ...actual,
    InvoiceService: {
      getByAppointmentId: jest.fn(),
      getById: jest.fn(),
      getByPaymentIntentId: jest.fn(),
      addChargesToAppointment: jest.fn(),
      listForOrganisation: jest.fn(),
    },
  };
});

jest.mock('../../../src/utils/logger');

// Retrieve the REAL Error class for use in our helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { InvoiceServiceError } = jest.requireActual('../../../src/services/invoice.service') as unknown as any;

// ----------------------------------------------------------------------
// 2. Typed Mocks
// ----------------------------------------------------------------------
const mockedInvoiceService = jest.mocked(InvoiceService);
const mockedLogger = jest.mocked(logger);

describe('InvoiceController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: {},
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
  // 3. Error Helpers (Fixed Type Casting)
  // ----------------------------------------------------------------------
  const mockServiceError = (
  method: keyof typeof InvoiceService,
  status = 400,
  msg = 'Service Error'
) => {
  mockedInvoiceService[method].mockRejectedValue(
    new InvoiceServiceError(msg, status)
  );
};

const mockGenericError = (
  method: keyof typeof InvoiceService
) => {
  mockedInvoiceService[method].mockRejectedValue(
    new Error('Boom')
  );
};


  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe('listInvoicesForAppointment', () => {
    it('should success (200)', async () => {
      req.params = { appointmentId: 'apt1' };
      mockedInvoiceService.getByAppointmentId.mockResolvedValue([]);

      await InvoiceController.listInvoicesForAppointment(req as Request, res as Response);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith('apt1');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });

    it('should handle generic error (500)', async () => {
      req.params = { appointmentId: 'apt1' };
      mockGenericError('getByAppointmentId');

      await InvoiceController.listInvoicesForAppointment(req as Request, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getInvoiceById', () => {
    it('should 404 if invoice not found', async () => {
      req.params = { invoiceId: 'inv1' };
      // Cast null to any to bypass strict type check on getById return type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedInvoiceService.getById.mockResolvedValue(null as any);

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Invoice not found' });
    });

    it('should success (200)', async () => {
      req.params = { invoiceId: 'inv1' };
      mockedInvoiceService.getById.mockResolvedValue({ id: 'inv1' } as any);

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ id: 'inv1' });
    });

    it('should handle generic error (500)', async () => {
      req.params = { invoiceId: 'inv1' };
      mockGenericError('getById');

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getInvoiceByPaymentIntentId', () => {
    it('should 404 if invoice not found', async () => {
      req.params = { paymentIntentId: 'pi_123' };
      // Cast null to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedInvoiceService.getByPaymentIntentId.mockResolvedValue(null as any);

      await InvoiceController.getInvoiceByPaymentIntentId(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should success (200)', async () => {
      req.params = { paymentIntentId: 'pi_123' };
      mockedInvoiceService.getByPaymentIntentId.mockResolvedValue({ id: 'inv1' } as any);

      await InvoiceController.getInvoiceByPaymentIntentId(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle generic error (500)', async () => {
      req.params = { paymentIntentId: 'pi_123' };
      mockGenericError('getByPaymentIntentId');

      await InvoiceController.getInvoiceByPaymentIntentId(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('addChargesToAppointment', () => {
    const validItem = {
      name: 'Item 1',
      quantity: 1,
      unitPrice: 100,
      total: 100,
      description: 'desc',
      discountPercent: 0
    };

    it('should 400 if currency is missing/empty', async () => {
      req.params = { appointmentId: 'apt1' };
      req.body = { items: [validItem], currency: '' }; // empty currency

      await InvoiceController.addChargesToAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Currency is required' });

      req.body = { items: [validItem] }; // missing currency
      await InvoiceController.addChargesToAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should 400 if items array is missing/empty', async () => {
      req.params = { appointmentId: 'apt1' };
      req.body = { currency: 'USD', items: [] }; // empty array

      await InvoiceController.addChargesToAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Items are required' });

      req.body = { currency: 'USD' }; // missing items
      await InvoiceController.addChargesToAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    // --- Validation Helper Coverage (isInvoiceItem) ---

    it('should 400 if item in array is not an object', async () => {
      req.body = { currency: 'USD', items: [null] };
      await InvoiceController.addChargesToAppointment(req as any, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should 400 if item has invalid properties (branch coverage)', async () => {
        const base = { ...validItem };

        const testInvalid = async (override: object) => {
            req.body = { currency: 'USD', items: [{ ...base, ...override }] };
            await InvoiceController.addChargesToAppointment(req as any, res as Response);
            expect(statusMock).toHaveBeenCalledWith(400);
        };

        // Testing 'name'
        await testInvalid({ name: 123 });
        // Testing 'quantity'
        await testInvalid({ quantity: '1' });
        // Testing 'unitPrice'
        await testInvalid({ unitPrice: '100' });
        // Testing 'total'
        await testInvalid({ total: '100' });
        // Testing 'description' invalid type (valid if undefined/null, invalid if number)
        await testInvalid({ description: 123 });
        // Testing 'discountPercent' invalid type
        await testInvalid({ discountPercent: '10' });
    });

    it('should success (200) with valid payload', async () => {
      req.params = { appointmentId: 'apt1' };
      req.body = { currency: 'USD', items: [validItem] };

      mockedInvoiceService.addChargesToAppointment.mockResolvedValue({ id: 'inv1' } as any);

      await InvoiceController.addChargesToAppointment(req as any, res as Response);

      expect(mockedInvoiceService.addChargesToAppointment).toHaveBeenCalledWith('apt1', [validItem], 'USD');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle Service Error (custom status)', async () => {
      req.params = { appointmentId: 'apt1' };
      req.body = { currency: 'USD', items: [validItem] };

      mockServiceError('addChargesToAppointment', 422, 'Unprocessable');

      await InvoiceController.addChargesToAppointment(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Unprocessable' });
    });

    it('should handle Generic Error (500)', async () => {
      req.params = { appointmentId: 'apt1' };
      req.body = { currency: 'USD', items: [validItem] };

      mockGenericError('addChargesToAppointment');

      await InvoiceController.addChargesToAppointment(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  describe('listInvoicesForOrganisation', () => {
    it('should 400 if organisationId missing', async () => {
      req.params = {};
      await InvoiceController.listInvoicesForOrganisation(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Organisation Id is reqired.' });
    });

    it('should success (200)', async () => {
      req.params = { organisationId: 'org1' };
      mockedInvoiceService.listForOrganisation.mockResolvedValue([]);

      await InvoiceController.listInvoicesForOrganisation(req as Request, res as Response);

      expect(mockedInvoiceService.listForOrganisation).toHaveBeenCalledWith('org1');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should handle generic error (500)', async () => {
      req.params = { organisationId: 'org1' };
      mockGenericError('listForOrganisation');

      await InvoiceController.listInvoicesForOrganisation(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});