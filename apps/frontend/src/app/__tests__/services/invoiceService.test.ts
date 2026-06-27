import {
  addLineItemsToAppointments,
  getPaymentLink,
  loadAppointmentBilling,
  loadInvoicesForAppointment,
  loadInvoicesForOrgPrimaryOrg,
  markAppointmentReadyForBilling,
  markInvoicePaid,
  updateInvoicePaymentCollectionMethod,
} from '@/app/features/billing/services/invoiceService';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { getData, patchData, postData } from '@/app/services/axios';

type InvoiceState = {
  startLoading: jest.Mock;
  setInvoicesForOrg: jest.Mock;
  upsertInvoice: jest.Mock;
  getInvoicesByOrgId: jest.Mock;
  status: 'idle' | 'loading' | 'loaded' | 'error';
};

type OrgState = {
  primaryOrgId: string | null;
};

jest.mock('@/app/stores/invoiceStore', () => ({
  useInvoiceStore: { getState: jest.fn() },
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: jest.fn() },
}));

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@yosemite-crew/types', () => ({
  fromInvoiceRequestDTO: (x: any) => x,
}));

describe('invoiceService', () => {
  let invoiceState: InvoiceState;
  let orgState: OrgState;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceState = {
      startLoading: jest.fn(),
      setInvoicesForOrg: jest.fn(),
      upsertInvoice: jest.fn(),
      getInvoicesByOrgId: jest.fn().mockReturnValue([]),
      status: 'idle',
    };
    orgState = { primaryOrgId: 'org-1' };

    (useInvoiceStore.getState as jest.Mock).mockReturnValue(invoiceState);
    (useOrgStore.getState as jest.Mock).mockReturnValue(orgState);
    (getData as jest.Mock).mockResolvedValue({ data: [] });
    (patchData as jest.Mock).mockResolvedValue({ data: {} });
    (postData as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('loads invoices when idle', async () => {
    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).toHaveBeenCalled();
    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/invoices',
      expect.objectContaining({
        organisationId: 'org-1',
        _cacheBust: expect.any(Number),
      })
    );
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith('org-1', []);
  });

  it('restores missing appointment id from invoice account reference', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-mobile-1',
          resourceType: 'Invoice',
          account: { reference: 'https://api.example.com/fhir/v1/Appointment/appt-mobile-1' },
        },
      ],
    });

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith(
      'org-1',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'inv-mobile-1',
          appointmentId: 'appt-mobile-1',
        }),
      ])
    );
  });

  it('maps an enveloped finance invoice list into workspace past invoices', async () => {
    // Exact shape returned by GET /v1/finance/invoices: a { data, meta, error }
    // envelope wrapping plain finance invoices (no FHIR resourceType).
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: '672e7254-ae36-4658-b567-62e88ab4ecb7',
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            items: [
              {
                name: 'Sample testing package',
                total: 272.3175,
                quantity: 1,
                unitPrice: 272.3175,
                description: 'Sample testing package',
              },
            ],
            subtotal: 272.32,
            totalAmount: 272.32,
            currency: 'usd',
            visitBillingStage: 'DRAFT',
            status: 'AWAITING_PAYMENT',
            payments: [
              {
                id: 'pay-1',
                amount: 100,
                settlementChannel: 'CARD_PRESENT',
                provider: 'MANUAL',
                status: 'PAID',
                paidAt: '2026-06-22T18:12:30.000Z',
                receiptUrl: 'https://files.test/receipt.pdf',
              },
            ],
            pdfUrl: 'https://files.test/invoice.pdf',
            renderedDocumentId: 'rd-invoice-1',
            createdAt: '2026-06-22T18:11:58.870Z',
            updatedAt: '2026-06-22T18:12:00.073Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(billing.pastInvoices).toHaveLength(1);
    expect(billing.pastInvoices[0]).toMatchObject({
      id: '672e7254-ae36-4658-b567-62e88ab4ecb7',
      status: 'PARTIAL',
      totalCents: 27232,
      pdfUrl: 'https://files.test/invoice.pdf',
      renderedDocumentId: 'rd-invoice-1',
    });
    expect(billing.pastInvoices[0].payments).toEqual([
      {
        id: 'pay-1',
        amountCents: 10000,
        method: 'CARD_PRESENT',
        provider: 'MANUAL',
        status: 'PAID',
        paidAt: '2026-06-22T18:12:30.000Z',
        receiptUrl: 'https://files.test/receipt.pdf',
      },
    ]);
    expect(billing.pastInvoices[0].items[0]).toMatchObject({
      name: 'Sample testing package',
    });
    expect(billing.currency).toBe('USD');
  });

  it('keeps awaiting-payment invoices unpaid when no payment ledger exists', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'inv-awaiting-payment',
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            items: [
              {
                name: 'Sample testing package',
                total: 933.66,
                quantity: 1,
                unitPrice: 933.66,
                description: 'Sample testing package',
              },
            ],
            subtotal: 933.66,
            totalAmount: 933.66,
            currency: 'usd',
            status: 'AWAITING_PAYMENT',
            payments: [],
            createdAt: '2026-06-27T09:42:35.064Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(billing.pastInvoices[0]).toMatchObject({
      id: 'inv-awaiting-payment',
      totalCents: 93366,
      outstandingCents: 93366,
      status: 'UNPAID',
      payments: [],
    });
  });

  it('counts a deposit payment toward the deposit balance', async () => {
    // The backend now records the deposit on the same invoice, so the payment
    // ledger should be the source of truth when depositCollectedAmount is still 0.
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'inv-deposit',
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            items: [{ name: 'Consult', total: 100, quantity: 1, unitPrice: 100 }],
            totalAmount: 100,
            currency: 'usd',
            billingCollectionMode: 'DEPOSIT_THEN_SETTLE',
            visitBillingStage: 'READY_FOR_BILLING',
            depositCollectedAmount: 0,
            status: 'AWAITING_PAYMENT',
            payments: [
              {
                id: 'pay-deposit',
                amount: 100,
                settlementChannel: 'DEPOSIT',
                provider: 'MANUAL',
                status: 'SUCCEEDED',
                paidAt: '2026-06-22T19:54:43.986Z',
              },
            ],
            createdAt: '2026-06-22T19:51:52.106Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(billing.depositCents).toBe(10000);
    expect(billing.pastInvoices[0]).toMatchObject({
      outstandingCents: 0,
      status: 'PAID_FULL',
    });
  });

  it('marks an invoice as partially paid when the payment ledger covers only part of the total', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'inv-partial',
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            items: [{ name: 'Consult', total: 100, quantity: 1, unitPrice: 100 }],
            totalAmount: 100,
            currency: 'usd',
            status: 'AWAITING_PAYMENT',
            payments: [
              {
                id: 'pay-partial',
                amount: 25,
                settlementChannel: 'CARD_PRESENT',
                provider: 'MANUAL',
                status: 'SUCCEEDED',
                paidAt: '2026-06-22T19:54:43.986Z',
              },
            ],
            createdAt: '2026-06-22T19:51:52.106Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(billing.pastInvoices[0]).toMatchObject({
      outstandingCents: 7500,
      status: 'PARTIAL',
    });
  });

  it('prefers explicit depositCollectedAmount over payment ledger fallback', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'inv-deposit-explicit',
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            items: [{ name: 'Consult', total: 100, quantity: 1, unitPrice: 100 }],
            totalAmount: 100,
            currency: 'usd',
            billingCollectionMode: 'DEPOSIT_THEN_SETTLE',
            visitBillingStage: 'READY_FOR_BILLING',
            depositCollectedAmount: 25,
            payments: [
              {
                id: 'pay-deposit',
                amount: 100,
                settlementChannel: 'DEPOSIT',
                provider: 'MANUAL',
                status: 'SUCCEEDED',
                paidAt: '2026-06-22T19:54:43.986Z',
              },
            ],
            createdAt: '2026-06-22T19:51:52.106Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(billing.depositCents).toBe(2500);
  });

  it('skips loading when already loading', async () => {
    invoiceState.status = 'loading';

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).not.toHaveBeenCalled();
  });

  it('skips loading when primary org is missing', async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('forces loading when requested', async () => {
    invoiceState.status = 'loaded';

    await loadInvoicesForOrgPrimaryOrg({ force: true, silent: true });

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith('org-1', []);
  });

  it('calls mark-paid endpoint', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: { id: 'inv-1', organisationId: 'org-1', totalAmount: 125, currency: 'usd' },
        meta: null,
        error: null,
      },
    });

    await markInvoicePaid('inv-1');

    expect(postData).toHaveBeenCalledWith('/v1/finance/invoices/inv-1/payments', {
      provider: 'MANUAL',
      settlementChannel: 'CASH',
      amount: 125,
      currency: 'usd',
      receivedAt: expect.any(String),
    });
  });

  it('updates payment collection method before offline settlement', async () => {
    await updateInvoicePaymentCollectionMethod('inv-1', 'PAYMENT_AT_CLINIC');

    expect(patchData).toHaveBeenCalledWith('/v1/finance/invoices/inv-1/payment-collection-method', {
      paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    });
  });

  it('loads without startLoading when silent option is enabled', async () => {
    await loadInvoicesForOrgPrimaryOrg({ silent: true });
    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalled();
  });

  it('loads invoices for appointment and upserts them', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        { id: 'inv-1', resourceType: 'Invoice', organisationId: 'org-1', appointmentId: 'apt-1' },
      ],
    });

    await loadInvoicesForAppointment('apt-1');

    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/invoices',
      expect.objectContaining({
        organisationId: 'org-1',
        appointmentId: 'apt-1',
        _cacheBust: expect.any(Number),
      })
    );
    expect(invoiceState.upsertInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inv-1', appointmentId: 'apt-1' })
    );
  });

  it('throws when load invoices request fails', async () => {
    const err = new Error('load failed');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getData as jest.Mock).mockRejectedValue(err);
    await expect(loadInvoicesForOrgPrimaryOrg()).rejects.toThrow('load failed');
    errorSpy.mockRestore();
  });

  it('adds line items successfully', async () => {
    invoiceState.getInvoicesByOrgId = jest.fn().mockReturnValue([
      {
        id: 'inv-1',
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        status: 'AWAITING_PAYMENT',
      },
    ]);
    await addLineItemsToAppointments([{ id: 'li-1' } as any], 'appt-1', 'USD');
    expect(postData).toHaveBeenCalledWith(
      '/v1/finance/invoices/inv-1/lines',
      expect.objectContaining({ currency: 'usd' })
    );
  });

  it('adds line items to the open invoice, not a paid deposit invoice', async () => {
    // Two invoices for the appointment: a PAID/SETTLED deposit and an open bill.
    // Lines must target the open one — posting to the paid invoice 409s.
    invoiceState.getInvoicesByOrgId = jest.fn().mockReturnValue([
      {
        id: 'inv-deposit',
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        status: 'PAID',
        visitBillingStage: 'SETTLED',
      },
      {
        id: 'inv-open',
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        status: 'AWAITING_PAYMENT',
        visitBillingStage: 'DRAFT',
      },
    ]);

    await addLineItemsToAppointments([{ id: 'li-1' } as any], 'appt-1', 'USD');

    expect(postData).toHaveBeenCalledWith(
      '/v1/finance/invoices/inv-open/lines',
      expect.objectContaining({ currency: 'usd' })
    );
    expect(postData).not.toHaveBeenCalledWith(
      '/v1/finance/invoices/inv-deposit/lines',
      expect.anything()
    );
  });

  it('only appends line items missing from an existing appointment invoice', async () => {
    invoiceState.getInvoicesByOrgId = jest.fn().mockReturnValue([
      {
        id: 'inv-1',
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        status: 'AWAITING_PAYMENT',
        items: [
          {
            id: 'li-existing',
            name: 'Consult',
            quantity: 1,
            unitPrice: 1000,
            total: 1000,
          },
        ],
      },
    ]);

    await addLineItemsToAppointments(
      [
        {
          id: 'li-existing',
          name: 'Consult',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
        },
        {
          id: 'li-new',
          name: 'Medication',
          quantity: 1,
          unitPrice: 500,
          total: 500,
        },
      ],
      'appt-1',
      'USD'
    );

    expect(postData).toHaveBeenCalledWith('/v1/finance/invoices/inv-1/lines', {
      currency: 'usd',
      items: [
        {
          name: 'Medication',
          description: 'Medication',
          quantity: 1,
          unitPrice: 500,
          total: 500,
        },
      ],
    });
  });

  it('skips appending line items when the appointment invoice already has them', async () => {
    invoiceState.getInvoicesByOrgId = jest.fn().mockReturnValue([
      {
        id: 'inv-1',
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        status: 'AWAITING_PAYMENT',
        items: [
          {
            id: 'li-existing',
            name: 'Consult',
            quantity: 1,
            unitPrice: 1000,
            total: 1000,
          },
        ],
      },
    ]);

    await addLineItemsToAppointments(
      [
        {
          id: 'li-existing',
          name: 'Consult',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
        },
      ],
      'appt-1',
      'USD'
    );

    expect(postData).not.toHaveBeenCalledWith(
      '/v1/finance/invoices/inv-1/lines',
      expect.anything()
    );
  });

  it('throws when line-item payload is invalid', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(addLineItemsToAppointments([], '', '')).rejects.toThrow(
      'Line items or Appointment ID or Currency missing'
    );
    errorSpy.mockRestore();
  });

  it('returns early for add line items when org is missing', async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await addLineItemsToAppointments([{ id: 'li-1' } as any], 'appt-1', 'USD');
    expect(postData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('gets payment link successfully', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: {
        data: { checkoutUrl: 'https://stripe.test' },
        meta: null,
        error: null,
      },
    });
    const result = await getPaymentLink('inv-1');
    expect(postData).toHaveBeenCalledWith('/v1/finance/invoices/inv-1/payments/sessions', {
      provider: 'STRIPE',
    });
    expect(result).toBe('https://stripe.test');
  });

  it('reads the checkout link from the finance `url` field', async () => {
    // The finance payments/sessions endpoint returns the Stripe link as `url`
    // (with sessionId + paymentAttemptId), not `checkoutUrl`.
    (postData as jest.Mock).mockResolvedValue({
      data: {
        data: {
          sessionId: 'cs_test_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          paymentAttemptId: 'pa-1',
        },
        meta: null,
        error: null,
      },
    });
    const result = await getPaymentLink('inv-1');
    expect(result).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  it('throws when invoice id is missing in payment link call', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getPaymentLink('')).rejects.toThrow('Invoice ID missing');
    errorSpy.mockRestore();
  });

  it('returns early for payment link when org missing', async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await getPaymentLink('inv-1');
    expect(postData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws when mark paid invoice id is missing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(markInvoicePaid('')).rejects.toThrow('Invoice ID missing');
    errorSpy.mockRestore();
  });

  it('returns early when marking paid and org missing', async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await markInvoicePaid('inv-1');
    expect(postData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws when payment collection method invoice id is missing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(updateInvoicePaymentCollectionMethod('', 'PAYMENT_AT_CLINIC')).rejects.toThrow(
      'Invoice ID missing'
    );
    errorSpy.mockRestore();
  });

  it('returns early when updating payment collection method and org missing', async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await updateInvoicePaymentCollectionMethod('inv-1', 'PAYMENT_AT_CLINIC');
    expect(patchData).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('marks appointment ready for billing through finance endpoint', async () => {
    (postData as jest.Mock).mockResolvedValueOnce({
      data: {
        data: { appointmentId: 'appt-1', billingState: 'READY_FOR_BILLING' },
        meta: null,
        error: null,
      },
    });

    await markAppointmentReadyForBilling('appt-1', {
      organisationId: 'org-1',
      visitId: 'enc-1',
      notes: 'Ready',
    });

    expect(postData).toHaveBeenCalledWith('/v1/finance/appointments/appt-1/ready-for-billing', {
      organisationId: 'org-1',
      visitId: 'enc-1',
      notes: 'Ready',
    });
  });

  it('creates a draft billing handoff invoice and retries when ready-for-billing has no invoice', async () => {
    (postData as jest.Mock)
      .mockRejectedValueOnce({
        response: { status: 404, data: { message: 'Invoice not found' } },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'inv-1',
            appointmentId: 'appt-1',
            organisationId: 'org-1',
            items: [],
            totalAmount: 0,
          },
          meta: null,
          error: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            appointmentId: 'appt-1',
            billingState: 'READY_FOR_BILLING',
            invoiceId: 'inv-1',
          },
          meta: null,
          error: null,
        },
      });

    await markAppointmentReadyForBilling('appt-1', {
      organisationId: 'org-1',
      parentId: 'parent-1',
      patientId: 'patient-1',
      visitId: 'enc-1',
      notes: 'Ready',
    });

    expect(postData).toHaveBeenNthCalledWith(
      1,
      '/v1/finance/appointments/appt-1/ready-for-billing',
      {
        organisationId: 'org-1',
        parentId: 'parent-1',
        patientId: 'patient-1',
        visitId: 'enc-1',
        notes: 'Ready',
      }
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/v1/finance/invoices',
      expect.objectContaining({
        appointmentId: 'appt-1',
        parentId: 'parent-1',
        patientId: 'patient-1',
        organisationId: 'org-1',
        paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
        items: [
          {
            name: 'Billing handoff',
            description: 'Ready',
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ],
      })
    );
    expect(postData).toHaveBeenNthCalledWith(
      3,
      '/v1/finance/appointments/appt-1/ready-for-billing',
      {
        organisationId: 'org-1',
        parentId: 'parent-1',
        patientId: 'patient-1',
        visitId: 'enc-1',
        notes: 'Ready',
      }
    );
  });

  it('falls back to appointment ready-for-billing route when finance route is not deployed', async () => {
    (postData as jest.Mock).mockRejectedValueOnce({
      response: { status: 404, data: { message: 'Finance route not found' } },
    });
    (patchData as jest.Mock).mockResolvedValueOnce({
      data: {
        data: { appointmentId: 'appt-1', billingState: 'READY_FOR_BILLING' },
        meta: null,
        error: null,
      },
    });

    await markAppointmentReadyForBilling('appt-1', {
      organisationId: 'org-1',
      visitId: 'enc-1',
      notes: 'Ready',
    });

    expect(patchData).toHaveBeenCalledWith(
      '/fhir/v1/appointment/pms/org-1/appt-1/ready-for-billing',
      {
        organisationId: 'org-1',
        visitId: 'enc-1',
        notes: 'Ready',
      }
    );
  });

  it('falls back to appointment ready-for-billing route when finance retry is still 404', async () => {
    (postData as jest.Mock)
      .mockRejectedValueOnce({
        response: { status: 404, data: { message: 'Invoice not found' } },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'inv-1',
            appointmentId: 'appt-1',
            organisationId: 'org-1',
            items: [],
            totalAmount: 0,
          },
          meta: null,
          error: null,
        },
      })
      .mockRejectedValueOnce({
        response: { status: 404, data: { message: 'Finance route not found' } },
      });
    (patchData as jest.Mock).mockResolvedValueOnce({
      data: {
        data: { appointmentId: 'appt-1', billingState: 'READY_FOR_BILLING' },
        meta: null,
        error: null,
      },
    });

    await markAppointmentReadyForBilling('appt-1', {
      organisationId: 'org-1',
      parentId: 'parent-1',
      patientId: 'patient-1',
      visitId: 'enc-1',
      notes: 'Ready',
    });

    expect(patchData).toHaveBeenCalledWith(
      '/fhir/v1/appointment/pms/org-1/appt-1/ready-for-billing',
      {
        organisationId: 'org-1',
        parentId: 'parent-1',
        patientId: 'patient-1',
        visitId: 'enc-1',
        notes: 'Ready',
      }
    );
  });

  it('extracts appointmentId from account reference with query string (normalizeReferenceTail)', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-q',
          resourceType: 'Invoice',
          account: {
            reference: 'https://api.example.com/fhir/v1/Appointment/appt-q-1?foo=bar',
          },
        },
      ],
    });

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith(
      'org-1',
      expect.arrayContaining([expect.objectContaining({ appointmentId: 'appt-q-1' })])
    );
  });

  it('extracts appointmentId from account reference with hash fragment (normalizeReferenceTail)', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-h',
          resourceType: 'Invoice',
          account: {
            reference: 'https://api.example.com/fhir/v1/Appointment/appt-h-1#section',
          },
        },
      ],
    });

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith(
      'org-1',
      expect.arrayContaining([expect.objectContaining({ appointmentId: 'appt-h-1' })])
    );
  });

  it('restores appointmentId from extension URL when present', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'inv-ext',
          resourceType: 'Invoice',
          extension: [
            {
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id',
              valueString: 'appt-ext-1',
            },
          ],
        },
      ],
    });

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith(
      'org-1',
      expect.arrayContaining([expect.objectContaining({ appointmentId: 'appt-ext-1' })])
    );
  });

  it('maps a plain finance invoice envelope into workspace line items', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'ed0f6c19',
            appointmentId: 'appt-1',
            organisationId: 'org-1',
            items: [
              { name: 'bookable procedure', total: 10, quantity: 1, unitPrice: 10 },
              { name: 'IDEXX test 3196', total: 195.65, quantity: 1, unitPrice: 195.65 },
            ],
            subtotal: 205.65,
            totalAmount: 205.65,
            currency: 'usd',
            status: 'AWAITING_PAYMENT',
            createdAt: '2026-06-20T19:18:22.990Z',
          },
        ],
        meta: null,
        error: null,
      },
    });

    const billing = await loadAppointmentBilling('org-1', 'appt-1');

    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/invoices',
      expect.objectContaining({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        _cacheBust: expect.any(Number),
      })
    );
    expect(billing.pastInvoices).toHaveLength(1);
    expect(billing.pastInvoices[0].items.map((item) => item.name)).toEqual([
      'bookable procedure',
      'IDEXX test 3196',
    ]);
    expect(billing.pastInvoices[0].items[1].amountCents).toBe(19565);
    expect(billing.pastInvoices[0].totalCents).toBe(20565);
  });
});
