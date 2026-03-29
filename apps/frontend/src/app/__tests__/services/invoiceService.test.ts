import {
  addLineItemsToAppointments,
  getPaymentLink,
  loadInvoicesForAppointment,
  loadInvoicesForOrgPrimaryOrg,
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
    await markInvoicePaid('inv-1');

    expect(postData).toHaveBeenCalledWith('/fhir/v1/invoice/inv-1/mark-paid', {});
  });

  it('updates payment collection method before offline settlement', async () => {
    await updateInvoicePaymentCollectionMethod('inv-1', 'PAYMENT_AT_CLINIC');

    expect(patchData).toHaveBeenCalledWith('/fhir/v1/invoice/inv-1/payment-collection-method', {
      paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    });
  });

  it('loads without startLoading when silent option is enabled', async () => {
    await loadInvoicesForOrgPrimaryOrg({ silent: true });
    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalled();
  });

  it('loads invoices for appointment and upserts them', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: [
        { id: 'inv-1', resourceType: 'Invoice', organisationId: 'org-1', appointmentId: 'apt-1' },
      ],
    });

    await loadInvoicesForAppointment('apt-1');

    expect(postData).toHaveBeenCalledWith('/fhir/v1/invoice/appointment/apt-1', {});
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
    await addLineItemsToAppointments([{ id: 'li-1' } as any], 'appt-1', 'USD');
    expect(postData).toHaveBeenCalledWith(
      '/fhir/v1/invoice/appointment/appt-1/charges',
      expect.objectContaining({ currency: 'usd' })
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
      data: { checkout: { url: 'https://stripe.test' } },
    });
    const result = await getPaymentLink('inv-1');
    expect(postData).toHaveBeenCalledWith('/fhir/v1/invoice/inv-1/checkout-session');
    expect(result).toBe('https://stripe.test');
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
});
