import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoicePaymentActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions';

const getPaymentLinkMock = jest.fn();
const loadInvoicesForOrgPrimaryOrgMock = jest.fn();
const markInvoicePaidMock = jest.fn();
const loadAppointmentsForPrimaryOrgMock = jest.fn();
const notifyMock = jest.fn();
const canAnyMock = jest.fn();
const clipboardWriteMock = jest.fn();

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  getPaymentLink: (...args: any[]) => getPaymentLinkMock(...args),
  loadInvoicesForOrgPrimaryOrg: (...args: any[]) => loadInvoicesForOrgPrimaryOrgMock(...args),
  markInvoicePaid: (...args: any[]) => markInvoicePaidMock(...args),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  loadAppointmentsForPrimaryOrg: (...args: any[]) => loadAppointmentsForPrimaryOrgMock(...args),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: (...args: any[]) => ({ canAny: (perms: any) => canAnyMock(perms, ...args) }),
}));

const flushMicrotasks = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('InvoicePaymentActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPaymentLinkMock.mockResolvedValue('https://stripe.test');
    loadInvoicesForOrgPrimaryOrgMock.mockResolvedValue(undefined);
    markInvoicePaidMock.mockResolvedValue(undefined);
    loadAppointmentsForPrimaryOrgMock.mockResolvedValue(undefined);
    clipboardWriteMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteMock },
      configurable: true,
    });
    jest.spyOn(window, 'open').mockImplementation(() => null);
    // Default: actor has billing edit permission.
    canAnyMock.mockReturnValue(true);
  });

  afterEach(() => {
    (window.open as jest.Mock).mockRestore();
  });

  it('shows a confirmation state after setting payment collection method', async () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));

    await waitFor(() =>
      expect(
        screen.getByText('Confirm cash payment before marking this invoice as paid.')
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Collect cash')).toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith('warning', {
      title: 'Confirm cash collection',
      text: 'Record cash only after you have physically received the payment from the client.',
    });
    expect(notifyMock).toHaveBeenCalledWith('info', {
      title: 'Cash collection ready',
      text: 'Click Collect cash after receiving payment. The payment will be recorded through finance.',
    });
    expect(screen.queryByText('Generate & Mail link')).not.toBeInTheDocument();
  });

  it('marks invoice paid when collect cash is clicked after cash setup', async () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));

    await waitFor(() => expect(screen.getByText('Collect cash')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Collect cash'));

    await waitFor(() => expect(markInvoicePaidMock).toHaveBeenCalledWith('inv-1'));

    expect(markInvoicePaidMock).toHaveBeenCalledWith('inv-1');
    expect(loadInvoicesForOrgPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true });
    expect(loadAppointmentsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true });
    expect(notifyMock).toHaveBeenCalledWith('success', {
      title: 'Cash payment recorded',
      text: 'The invoice was marked paid after confirming in-person cash collection.',
    });
  });

  it('dismisses cash confirmation when close icon is clicked', async () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));
    await waitFor(() => expect(screen.getByText('Collect cash')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Dismiss cash confirmation'));
    expect(screen.queryByText('Collect cash')).not.toBeInTheDocument();
    expect(screen.getByText('Pay in cash')).toBeInTheDocument();
  });

  it('hides payment link actions for invoices already set to payment at clinic', () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        paymentCollectionMethod="PAYMENT_AT_CLINIC"
        activeAppointment={{} as any}
      />
    );

    expect(screen.getByText('Collect cash')).toBeInTheDocument();
    expect(screen.queryByText('Generate & Mail link')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay in cash')).not.toBeInTheDocument();
  });

  it('keeps link and cash actions enabled when invoice is pending even if appointment payment is marked paid', () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{ paymentStatus: 'PAID' } as any}
      />
    );

    expect(screen.getByText('Pay in cash')).toBeInTheDocument();
    expect(screen.getByText('Generate & Mail link')).toBeInTheDocument();
  });

  it('renders no payment mutation actions for a billing viewer without edit permission', () => {
    canAnyMock.mockReturnValue(false);

    const { container } = render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{ organisationId: 'org-1' } as any}
      />
    );

    expect(canAnyMock).toHaveBeenCalledWith(['billing:edit:any'], 'org-1');
    expect(screen.queryByText('Pay in cash')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate & Mail link')).not.toBeInTheDocument();
    expect(screen.queryByText('Collect cash')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('still lets a billing viewer download a paid receipt', () => {
    canAnyMock.mockReturnValue(false);

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PAID"
        stripeReceiptUrl="https://stripe.test/receipt"
        activeAppointment={{ organisationId: 'org-1' } as any}
      />
    );

    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('generates a payment link and reveals the copy action', async () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Generate & Mail link'));

    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument());
    expect(getPaymentLinkMock).toHaveBeenCalledWith('inv-1');
  });

  it('copies the generated link to the clipboard', async () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Generate & Mail link'));
    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Copy link'));
    await waitFor(() => expect(clipboardWriteMock).toHaveBeenCalledWith('https://stripe.test'));
  });

  it('stays silent and keeps the copy action hidden when link generation fails', async () => {
    getPaymentLinkMock.mockRejectedValue(new Error('network'));

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Generate & Mail link'));
    await flushMicrotasks();

    expect(getPaymentLinkMock).toHaveBeenCalledWith('inv-1');
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });

  it('ignores a non-string payment link response', async () => {
    getPaymentLinkMock.mockResolvedValue(undefined);

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Generate & Mail link'));
    await flushMicrotasks();

    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });

  it('logs and recovers when copying the link fails', async () => {
    clipboardWriteMock.mockRejectedValue(new Error('denied'));

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="AWAITING_PAYMENT"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Generate & Mail link'));
    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Copy link'));
    await flushMicrotasks();

    expect(clipboardWriteMock).toHaveBeenCalledWith('https://stripe.test');
    // The component swallows the rejection, so the Copy link action stays available.
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('opens the receipt in a new tab when download is clicked', () => {
    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PAID"
        stripeReceiptUrl="https://stripe.test/receipt"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Download'));

    expect(window.open).toHaveBeenCalledWith(
      'https://stripe.test/receipt',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('notifies when recording the cash payment fails', async () => {
    markInvoicePaidMock.mockRejectedValue(new Error('server'));

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));
    await waitFor(() => expect(screen.getByText('Collect cash')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Collect cash'));
    await flushMicrotasks();

    expect(markInvoicePaidMock).toHaveBeenCalledWith('inv-1');
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Cash payment failed',
      text: 'We could not record the cash collection. Please try again.',
    });
  });

  it('notifies when preparing the cash collection fails', async () => {
    notifyMock.mockImplementationOnce(() => {
      throw new Error('notify boom');
    });

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));
    await flushMicrotasks();

    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Cash setup failed',
      text: 'We could not set the invoice to in-person cash collection. Please try again.',
    });
  });

  it('shows a saving state while the cash payment is recording', async () => {
    // A pending (never-resolving) mutation keeps the component in its saving state.
    markInvoicePaidMock.mockReturnValue(new Promise(() => {}));

    render(
      <InvoicePaymentActions
        invoiceId="inv-1"
        invoiceStatus="PENDING"
        activeAppointment={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Pay in cash'));
    await waitFor(() => expect(screen.getByText('Collect cash')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Collect cash'));
    });

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('renders the pending actions when invoice status and collection method are omitted', () => {
    render(<InvoicePaymentActions invoiceId="inv-1" activeAppointment={{} as any} />);

    expect(screen.getByText('Pay in cash')).toBeInTheDocument();
    expect(screen.getByText('Generate & Mail link')).toBeInTheDocument();
  });

  it('renders no payment actions for a settled invoice without a receipt', () => {
    render(
      <InvoicePaymentActions invoiceId="inv-1" invoiceStatus="PAID" activeAppointment={{} as any} />
    );

    expect(screen.queryByText('Pay in cash')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate & Mail link')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
    expect(screen.queryByText('Collect cash')).not.toBeInTheDocument();
  });
});
