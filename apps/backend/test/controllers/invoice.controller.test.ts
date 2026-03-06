import { Request, Response } from 'express';
import { InvoiceController } from '../../src/controllers/app/invoice.controller';
import { InvoiceService } from 'src/services/invoice.service';
import logger from 'src/utils/logger';

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---
jest.mock('src/services/invoice.service', () => ({
  __esModule: true,
  InvoiceService: {
    getByAppointmentId: jest.fn(),
    getById: jest.fn(),
    getByPaymentIntentId: jest.fn(),
  },
}));

jest.mock('src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('InvoiceController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

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

    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = {
      params: {},
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };
  });

  describe('listInvoicesForAppointment', () => {
    it('should return 200 and a list of invoices on success', async () => {
      mockRequest.params = { appointmentId: 'app_123' };
      const mockInvoices = [{ id: 'inv_1' }, { id: 'inv_2' }];
      (InvoiceService.getByAppointmentId as jest.Mock).mockResolvedValue(mockInvoices);

      await InvoiceController.listInvoicesForAppointment(mockRequest as Request, mockResponse as Response);

      expect(InvoiceService.getByAppointmentId).toHaveBeenCalledWith('app_123');
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockInvoices);
    });

    it('should catch errors, log them, and return 500', async () => {
      mockRequest.params = { appointmentId: 'app_123' };
      const error = new Error('Database connection failed');
      (InvoiceService.getByAppointmentId as jest.Mock).mockRejectedValue(error);

      await InvoiceController.listInvoicesForAppointment(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error fetching appointment invoices', error);
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  describe('getInvoiceById', () => {
    it('should return 200 and the invoice if found', async () => {
      mockRequest.params = { invoiceId: 'inv_123' };
      const mockInvoice = { id: 'inv_123', totalAmount: 100 };
      (InvoiceService.getById as jest.Mock).mockResolvedValue(mockInvoice);

      await InvoiceController.getInvoiceById(mockRequest as Request, mockResponse as Response);

      expect(InvoiceService.getById).toHaveBeenCalledWith('inv_123');
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockInvoice);
    });

    it('should return 404 if the invoice is not found', async () => {
      mockRequest.params = { invoiceId: 'inv_123' };
      (InvoiceService.getById as jest.Mock).mockResolvedValue(null);

      await InvoiceController.getInvoiceById(mockRequest as Request, mockResponse as Response);

      expect(InvoiceService.getById).toHaveBeenCalledWith('inv_123');
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Invoice not found' });
    });

    it('should catch errors, log them, and return 500', async () => {
      mockRequest.params = { invoiceId: 'inv_123' };
      const error = new Error('Database connection failed');
      (InvoiceService.getById as jest.Mock).mockRejectedValue(error);

      await InvoiceController.getInvoiceById(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error fetching invoice by ID', error);
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  describe('getInvoiceByPaymentIntentId', () => {
    it('should return 200 and the invoice if found', async () => {
      mockRequest.params = { paymentIntentId: 'pi_123' };
      const mockInvoice = { id: 'inv_123', stripePaymentIntentId: 'pi_123' };
      (InvoiceService.getByPaymentIntentId as jest.Mock).mockResolvedValue(mockInvoice);

      await InvoiceController.getInvoiceByPaymentIntentId(mockRequest as Request, mockResponse as Response);

      expect(InvoiceService.getByPaymentIntentId).toHaveBeenCalledWith('pi_123');
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(mockInvoice);
    });

    it('should return 404 if the invoice is not found', async () => {
      mockRequest.params = { paymentIntentId: 'pi_123' };
      (InvoiceService.getByPaymentIntentId as jest.Mock).mockResolvedValue(null);

      await InvoiceController.getInvoiceByPaymentIntentId(mockRequest as Request, mockResponse as Response);

      expect(InvoiceService.getByPaymentIntentId).toHaveBeenCalledWith('pi_123');
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Invoice not found' });
    });

    it('should catch errors, log them, and return 500', async () => {
      mockRequest.params = { paymentIntentId: 'pi_123' };
      const error = new Error('Stripe API error');
      (InvoiceService.getByPaymentIntentId as jest.Mock).mockRejectedValue(error);

      await InvoiceController.getInvoiceByPaymentIntentId(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Error fetching invoice by Payment Intent ID', error);
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });
});