import Stripe from 'stripe';
import { StripeService } from '../../src/services/stripe.service';
import { InvoiceService } from '../../src/services/invoice.service';
import logger from '../../src/utils/logger';
import InvoiceModel from 'src/models/invoice';
import OrganizationModel from 'src/models/organization';
import ServiceModel from 'src/models/service';
import AppointmentModel from 'src/models/appointment';
import { NotificationService } from '../../src/services/notification.service';

// --- Wire Mock Objects Directly Inside Factories ---
jest.mock('../../src/services/invoice.service', () => ({
  InvoiceService: { attachStripeDetails: jest.fn(), markRefunded: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('src/models/invoice', () => ({
  __esModule: true,
  default: { findById: jest.fn(), findOne: jest.fn(), create: jest.fn(), updateOne: jest.fn() },
}));

jest.mock('src/models/organization', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('src/models/service', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('src/models/appointment', () => ({
  __esModule: true,
  default: { findById: jest.fn(), updateOne: jest.fn() },
}));

jest.mock('../../src/services/notification.service', () => ({
  NotificationService: { sendToUser: jest.fn() },
}));

jest.mock('src/utils/notificationTemplates', () => ({
  NotificationTemplates: {
    Payment: { REFUND_ISSUED: jest.fn().mockReturnValue('mocked_payload') },
  },
}));

// Create a cleanly isolated Stripe mock instance
jest.mock('stripe', () => {
  const mockInstance = {
    accounts: { create: jest.fn(), retrieve: jest.fn() },
    accountSessions: { create: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    refunds: { create: jest.fn() },
    charges: { retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  };
  const MockStripe = jest.fn(() => mockInstance);
  (MockStripe as any)._mockInstance = mockInstance;
  return { __esModule: true, default: MockStripe };
});

const stripeMock = (Stripe as any)._mockInstance;

describe('StripeService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Stripe Client Initialization', () => {
    it('should throw an error if STRIPE_SECRET_KEY is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      await expect(StripeService.createOrGetConnectedAccount('org1')).rejects.toThrow(
        'STRIPE_SECRET_KEY is not configured'
      );
    });

    it('should initialize Stripe client once and reuse the instance', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_1' });

      await StripeService.createOrGetConnectedAccount('org1');
      const result = await StripeService.createOrGetConnectedAccount('org1');

      expect(result).toEqual({ accountId: 'acct_1' });
    });
  });

  describe('createOrGetConnectedAccount', () => {
    it('should throw if organisation is not found', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createOrGetConnectedAccount('org1')).rejects.toThrow('Organisation not found');
    });

    it('should return existing stripeAccountId if it exists', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });
      const res = await StripeService.createOrGetConnectedAccount('org1');
      expect(res).toEqual({ accountId: 'acct_123' });
    });

    it('should create a Connect account and save if none exists', async () => {
      const mockSave = jest.fn();
      const mockOrg = { save: mockSave };
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(mockOrg);
      stripeMock.accounts.create.mockResolvedValue({ id: 'acct_new' });

      const res = await StripeService.createOrGetConnectedAccount('org1');

      expect(stripeMock.accounts.create).toHaveBeenCalledWith({});
      expect(mockOrg).toHaveProperty('stripeAccountId', 'acct_new');
      expect(mockSave).toHaveBeenCalled();
      expect(res).toEqual({ accountId: 'acct_new' });
    });
  });

  describe('getAccountStatus', () => {
    it('should throw if organisation or account does not exist', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: null });
      await expect(StripeService.getAccountStatus('org1')).rejects.toThrow(
        'Organisation does not have a Stripe account'
      );
    });

    it('should retrieve and return account status details', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });
      stripeMock.accounts.retrieve.mockResolvedValue({
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { pending_verification: [] },
      });

      const res = await StripeService.getAccountStatus('org1');
      expect(res).toEqual({
        chargesEnabled: true,
        payoutsEnabled: false,
        detailsSubmitted: true,
        requirements: { pending_verification: [] },
      });
    });
  });

  describe('createOnboardingLink', () => {
    it('should throw if organisation or account does not exist', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createOnboardingLink('org1')).rejects.toThrow(
        'Organisation does not have a Stripe account'
      );
    });

    it('should create an account session and return client secret', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });
      stripeMock.accountSessions.create.mockResolvedValue({ client_secret: 'cs_123' });

      const res = await StripeService.createOnboardingLink('org1');
      expect(stripeMock.accountSessions.create).toHaveBeenCalledWith({
        account: 'acct_123',
        components: { account_onboarding: { enabled: true } },
      });
      expect(res).toEqual({ client_secret: 'cs_123' });
    });
  });

  describe('createPaymentIntentForAppointment', () => {
    it('should throw if appointment is not found', async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForAppointment('app1')).rejects.toThrow('Appointment not found');
    });

    it('should throw if appointment does not require payment', async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({ status: 'PAID' });
      await expect(StripeService.createPaymentIntentForAppointment('app1')).rejects.toThrow(
        'Appointment does not require payment'
      );
    });

    it('should throw if service is not found', async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({ status: 'NO_PAYMENT', appointmentType: { id: 'srv1' } });
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForAppointment('app1')).rejects.toThrow('Service not found');
    });

    it('should throw if organisation has no Stripe account', async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({
        status: 'NO_PAYMENT', appointmentType: { id: 'srv1' }, organisationId: 'org1',
      });
      (ServiceModel.findById as jest.Mock).mockResolvedValue({ cost: 100 });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: null });

      await expect(StripeService.createPaymentIntentForAppointment('app1')).rejects.toThrow(
        'Organisation has no Stripe account'
      );
    });

    it('should create PI, update appointment, and return data (tests toStripeAmount)', async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({
        status: 'NO_PAYMENT',
        appointmentType: { id: 'srv1' },
        organisationId: 'org1',
        companion: { id: 'comp1', parent: { id: 'par1' } },
      });
      (ServiceModel.findById as jest.Mock).mockResolvedValue({ cost: 50.55 });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });

      stripeMock.paymentIntents.create.mockResolvedValue({ id: 'pi_123', client_secret: 'cs_123' });

      const res = await StripeService.createPaymentIntentForAppointment('app1');

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5055, // Math.round(50.55 * 100)
        currency: 'usd',
        metadata: {
          type: 'APPOINTMENT_BOOKING',
          appointmentId: 'app1',
          organisationId: 'org1',
          parentId: 'par1',
          companionId: 'comp1',
        },
        transfer_data: { destination: 'acct_123' },
      });
      expect(AppointmentModel.updateOne).toHaveBeenCalledWith(
        { _id: 'app1' },
        { stripePaymentIntentId: 'pi_123' }
      );
      expect(res).toEqual({
        paymentIntentId: 'pi_123',
        clientSecret: 'cs_123',
        amount: 50.55,
        currency: 'usd',
      });
    });
  });

  describe('createPaymentIntentForInvoice', () => {
    it('should throw if invoice is not found', async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Invoice not found');
    });

    it('should throw if organisation is not found', async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue({ organisationId: 'org1' });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Organisation not found');
    });

    it('should throw if invoice is not payable', async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue({ organisationId: 'org1', status: 'PAID' });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow('Invoice is not payable');
    });

    it('should throw if organisation has no connected account', async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue({ organisationId: 'org1', status: 'PENDING' });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: null });
      await expect(StripeService.createPaymentIntentForInvoice('inv1')).rejects.toThrow(
        'Organisation does not have a Stripe connected account'
      );
    });

    it('should create PaymentIntent and update invoice defaults fallback correctly', async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue({
        organisationId: 'org1',
        status: 'AWAITING_PAYMENT',
        totalAmount: 200,
      });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_123' });
      stripeMock.paymentIntents.create.mockResolvedValue({ id: 'pi_inv', client_secret: 'cs_inv' });

      const res = await StripeService.createPaymentIntentForInvoice('inv1');

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 20000,
        currency: 'usd',
        metadata: {
          type: 'INVOICE_PAYMENT',
          appointmentId: '',
          invoiceId: 'inv1',
          organisationId: 'org1', // Now matches what the mock resolves
          parentId: '',
          companionId: '',
        },
      }));
      expect(InvoiceService.attachStripeDetails).toHaveBeenCalledWith('inv1', {
        stripePaymentIntentId: 'pi_inv',
        status: 'AWAITING_PAYMENT',
      });
      expect(res).toEqual({
        paymentIntentId: 'pi_inv',
        clientSecret: 'cs_inv',
        amount: 200,
        currency: 'usd',
      });
    });
  });

  describe('retrievePaymentIntent', () => {
    it('should retrieve a payment intent', async () => {
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123' });
      const res = await StripeService.retrievePaymentIntent('pi_123');
      expect(stripeMock.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
      expect(res).toEqual({ id: 'pi_123' });
    });
  });

  describe('refundPaymentIntent', () => {
    it('should throw if invoice not found', async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.refundPaymentIntent('pi_123')).rejects.toThrow('Invoice not found');
    });

    it('should throw if no latest_charge on PaymentIntent', async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue({});
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ latest_charge: null });
      await expect(StripeService.refundPaymentIntent('pi_123')).rejects.toThrow('No charge found for PaymentIntent');
    });

    it('should issue refund and mark as refunded', async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ _id: { toString: () => 'inv1' } });
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ latest_charge: { id: 'ch_123' } });
      stripeMock.refunds.create.mockResolvedValue({ id: 're_123', status: 'succeeded', amount: 5000 });

      const res = await StripeService.refundPaymentIntent('pi_123');

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ charge: 'ch_123' });
      expect(InvoiceService.markRefunded).toHaveBeenCalledWith('inv1');
      expect(res).toEqual({ refundId: 're_123', status: 'succeeded', amountRefunded: 50 });
    });
  });

  describe('verifyWebhook', () => {
    it('should throw if signature is missing', () => {
      expect(() => StripeService.verifyWebhook(Buffer.from(''), undefined)).toThrow('Missing Stripe signature header');
    });

    it('should throw if signature is an array', () => {
      expect(() => StripeService.verifyWebhook(Buffer.from(''), ['sig1'])).toThrow('Invalid Stripe signature header format');
    });

    it('should throw if STRIPE_WEBHOOK_SECRET is missing', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() => StripeService.verifyWebhook(Buffer.from(''), 'sig')).toThrow('STRIPE_WEBHOOK_SECRET is not configured');
    });

    it('should successfully construct and return the event', () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({ type: 'some_event' });
      const res = StripeService.verifyWebhook(Buffer.from('body'), 'sig1');
      expect(res).toEqual({ type: 'some_event' });
    });
  });

  describe('handleWebhookEvent', () => {
    it('should map to _handlePaymentSucceeded', async () => {
      const spy = jest.spyOn(StripeService, '_handlePaymentSucceeded').mockResolvedValue(undefined);
      await StripeService.handleWebhookEvent({ type: 'payment_intent.succeeded', data: { object: {} } } as any);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should map to _handlePaymentFailed', async () => {
      const spy = jest.spyOn(StripeService, '_handlePaymentFailed').mockResolvedValue(undefined);
      await StripeService.handleWebhookEvent({ type: 'payment_intent.payment_failed', data: { object: {} } } as any);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should map to _handleRefund', async () => {
      const spy = jest.spyOn(StripeService, '_handleRefund').mockResolvedValue(undefined);
      await StripeService.handleWebhookEvent({ type: 'charge.refunded', data: { object: {} } } as any);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should log unhandled event types', async () => {
      await StripeService.handleWebhookEvent({ type: 'unknown.event' } as any);
      expect(logger.info).toHaveBeenCalledWith('Unhandled Stripe event: unknown.event');
    });
  });

  describe('Webhook Sub-Handlers', () => {
    describe('_handlePaymentSucceeded', () => {
      it('should return early and log error if type is missing', async () => {
        await StripeService._handlePaymentSucceeded({} as any);
        expect(logger.error).toHaveBeenCalledWith('payment_intent.succeeded missing metadata.type');
      });

      it('should route to INVOICE_PAYMENT handler', async () => {
        const spy = jest.spyOn(StripeService, '_handleInvoicePayment').mockResolvedValue(undefined);
        await StripeService._handlePaymentSucceeded({ metadata: { type: 'INVOICE_PAYMENT' } } as any);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      it('should route to APPOINTMENT_BOOKING handler', async () => {
        const spy = jest.spyOn(StripeService, '_handleAppointmentBookingPayment').mockResolvedValue(undefined);
        await StripeService._handlePaymentSucceeded({ metadata: { type: 'APPOINTMENT_BOOKING' } } as any);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      it('should log error for unknown type', async () => {
        await StripeService._handlePaymentSucceeded({ metadata: { type: 'UNKNOWN' } } as any);
        expect(logger.error).toHaveBeenCalledWith('Unknown payment type in metadata');
      });
    });

    describe('_handleAppointmentBookingPayment', () => {
      it('should return if appointmentId is missing', async () => {
        await StripeService._handleAppointmentBookingPayment({ metadata: {} } as any);
        expect(logger.error).toHaveBeenCalledWith('APPOINTMENT_BOOKING missing appointmentId');
      });

      it('should return if appointment not found', async () => {
        (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
        await StripeService._handleAppointmentBookingPayment({ metadata: { appointmentId: 'app1' } } as any);
        expect(logger.error).toHaveBeenCalledWith('Appointment not found: app1');
      });

      it('should return if invoice already exists', async () => {
        (AppointmentModel.findById as jest.Mock).mockResolvedValue({});
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ id: 'inv1' });
        await StripeService._handleAppointmentBookingPayment({ metadata: { appointmentId: 'app1' } } as any);
        expect(logger.info).toHaveBeenCalledWith('Booking invoice already created for app1');
      });

      it('should return if service not found', async () => {
        (AppointmentModel.findById as jest.Mock).mockResolvedValue({ appointmentType: { id: 'srv1' } });
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
        (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
        stripeMock.charges.retrieve.mockResolvedValue({});

        await StripeService._handleAppointmentBookingPayment({ metadata: { appointmentId: 'app1' } } as any);
        expect(logger.error).toHaveBeenCalledWith('Service not found for appointment');
      });

      it('should create an invoice and update the appointment', async () => {
        (AppointmentModel.findById as jest.Mock).mockResolvedValue({
          organisationId: 'org1',
          appointmentType: { id: 'srv1' },
          companion: { id: 'comp1', parent: { id: 'par1' } },
        });
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
        (ServiceModel.findById as jest.Mock).mockResolvedValue({ name: 'Srv', description: 'Desc', cost: 100 });
        stripeMock.charges.retrieve.mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });
        (InvoiceModel.create as jest.Mock).mockResolvedValue({ _id: 'inv1', id: 'inv1' });

        await StripeService._handleAppointmentBookingPayment({
          id: 'pi_1', currency: 'usd', latest_charge: 'ch_1', metadata: { appointmentId: 'app1' }
        } as any);

        expect(InvoiceModel.create).toHaveBeenCalled();
        expect(AppointmentModel.updateOne).toHaveBeenCalledWith(
          { _id: 'app1' },
          expect.objectContaining({ status: 'REQUESTED', invoiceId: 'inv1' })
        );
        expect(logger.info).toHaveBeenCalledWith('Appointment app1 booking PAID. Invoice inv1 created');
      });
    });

    describe('_handleInvoicePayment', () => {
      it('should return if invoiceId is missing', async () => {
        await StripeService._handleInvoicePayment({ metadata: {} } as any);
        expect(logger.error).toHaveBeenCalledWith('INVOICE_PAYMENT missing invoiceId');
      });

      it('should return if invoice is not found', async () => {
        (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
        await StripeService._handleInvoicePayment({ metadata: { invoiceId: 'inv1' } } as any);
        expect(logger.error).toHaveBeenCalledWith('Invoice not found: inv1');
      });

      it('should return if invoice is already PAID', async () => {
        (InvoiceModel.findById as jest.Mock).mockResolvedValue({ status: 'PAID' });
        await StripeService._handleInvoicePayment({ metadata: { invoiceId: 'inv1' } } as any);
        expect(logger.info).toHaveBeenCalledWith('Invoice inv1 is already PAID');
      });

      it('should update invoice status to PAID and save', async () => {
        const mockSave = jest.fn();
        const mockInvoice = { save: mockSave, status: 'PENDING' };
        (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoice);
        stripeMock.charges.retrieve.mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });

        await StripeService._handleInvoicePayment({
          id: 'pi_1', latest_charge: 'ch_1', metadata: { invoiceId: 'inv1' }
        } as any);

        expect(mockInvoice).toHaveProperty('status', 'PAID');
        expect(mockInvoice).toHaveProperty('stripePaymentIntentId', 'pi_1');
        expect(mockSave).toHaveBeenCalled();
      });
    });

    describe('_handlePaymentFailed', () => {
      it('should return early if appointmentId is missing', async () => {
        await StripeService._handlePaymentFailed({ metadata: {} } as any);
        expect(InvoiceModel.findOne).not.toHaveBeenCalled();
      });

      it('should log warn and return if invoice not found', async () => {
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
        await StripeService._handlePaymentFailed({ metadata: { appointmentId: 'app1' } } as any);
        expect(logger.warn).toHaveBeenCalledWith('Payment failed for appointment app1, no invoice to update.');
      });

      it('should update invoice status to FAILED', async () => {
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ _id: 'inv1_obj_id', id: 'inv1' });
        await StripeService._handlePaymentFailed({ metadata: { appointmentId: 'app1' } } as any);
        expect(InvoiceModel.updateOne).toHaveBeenCalledWith({ _id: 'inv1_obj_id' }, { status: 'FAILED' });
        expect(logger.warn).toHaveBeenCalledWith('Invoice inv1 marked FAILED');
      });
    });

    describe('_handleRefund', () => {
      it('should return early if appointmentId missing', async () => {
        await StripeService._handleRefund({ metadata: {} } as any);
        expect(logger.error).toHaveBeenCalledWith('charge.refunded missing appointmentId metadata');
      });

      it('should log error if invoice not found', async () => {
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
        await StripeService._handleRefund({ metadata: { appointmentId: 'app1' } } as any);
        expect(logger.error).toHaveBeenCalledWith('Refund webhook received but no invoice for appointment app1');
      });

      it('should update status to REFUNDED and send notification', async () => {
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ _id: 'inv1_obj_id', id: 'inv1', parentId: 'par1' });

        await StripeService._handleRefund({ amount: 5000, metadata: { appointmentId: 'app1' } } as any);

        expect(InvoiceModel.updateOne).toHaveBeenCalledWith({ _id: 'inv1_obj_id' }, { status: 'REFUNDED' });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith('par1', 'mocked_payload');
        expect(logger.warn).toHaveBeenCalledWith('Invoice inv1 marked REFUNDED');
      });
    });
  });
});