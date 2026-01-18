import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ----------------------------------------------------------------------
// 1. DEFINE MOCK INSTANCE (Hoistable)
// ----------------------------------------------------------------------
const mockStripeInstance = {
  accounts: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  accountSessions: {
    create: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  charges: {
    retrieve: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

// ----------------------------------------------------------------------
// 2. MOCK DEPENDENCIES (Before Imports)
// ----------------------------------------------------------------------

// Mock Stripe Library - Critical fix: include __esModule: true
jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockStripeInstance),
  };
});

// Mock Internal Services to prevent circular dependency crashes
jest.mock('../../src/services/invoice.service', () => ({
  InvoiceService: {
    attachStripeDetails: jest.fn(),
    markRefunded: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock Models
jest.mock('../../src/models/invoice');
jest.mock('../../src/models/organization');
jest.mock('../../src/models/service');
jest.mock('../../src/models/appointment');

// Mock Utils
jest.mock('../../src/utils/notificationTemplates', () => ({
  NotificationTemplates: {
    Payment: {
      REFUND_ISSUED: jest.fn().mockReturnValue({ title: 'Refund', body: 'Money back' }),
    },
  },
}));

// ----------------------------------------------------------------------
// 3. IMPORT SYSTEM UNDER TEST
// ----------------------------------------------------------------------
// We set the env var BEFORE importing the service to ensure if it reads env on load, it succeeds.
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';

import { StripeService } from '../../src/services/stripe.service';
import { InvoiceService } from '../../src/services/invoice.service';
import { NotificationService } from '../../src/services/notification.service';
import logger from '../../src/utils/logger';
import InvoiceModel from '../../src/models/invoice';
import OrganizationModel from '../../src/models/organization';
import ServiceModel from '../../src/models/service';
import AppointmentModel from '../../src/models/appointment';

// ----------------------------------------------------------------------
// 4. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedInvoiceService = jest.mocked(InvoiceService);
const mockedNotificationService = jest.mocked(NotificationService);
const mockedLogger = jest.mocked(logger);
const mockedInvoiceModel = jest.mocked(InvoiceModel);
const mockedOrgModel = jest.mocked(OrganizationModel);
const mockedServiceModel = jest.mocked(ServiceModel);
const mockedAppointmentModel = jest.mocked(AppointmentModel);

describe('StripeService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, STRIPE_SECRET_KEY: 'sk_test_123', STRIPE_WEBHOOK_SECRET: 'whsec_123' };

    // Reset Stripe mocks default return values using 'as any' casting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockStripeInstance.accounts.create as any).mockResolvedValue({ id: 'acct_123' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockStripeInstance.accounts.retrieve as any).mockResolvedValue({
      charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {}
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockStripeInstance.accountSessions.create as any).mockResolvedValue({ client_secret: 'sess_secret' });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  /* ========================================================================
   * CONNECTED ACCOUNTS
   * ======================================================================*/
  describe('createOrGetConnectedAccount', () => {
    it('should throw if organisation not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue(null);
      await expect(StripeService.createOrGetConnectedAccount('org1')).rejects.toThrow('Organisation not found');
    });

    it('should return existing accountId if present', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_existing' });
      const res = await StripeService.createOrGetConnectedAccount('org1');
      expect(res.accountId).toBe('acct_existing');
      expect(mockStripeInstance.accounts.create).not.toHaveBeenCalled();
    });

    it('should create new account if missing', async () => {
      const mockSave = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: null, save: mockSave });

      const res = await StripeService.createOrGetConnectedAccount('org1');

      expect(mockStripeInstance.accounts.create).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(res.accountId).toBe('acct_123');
    });
  });

  describe('getAccountStatus', () => {
    it('should throw if org has no stripe account', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: null });
      await expect(StripeService.getAccountStatus('org1')).rejects.toThrow('Organisation does not have a Stripe account');
    });

    it('should return status from stripe', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_123' });
      const res = await StripeService.getAccountStatus('org1');
      expect(mockStripeInstance.accounts.retrieve).toHaveBeenCalledWith('acct_123');
      expect(res.chargesEnabled).toBe(true);
    });
  });

  describe('createOnboardingLink', () => {
    it('should throw if org has no stripe account', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: null });
      await expect(StripeService.createOnboardingLink('org1')).rejects.toThrow('Organisation does not have a Stripe account');
    });

    it('should return client_secret', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_123' });
      const res = await StripeService.createOnboardingLink('org1');
      expect(mockStripeInstance.accountSessions.create).toHaveBeenCalledWith(expect.objectContaining({ account: 'acct_123' }));
      expect(res.client_secret).toBe('sess_secret');
    });
  });

  /* ========================================================================
   * PAYMENT INTENTS
   * ======================================================================*/
  describe('createPaymentIntentForAppointment', () => {
    it('should throw if appointment not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAppointmentModel.findById as any).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForAppointment('apt1')).rejects.toThrow('Appointment not found');
    });

    it('should throw if status is not NO_PAYMENT', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAppointmentModel.findById as any).mockResolvedValue({ status: 'PAID' });
      await expect(StripeService.createPaymentIntentForAppointment('apt1')).rejects.toThrow('Appointment does not require payment');
    });

    it('should throw if service not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAppointmentModel.findById as any).mockResolvedValue({ status: 'NO_PAYMENT', appointmentType: { id: 's1' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceModel.findById as any).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForAppointment('apt1')).rejects.toThrow('Service not found');
    });

    it('should throw if organisation has no stripe account', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAppointmentModel.findById as any).mockResolvedValue({
        status: 'NO_PAYMENT',
        appointmentType: { id: 's1' },
        organisationId: 'org1'
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceModel.findById as any).mockResolvedValue({ cost: 100 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: null });

      await expect(StripeService.createPaymentIntentForAppointment('apt1')).rejects.toThrow('Organisation has no Stripe account');
    });

    it('should create payment intent and update appointment', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedAppointmentModel.findById as any).mockResolvedValue({
        status: 'NO_PAYMENT',
        appointmentType: { id: 's1' },
        organisationId: 'org1',
        companion: { parent: { id: 'p1' }, id: 'c1' }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedServiceModel.findById as any).mockResolvedValue({ cost: 100 }); // $100
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_123' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.paymentIntents.create as any).mockResolvedValue({
        id: 'pi_123',
        client_secret: 'sec_123'
      });

      const res = await StripeService.createPaymentIntentForAppointment('apt1');

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 10000, // 100 * 100
        transfer_data: { destination: 'acct_123' }
      }));
      expect(mockedAppointmentModel.updateOne).toHaveBeenCalledWith({ _id: 'apt1' }, { stripePaymentIntentId: 'pi_123' });
      expect(res.clientSecret).toBe('sec_123');
    });
  });

  describe('createPaymentIntentForInvoice', () => {
    it('should throw if invoice not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Invoice not found');
    });

    it('should throw if organisation not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue({ organisationId: 'org1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Organisation not found');
    });

    it('should throw if invoice not payable', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue({ organisationId: 'org1', status: 'PAID' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_123' });
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Invoice is not payable');
    });

    it('should throw if org has no stripe account', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue({ organisationId: 'org1', status: 'PENDING' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: null });
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Organisation does not have a Stripe connected account');
    });

    it('should create payment intent and update invoice', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue({
        organisationId: 'org1',
        status: 'PENDING',
        totalAmount: 50,
        currency: 'usd'
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedOrgModel.findById as any).mockResolvedValue({ stripeAccountId: 'acct_123' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.paymentIntents.create as any).mockResolvedValue({ id: 'pi_inv', client_secret: 'sec_inv' });

      const res = await StripeService.createPaymentIntentForInvoice('inv1');

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 5000,
        metadata: expect.objectContaining({ type: 'INVOICE_PAYMENT' })
      }));
      expect(mockedInvoiceService.attachStripeDetails).toHaveBeenCalledWith('inv1', {
        stripePaymentIntentId: 'pi_inv',
        status: 'AWAITING_PAYMENT'
      });
      expect(res.paymentIntentId).toBe('pi_inv');
    });
  });

  describe('retrievePaymentIntent', () => {
    it('should retrieve PI', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.paymentIntents.retrieve as any).mockResolvedValue({ id: 'pi_1' });
      const res = await StripeService.retrievePaymentIntent('pi_1');
      expect(res.id).toBe('pi_1');
    });
  });

  /* ========================================================================
   * REFUNDS
   * ======================================================================*/
  describe('refundPaymentIntent', () => {
    it('should throw if invoice not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findOne as any).mockResolvedValue(null);
      await expect(StripeService.refundPaymentIntent('pi_1')).rejects.toThrow('Invoice not found');
    });

    it('should throw if no charge found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findOne as any).mockResolvedValue({ _id: 'inv1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.paymentIntents.retrieve as any).mockResolvedValue({ latest_charge: null });
      await expect(StripeService.refundPaymentIntent('pi_1')).rejects.toThrow('No charge found for PaymentIntent');
    });

    it('should process refund', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findOne as any).mockResolvedValue({ _id: 'inv1' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.paymentIntents.retrieve as any).mockResolvedValue({
        latest_charge: { id: 'ch_1' }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.refunds.create as any).mockResolvedValue({
        id: 're_1', status: 'succeeded', amount: 5000
      });

      const res = await StripeService.refundPaymentIntent('pi_1');

      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({ charge: 'ch_1' });
      expect(mockedInvoiceService.markRefunded).toHaveBeenCalledWith('inv1');
      expect(res.amountRefunded).toBe(50);
    });
  });

  /* ========================================================================
   * WEBHOOKS
   * ======================================================================*/
  describe('verifyWebhook', () => {
    it('should throw if missing signature', () => {
      expect(() => StripeService.verifyWebhook(Buffer.from(''), undefined)).toThrow('Missing Stripe signature header');
    });

    it('should throw if signature is array', () => {
      expect(() => StripeService.verifyWebhook(Buffer.from(''), ['sig'])).toThrow('Invalid Stripe signature header format');
    });

    it('should throw if secret missing', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() => StripeService.verifyWebhook(Buffer.from(''), 'sig')).toThrow('STRIPE_WEBHOOK_SECRET is not configured');
    });

    it('should construct event', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.webhooks.constructEvent as any).mockReturnValue({ id: 'evt_1' });
      const evt = StripeService.verifyWebhook(Buffer.from(''), 'sig');
      expect(evt).toEqual({ id: 'evt_1' });
    });
  });

  describe('handleWebhookEvent', () => {
    // --- Invoice Payment Success ---
    it('handlePaymentSucceeded: INVOICE_PAYMENT', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { type: 'INVOICE_PAYMENT', invoiceId: 'inv1' },
            latest_charge: 'ch_1',
            currency: 'usd'
          }
        }
      } as any;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockedInvoiceModel.findById as any).mockResolvedValue({ status: 'AWAITING_PAYMENT', save: jest.fn() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStripeInstance.charges.retrieve as any).mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });

      await StripeService.handleWebhookEvent(event);

      expect(mockedInvoiceModel.findById).toHaveBeenCalledWith('inv1');
      expect(mockedLogger.info).toHaveBeenCalledWith('Invoice inv1 marked PAID');
    });

    it('handlePaymentSucceeded: INVOICE_PAYMENT (Missing ID)', async () => {
        const event = {
          type: 'payment_intent.succeeded',
          data: { object: { metadata: { type: 'INVOICE_PAYMENT' } } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('INVOICE_PAYMENT missing invoiceId');
    });

    it('handlePaymentSucceeded: INVOICE_PAYMENT (Not Found)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'INVOICE_PAYMENT', invoiceId: 'inv1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findById as any).mockResolvedValue(null);
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('Invoice not found: inv1');
    });

    it('handlePaymentSucceeded: INVOICE_PAYMENT (Already Paid)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'INVOICE_PAYMENT', invoiceId: 'inv1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findById as any).mockResolvedValue({ status: 'PAID' });
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.info).toHaveBeenCalledWith('Invoice inv1 is already PAID');
    });

    // --- Appointment Booking Success ---
    it('handlePaymentSucceeded: APPOINTMENT_BOOKING', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: {
                id: 'pi_1',
                currency: 'usd',
                metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'apt1' },
                latest_charge: 'ch_1'
            } }
        } as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAppointmentModel.findById as any).mockResolvedValue({
            organisationId: 'org1',
            appointmentType: { id: 's1' },
            companion: { id: 'c1', parent: { id: 'p1' } }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue(null); // No existing invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedServiceModel.findById as any).mockResolvedValue({ name: 'Svc', cost: 100 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockStripeInstance.charges.retrieve as any).mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.create as any).mockResolvedValue({ _id: 'new_inv', id: 'new_inv' });

        await StripeService.handleWebhookEvent(event);

        expect(mockedInvoiceModel.create).toHaveBeenCalled();
        expect(mockedAppointmentModel.updateOne).toHaveBeenCalledWith(
            { _id: 'apt1' },
            expect.objectContaining({ status: 'REQUESTED' })
        );
    });

    it('handlePaymentSucceeded: APPOINTMENT_BOOKING (Missing ID)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'APPOINTMENT_BOOKING' } } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('APPOINTMENT_BOOKING missing appointmentId');
    });

    it('handlePaymentSucceeded: APPOINTMENT_BOOKING (Apt Not Found)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'apt1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAppointmentModel.findById as any).mockResolvedValue(null);
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('Appointment not found: apt1');
    });

    it('handlePaymentSucceeded: APPOINTMENT_BOOKING (Invoice Exists)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'apt1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAppointmentModel.findById as any).mockResolvedValue({});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue({}); // Exists

        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.info).toHaveBeenCalledWith('Booking invoice already created for apt1');
    });

    it('handlePaymentSucceeded: APPOINTMENT_BOOKING (Service Not Found)', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: {
                metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'apt1' },
                latest_charge: 'ch_1'
            } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAppointmentModel.findById as any).mockResolvedValue({ appointmentType: { id: 's1' } });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockStripeInstance.charges.retrieve as any).mockResolvedValue({});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedServiceModel.findById as any).mockResolvedValue(null);

        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('Service not found for appointment');
    });

    // --- Unknown Payment Type ---
    it('handlePaymentSucceeded: Unknown Type', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: { type: 'UNKNOWN' } } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('Unknown payment type in metadata');
    });

    it('handlePaymentSucceeded: Missing Type', async () => {
        const event = {
            type: 'payment_intent.succeeded',
            data: { object: { metadata: {} } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('payment_intent.succeeded missing metadata.type');
    });

    // --- Payment Failed ---
    it('handlePaymentFailed: Success', async () => {
        const event = {
            type: 'payment_intent.payment_failed',
            data: { object: { metadata: { appointmentId: 'apt1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue({ _id: 'inv1', id: 'inv1' });

        await StripeService.handleWebhookEvent(event);
        expect(mockedInvoiceModel.updateOne).toHaveBeenCalledWith({ _id: 'inv1' }, { status: 'FAILED' });
    });

    it('handlePaymentFailed: Missing AppointmentId', async () => {
        const event = {
            type: 'payment_intent.payment_failed',
            data: { object: { metadata: {} } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedInvoiceModel.findOne).not.toHaveBeenCalled();
    });

    it('handlePaymentFailed: No Invoice', async () => {
        const event = {
            type: 'payment_intent.payment_failed',
            data: { object: { metadata: { appointmentId: 'apt1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue(null);
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('no invoice to update'));
    });

    // --- Charge Refunded ---
    it('handleRefund: Success', async () => {
        const event = {
            type: 'charge.refunded',
            data: { object: {
                amount: 5000,
                currency: 'usd',
                metadata: { appointmentId: 'apt1' }
            } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue({ _id: 'inv1', id: 'inv1', parentId: 'p1' });

        await StripeService.handleWebhookEvent(event);

        expect(mockedInvoiceModel.updateOne).toHaveBeenCalledWith({ _id: 'inv1' }, { status: 'REFUNDED' });
        expect(mockedNotificationService.sendToUser).toHaveBeenCalled();
    });

    it('handleRefund: Missing AppointmentId', async () => {
        const event = {
            type: 'charge.refunded',
            data: { object: { metadata: {} } }
        } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith('charge.refunded missing appointmentId metadata');
    });

    it('handleRefund: No Invoice', async () => {
        const event = {
            type: 'charge.refunded',
            data: { object: { metadata: { appointmentId: 'apt1' } } }
        } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInvoiceModel.findOne as any).mockResolvedValue(null);
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.error).toHaveBeenCalledWith(expect.stringContaining('no invoice for appointment'));
    });

    // --- Default ---
    it('handleWebhookEvent: Default Case', async () => {
        const event = { type: 'unknown_event' } as any;
        await StripeService.handleWebhookEvent(event);
        expect(mockedLogger.info).toHaveBeenCalledWith('Unhandled Stripe event: unknown_event');
    });
  });
});