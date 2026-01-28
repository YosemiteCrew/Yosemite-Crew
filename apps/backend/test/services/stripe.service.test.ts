import { StripeService } from '../../src/services/stripe.service';
import Stripe from 'stripe';
import logger from '../../src/utils/logger';

// Models
import InvoiceModel from '../../src/models/invoice';
import OrganizationModel from '../../src/models/organization';
import ServiceModel from '../../src/models/service';
import AppointmentModel from '../../src/models/appointment';
import { OrgBilling } from '../../src/models/organization.billing';
import { OrgUsageCounters } from '../../src/models/organisation.usage.counter';
import UserOrganizationModel from '../../src/models/user-organization';

// Services/Utils
import { InvoiceService } from '../../src/services/invoice.service';
import { NotificationService } from '../../src/services/notification.service';

// --- Mocks ---

// Mock Stripe Class
const mStripe = {
  accounts: { create: jest.fn() },
  accountSessions: { create: jest.fn() },
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptionItems: { update: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  refunds: { create: jest.fn() },
  charges: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => {
  return jest.fn(() => mStripe);
});

jest.mock('../../src/utils/logger');
jest.mock('../../src/services/invoice.service');
jest.mock('../../src/services/notification.service');

// Mongoose Models
jest.mock('../../src/models/invoice');
jest.mock('../../src/models/organization');
jest.mock('../../src/models/service');
jest.mock('../../src/models/appointment');
jest.mock('../../src/models/organization.billing');
jest.mock('../../src/models/organisation.usage.counter');
jest.mock('../../src/models/user-organization');

// Helper to mock mongoose chain
const mockChain = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
  exec: jest.fn().mockResolvedValue(result),
});

// Helper for simple doc
const mockDoc = (data: any) => ({
  ...data,
  save: jest.fn().mockResolvedValue(data),
  _id: data._id || 'obj_id',
});

describe('StripeService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRICE_BUSINESS_MONTH: 'price_month',
      STRIPE_PRICE_BUSINESS_YEAR: 'price_year',
      APP_URL: 'http://app.com',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('Initialization', () => {
    it('should throw if STRIPE_SECRET_KEY is missing', async () => {
        jest.resetModules(); // Reset to clear cached instance
        delete process.env.STRIPE_SECRET_KEY;
        const { StripeService: LocalService } = require('../../src/services/stripe.service');

        await expect(LocalService.createOrGetConnectedAccount('org1'))
            .rejects.toThrow('STRIPE_SECRET_KEY is not configured');
    });
  });

  // --- CONNECT FLOWS ---

  describe('createOrGetConnectedAccount', () => {
    it('should return existing account ID', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(mockDoc({ stripeAccountId: 'acct_123' }));
      const res = await StripeService.createOrGetConnectedAccount('org1');
      expect(res.accountId).toBe('acct_123');
      expect(mStripe.accounts.create).not.toHaveBeenCalled();
    });

    it('should create new account if missing', async () => {
      const mockOrg = mockDoc({ _id: 'org1', stripeAccountId: undefined });
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(mockOrg);
      mStripe.accounts.create.mockResolvedValue({ id: 'new_acct' });

      // billing update mock
      (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue({});

      const res = await StripeService.createOrGetConnectedAccount('org1');

      expect(res.accountId).toBe('new_acct');
      expect(mockOrg.save).toHaveBeenCalled();
      expect(OrgBilling.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should throw if org not found', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createOrGetConnectedAccount('org1')).rejects.toThrow('Organisation not found');
    });
  });

  describe('getAccountStatus', () => {
    it('should return billing doc', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ _id: 'org1' });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue('billing_doc');
      const res = await StripeService.getAccountStatus('org1');
      expect(res).toBe('billing_doc');
    });

    it('should throw if org not found', async () => {
        (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(StripeService.getAccountStatus('org1')).rejects.toThrow('Organistaion not found');
    });
  });

  describe('createOnboardingLink', () => {
    it('should create account session', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ _id: 'org1' });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue({ connectAccountId: 'acct_1' });
      mStripe.accountSessions.create.mockResolvedValue({ client_secret: 'secret' });

      const res = await StripeService.createOnboardingLink('org1');
      expect(res.client_secret).toBe('secret');
    });

    it('should throw if billing/connect ID missing', async () => {
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({ _id: 'org1' });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);
      await expect(StripeService.createOnboardingLink('org1')).rejects.toThrow('Organisation does not have a Stripe account');
    });
  });

  // --- SAAS SUBSCRIPTIONS ---

  describe('createBusinessCheckoutSession', () => {
    const mockOrg = mockDoc({ _id: 'org1', name: 'My Org', stripeAccountId: 'acct_1' });
    const mockBilling = mockDoc({ connectAccountId: 'acct_1', canAcceptPayments: true, stripeCustomerId: 'cus_1' });

    beforeEach(() => {
        (OrganizationModel.findById as jest.Mock).mockResolvedValue(mockOrg);
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue(mockBilling); // ensureBillingDocs
        (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
        (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(5); // 5 seats
    });

    it('should create session for monthly interval', async () => {
        mStripe.checkout.sessions.create.mockResolvedValue({ url: 'http://checkout' });

        const res = await StripeService.createBusinessCheckoutSession('org1', 'month');

        expect(res.url).toBe('http://checkout');
        expect(mStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'subscription',
            customer: 'cus_1',
            line_items: [{ price: 'price_month', quantity: 5 }]
        }), expect.anything());
    });

    it('should create customer if missing', async () => {
        // Mock billing without customer ID
        const noCusBilling = mockDoc({ connectAccountId: 'acct_1', canAcceptPayments: true });
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue(noCusBilling);

        mStripe.customers.create.mockResolvedValue({ id: 'new_cus' });
        mStripe.checkout.sessions.create.mockResolvedValue({ url: 'url' });

        await StripeService.createBusinessCheckoutSession('org1', 'year');

        expect(mStripe.customers.create).toHaveBeenCalled();
        expect(noCusBilling.stripeCustomerId).toBe('new_cus');
        expect(noCusBilling.save).toHaveBeenCalled();
    });

    it('should throw if not ready for payments', async () => {
        const notReadyBilling = mockDoc({ canAcceptPayments: false });
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue(notReadyBilling);
        await expect(StripeService.createBusinessCheckoutSession('org1', 'month'))
            .rejects.toThrow('Stripe account not ready');
    });

    it('should throw if 0 seats', async () => {
        (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(0);
        await expect(StripeService.createBusinessCheckoutSession('org1', 'month'))
            .rejects.toThrow('No users found');
    });
  });

  describe('createCustomerPortalSession', () => {
      it('should create portal session', async () => {
          (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue({ stripeCustomerId: 'cus_1' });
          mStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'portal' });

          const res = await StripeService.createCustomerPortalSession('org1');
          expect(res.url).toBe('portal');
      });

      it('should throw if no customer id', async () => {
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue({});
        await expect(StripeService.createCustomerPortalSession('org1')).rejects.toThrow('No billing customer found');
      });
  });

  describe('syncSubscriptionSeats', () => {
      it('should update subscription if quantity changed', async () => {
          const billing = mockDoc({
              plan: 'business',
              stripeSubscriptionItemId: 'si_1',
              subscriptionStatus: 'active',
              seatQuantity: 2
          });
          (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue(billing);
          (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(5); // Changed to 5

          const res = await StripeService.syncSubscriptionSeats('org1');

          expect(res.updated).toBe(true);
          expect(mStripe.subscriptionItems.update).toHaveBeenCalledWith('si_1', {
              quantity: 5,
              proration_behavior: 'create_prorations'
          });
          expect(billing.seatQuantity).toBe(5);
          expect(billing.save).toHaveBeenCalled();
      });

      it('should return false if not business plan', async () => {
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue({ plan: 'free' });
        const res = await StripeService.syncSubscriptionSeats('org1');
        expect(res.reason).toBe('not_business');
      });

      it('should return false if status not active', async () => {
        (OrgBilling.findOneAndUpdate as jest.Mock).mockResolvedValue({
            plan: 'business', stripeSubscriptionItemId: 'si_1', subscriptionStatus: 'canceled'
        });
        const res = await StripeService.syncSubscriptionSeats('org1');
        expect(res.reason).toBe('subscription_not_syncable');
      });
  });

  // --- PAYMENT INTENTS ---

  describe('createPaymentIntentForAppointment', () => {
      it('should create PI and update appointment', async () => {
          const mockAppt = {
              status: 'NO_PAYMENT',
              appointmentType: { id: 'srv_1' },
              organisationId: 'org_1',
              companion: { id: 'c1', parent: { id: 'p1' } }
          };
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
          (ServiceModel.findById as jest.Mock).mockResolvedValue({ cost: 100 });
          (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_1' });

          mStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'sec_1' });

          const res = await StripeService.createPaymentIntentForAppointment('appt_1');

          expect(res.paymentIntentId).toBe('pi_1');
          expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
              amount: 10000, // 100 * 100
              transfer_data: { destination: 'acct_1' }
          }));
          expect(AppointmentModel.updateOne).toHaveBeenCalled();
      });

      it('should throw if appt status wrong', async () => {
        (AppointmentModel.findById as jest.Mock).mockResolvedValue({ status: 'PAID' });
        await expect(StripeService.createPaymentIntentForAppointment('a1')).rejects.toThrow('does not require payment');
      });
  });

  describe('createPaymentIntentForInvoice', () => {
      it('should create PI for invoice', async () => {
          const mockInv = {
              status: 'AWAITING_PAYMENT',
              totalAmount: 50,
              organisationId: 'org_1'
          };
          (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInv);
          (OrganizationModel.findById as jest.Mock).mockResolvedValue({ stripeAccountId: 'acct_1' });
          mStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'sec' });

          await StripeService.createPaymentIntentForInvoice('inv_1');

          expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
              amount: 5000
          }));
          expect(InvoiceService.attachStripeDetails).toHaveBeenCalledWith('inv_1', expect.anything());
      });
  });

  describe('refundPaymentIntent', () => {
      it('should process refund', async () => {
          (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ _id: 'inv_1' });
          mStripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: { id: 'ch_1' } });
          mStripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 5000 });

          const res = await StripeService.refundPaymentIntent('pi_1');

          expect(res.amountRefunded).toBe(50);
          expect(InvoiceService.markRefunded).toHaveBeenCalledWith('inv_1');
      });

      it('should throw if no charge on PI', async () => {
        (InvoiceModel.findOne as jest.Mock).mockResolvedValue({ _id: 'inv_1' });
        mStripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: null });
        await expect(StripeService.refundPaymentIntent('pi_1')).rejects.toThrow('No charge found');
      });
  });

  // --- WEBHOOKS ---

  describe('verifyWebhook', () => {
      it('should construct event', () => {
          mStripe.webhooks.constructEvent.mockReturnValue({ type: 'test' });
          const evt = StripeService.verifyWebhook(Buffer.from('data'), 'sig');
          expect(evt.type).toBe('test');
      });

      it('should throw on missing sig', () => {
          expect(() => StripeService.verifyWebhook(Buffer.from(''), undefined)).toThrow('Missing Stripe signature');
      });
  });

  describe('handleWebhookEvent', () => {
      it('should handle account.updated', async () => {
          const event = { type: 'account.updated', data: { object: { id: 'acct_1', charges_enabled: true, payouts_enabled: true } } } as any;

          await StripeService.handleWebhookEvent(event);

          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { connectAccountId: 'acct_1' },
              expect.objectContaining({ canAcceptPayments: true })
          );
      });

      it('should handle checkout.session.completed', async () => {
          const event = {
              type: 'checkout.session.completed',
              data: { object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', livemode: true } }
          } as any;

          mStripe.subscriptions.retrieve.mockResolvedValue({
              id: 'sub_1',
              status: 'active',
              items: { data: [{ id: 'si_1', price: { id: 'p_1', recurring: { interval: 'month' } }, quantity: 5, current_period_start: 100, current_period_end: 200 }] }
          });

          await StripeService.handleWebhookEvent(event);

          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { stripeCustomerId: 'cus_1' },
              expect.objectContaining({ plan: 'business', stripeSubscriptionId: 'sub_1' })
          );
      });

      it('should handle customer.subscription.updated', async () => {
          const event = { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'past_due', items: { data: [{ quantity: 5 }] } } } } as any;
          await StripeService.handleWebhookEvent(event);
          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { stripeSubscriptionId: 'sub_1' },
              expect.objectContaining({ subscriptionStatus: 'past_due' })
          );
      });

      it('should handle customer.subscription.deleted', async () => {
          const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } } as any;
          await StripeService.handleWebhookEvent(event);
          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { stripeSubscriptionId: 'sub_1' },
              expect.objectContaining({ plan: 'free', accessState: 'free' })
          );
      });

      it('should handle invoice.paid', async () => {
          const event = { type: 'invoice.paid', data: { object: { id: 'inv_stripe', lines: { data: [{ subscription: 'sub_1' }] } } } } as any;
          await StripeService.handleWebhookEvent(event);
          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { stripeSubscriptionId: 'sub_1' },
              expect.objectContaining({ lastPaymentStatus: 'paid' })
          );
      });

      it('should handle invoice.payment_failed', async () => {
          const event = { type: 'invoice.payment_failed', data: { object: { id: 'inv_stripe', lines: { data: [{ subscription: 'sub_1' }] } } } } as any;
          await StripeService.handleWebhookEvent(event);
          expect(OrgBilling.updateOne).toHaveBeenCalledWith(
              { stripeSubscriptionId: 'sub_1' },
              expect.objectContaining({ accessState: 'past_due' })
          );
      });

      it('should handle payment_intent.succeeded (INVOICE)', async () => {
          const event = {
              type: 'payment_intent.succeeded',
              data: { object: { id: 'pi_1', metadata: { type: 'INVOICE_PAYMENT', invoiceId: 'inv_1' }, latest_charge: 'ch_1', currency: 'usd' } }
          } as any;

          const mockInvoice = mockDoc({ status: 'AWAITING_PAYMENT' });
          (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoice);
          mStripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });

          await StripeService.handleWebhookEvent(event);

          expect(mockInvoice.status).toBe('PAID');
          expect(mockInvoice.save).toHaveBeenCalled();
      });

      it('should handle payment_intent.succeeded (APPOINTMENT)', async () => {
          const event = {
              type: 'payment_intent.succeeded',
              data: { object: { id: 'pi_1', metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'app_1' }, latest_charge: 'ch_1', currency: 'usd' } }
          } as any;

          (AppointmentModel.findById as jest.Mock).mockResolvedValue({ _id: 'app_1', appointmentType: { id: 's1' }, companion: { id: 'c1', parent: { id: 'p1' } } });
          (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null); // No existing invoice
          (ServiceModel.findById as jest.Mock).mockResolvedValue({ cost: 100 });
          mStripe.charges.retrieve.mockResolvedValue({ id: 'ch_1' });
          (InvoiceModel.create as jest.Mock).mockResolvedValue({ _id: 'new_inv' });

          await StripeService.handleWebhookEvent(event);

          expect(InvoiceModel.create).toHaveBeenCalled();
          expect(AppointmentModel.updateOne).toHaveBeenCalledWith({ _id: 'app_1' }, expect.objectContaining({ status: 'REQUESTED' }));
      });

      it('should handle charge.refunded', async () => {
          const event = {
              type: 'charge.refunded',
              data: { object: { amount: 5000, currency: 'usd', metadata: { appointmentId: 'app_1' } } }
          } as any;

          const mockInvoice = mockDoc({ parentId: 'p1' });
          (InvoiceModel.findOne as jest.Mock).mockResolvedValue(mockInvoice);

          await StripeService.handleWebhookEvent(event);

          expect(InvoiceModel.updateOne).toHaveBeenCalledWith(expect.anything(), { status: 'REFUNDED' });
          expect(NotificationService.sendToUser).toHaveBeenCalled();
      });

      it('should ignore unknown events', async () => {
          const event = { type: 'unknown.event' } as any;
          await StripeService.handleWebhookEvent(event);
          expect(logger.info).toHaveBeenCalledWith('Unhandled Stripe event: unknown.event');
      });
  });
});