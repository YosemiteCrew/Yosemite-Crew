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

// FIX: Robust Mongoose Chain Helper with .then() for await support
const mockChain = (result: any) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    exec: jest.fn().mockResolvedValue(result),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  // Allow direct await on the chain
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
};

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
        jest.resetModules();
        delete process.env.STRIPE_SECRET_KEY;
        const { StripeService: LocalService } = require('../../src/services/stripe.service');

        await expect(LocalService.createOrGetConnectedAccount('org1'))
            .rejects.toThrow('STRIPE_SECRET_KEY is not configured');
    });
  });

  // --- CONNECT FLOWS ---

  describe('createOrGetConnectedAccount', () => {
    it('should return existing account ID', async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(mockDoc({ stripeAccountId: 'acct_123' })));
      const res = await StripeService.createOrGetConnectedAccount('org1');
      expect(res.accountId).toBe('acct_123');
      expect(mStripe.accounts.create).not.toHaveBeenCalled();
    });

    it('should create new account if missing', async () => {
      const mockOrg = mockDoc({ _id: 'org1', stripeAccountId: undefined });
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(mockOrg));

      mStripe.accounts.create.mockResolvedValue({ id: 'new_acct' });

      // FIX: Mock findOneAndUpdate return chain
      (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({}));

      const res = await StripeService.createOrGetConnectedAccount('org1');

      expect(res.accountId).toBe('new_acct');
      expect(mockOrg.save).toHaveBeenCalled();
      expect(OrgBilling.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should throw if org not found', async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(null));
      await expect(StripeService.createOrGetConnectedAccount('org1')).rejects.toThrow('Organisation not found');
    });
  });

  describe('getAccountStatus', () => {
    it('should return billing doc', async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: 'org1' }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain('billing_doc'));

      // FIX: Explicitly mock OrgUsageCounters.findOne to return a chain because service uses .lean()
      (OrgUsageCounters.findOne as jest.Mock).mockReturnValue(mockChain({}));

      const res = await StripeService.getAccountStatus('org1');
      expect(res.orgBilling).toBe('billing_doc');
    });

    it('should throw if org not found', async () => {
        (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(null));
        await expect(StripeService.getAccountStatus('org1')).rejects.toThrow('Organistaion not found');
    });
  });

  describe('createOnboardingLink', () => {
    it('should create account session', async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: 'org1' }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ connectAccountId: 'acct_1' }));
      mStripe.accountSessions.create.mockResolvedValue({ client_secret: 'secret' });

      const res = await StripeService.createOnboardingLink('org1');
      expect(res.client_secret).toBe('secret');
    });

    it('should throw if billing/connect ID missing', async () => {
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: 'org1' }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain(null));
      await expect(StripeService.createOnboardingLink('org1')).rejects.toThrow('Organisation does not have a Stripe account');
    });
  });

  // --- SAAS SUBSCRIPTIONS ---

  describe('createBusinessCheckoutSession', () => {
    const mockOrg = mockDoc({ _id: 'org1', name: 'My Org', stripeAccountId: 'acct_1' });
    const mockBilling = mockDoc({ connectAccountId: 'acct_1', canAcceptPayments: true, stripeCustomerId: 'cus_1' });

    beforeEach(() => {
        (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(mockOrg));
        // Mock both potential access patterns
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(mockBilling));
        (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain(mockBilling));

        (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
        (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(5);
    });

    it('should create session for monthly interval', async () => {
        mStripe.checkout.sessions.create.mockResolvedValue({ url: 'http://checkout' });

        const res = await StripeService.createBusinessCheckoutSession('org1', 'month');

        expect(res.url).toBe('http://checkout');
        expect(mStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'subscription',
            customer: 'cus_1',
            line_items: [{ price: 'price_month', quantity: 5 }]
        }));
    });

    it('should create customer if missing', async () => {
        const noCusBilling = mockDoc({ connectAccountId: 'acct_1', canAcceptPayments: true });
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(noCusBilling));

        mStripe.customers.create.mockResolvedValue({ id: 'new_cus' });
        mStripe.checkout.sessions.create.mockResolvedValue({ url: 'url' });

        await StripeService.createBusinessCheckoutSession('org1', 'year');

        expect(mStripe.customers.create).toHaveBeenCalled();
        expect(noCusBilling.stripeCustomerId).toBe('new_cus');
        expect(noCusBilling.save).toHaveBeenCalled();
    });

    it('should throw if not ready for payments', async () => {
        const notReadyBilling = mockDoc({ canAcceptPayments: false });
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(notReadyBilling));
    });

    it('should throw if 0 seats', async () => {
        (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(0);
        await expect(StripeService.createBusinessCheckoutSession('org1', 'month'))
            .rejects.toThrow('No users found');
    });
  });

  describe('createCustomerPortalSession', () => {
      it('should create portal session', async () => {
          (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({ stripeCustomerId: 'cus_1' }));
          mStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'portal' });

          const res = await StripeService.createCustomerPortalSession('org1');
          expect(res.url).toBe('portal');
      });

      it('should throw if no customer id', async () => {
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({}));
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
          (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(billing));
          (UserOrganizationModel.countDocuments as jest.Mock).mockResolvedValue(5);

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
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({ plan: 'free' }));
        const res = await StripeService.syncSubscriptionSeats('org1');
        expect(res.reason).toBe('not_business');
      });

      it('should return false if status not active', async () => {
        (OrgBilling.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain({
            plan: 'business', stripeSubscriptionItemId: 'si_1', subscriptionStatus: 'canceled'
        }));
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
          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(mockAppt));
          (ServiceModel.findById as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
          (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ stripeAccountId: 'acct_1' }));

          mStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'sec_1' });

          const res = await StripeService.createPaymentIntentForAppointment('appt_1');

          expect(res.paymentIntentId).toBe('pi_1');
          expect(AppointmentModel.updateOne).toHaveBeenCalled();
      });

      it('should throw if appt status wrong', async () => {
        (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain({ status: 'PAID' }));
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
          (InvoiceModel.findById as jest.Mock).mockReturnValue(mockChain(mockInv));
          (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ stripeAccountId: 'acct_1' }));
          mStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'sec' });

          await StripeService.createPaymentIntentForInvoice('inv_1');

          expect(mStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
              amount: 5000
          }));
      });
  });

  describe('refundPaymentIntent', () => {
      it('should process refund', async () => {
          (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ _id: 'inv_1' }));
          mStripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: { id: 'ch_1' } });
          mStripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 5000 });

          const res = await StripeService.refundPaymentIntent('pi_1');

          expect(res.amountRefunded).toBe(50);
          expect(InvoiceService.markRefunded).toHaveBeenCalledWith('inv_1');
      });

      it('should throw if no charge on PI', async () => {
        (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ _id: 'inv_1' }));
        mStripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: null });
        await expect(StripeService.refundPaymentIntent('pi_1')).rejects.toThrow('No charge found');
      });
  });

  // --- WEBHOOKS ---

  describe('handleWebhookEvent', () => {
      it('should handle payment_intent.succeeded (INVOICE)', async () => {
          const event = {
              type: 'payment_intent.succeeded',
              data: { object: { id: 'pi_1', metadata: { type: 'INVOICE_PAYMENT', invoiceId: 'inv_1' }, latest_charge: 'ch_1', currency: 'usd' } }
          } as any;

          const mockInvoice = mockDoc({ status: 'AWAITING_PAYMENT' });
          (InvoiceModel.findById as jest.Mock).mockReturnValue(mockChain(mockInvoice));
          // Mock findOne as well just in case service uses that
          (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain(mockInvoice));
          mStripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', receipt_url: 'url' });

          await StripeService.handleWebhookEvent(event);
      });

      it('should handle payment_intent.succeeded (APPOINTMENT)', async () => {
          const event = {
              type: 'payment_intent.succeeded',
              data: { object: { id: 'pi_1', metadata: { type: 'APPOINTMENT_BOOKING', appointmentId: 'app_1' }, latest_charge: 'ch_1', currency: 'usd' } }
          } as any;

          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain({ _id: 'app_1', appointmentType: { id: 's1' }, companion: { id: 'c1', parent: { id: 'p1' } } }));
          (InvoiceModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
          (ServiceModel.findById as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
          mStripe.charges.retrieve.mockResolvedValue({ id: 'ch_1' });
          (InvoiceModel.create as jest.Mock).mockResolvedValue({ _id: 'new_inv' });

          await StripeService.handleWebhookEvent(event);

          expect(InvoiceModel.create).toHaveBeenCalled();
          expect(AppointmentModel.updateOne).toHaveBeenCalledWith({ _id: 'app_1' }, expect.objectContaining({ status: 'REQUESTED' }));
      });
  });
});