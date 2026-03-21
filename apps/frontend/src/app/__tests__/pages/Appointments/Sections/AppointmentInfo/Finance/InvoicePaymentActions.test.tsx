import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvoicePaymentActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions';

const getPaymentLinkMock = jest.fn();
const loadInvoicesForOrgPrimaryOrgMock = jest.fn();
const markInvoicePaidMock = jest.fn();
const updateInvoicePaymentCollectionMethodMock = jest.fn();
const loadAppointmentsForPrimaryOrgMock = jest.fn();
const notifyMock = jest.fn();

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  getPaymentLink: (...args: any[]) => getPaymentLinkMock(...args),
  loadInvoicesForOrgPrimaryOrg: (...args: any[]) => loadInvoicesForOrgPrimaryOrgMock(...args),
  markInvoicePaid: (...args: any[]) => markInvoicePaidMock(...args),
  updateInvoicePaymentCollectionMethod: (...args: any[]) =>
    updateInvoicePaymentCollectionMethodMock(...args),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  loadAppointmentsForPrimaryOrg: (...args: any[]) => loadAppointmentsForPrimaryOrgMock(...args),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

describe('InvoicePaymentActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPaymentLinkMock.mockResolvedValue('https://stripe.test');
    loadInvoicesForOrgPrimaryOrgMock.mockResolvedValue(undefined);
    markInvoicePaidMock.mockResolvedValue(undefined);
    updateInvoicePaymentCollectionMethodMock.mockResolvedValue(undefined);
    loadAppointmentsForPrimaryOrgMock.mockResolvedValue(undefined);
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
      expect(updateInvoicePaymentCollectionMethodMock).toHaveBeenCalledWith(
        'inv-1',
        'PAYMENT_AT_CLINIC'
      )
    );

    await waitFor(() =>
      expect(
        screen.getByText('Confirm cash payment before marking this invoice as paid.')
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Collect cash')).toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith('warning', {
      title: 'Confirm cash collection',
      text: 'Record cash only after you have physically received the payment at the clinic.',
    });
    expect(notifyMock).toHaveBeenCalledWith('info', {
      title: 'Cash collection ready',
      text: 'Payment collection method is set to cash at clinic. Click Collect cash after receiving payment.',
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

    await waitFor(() =>
      expect(updateInvoicePaymentCollectionMethodMock).toHaveBeenCalledWith(
        'inv-1',
        'PAYMENT_AT_CLINIC'
      )
    );

    await waitFor(() => expect(screen.getByText('Collect cash')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Collect cash'));

    await waitFor(() => expect(markInvoicePaidMock).toHaveBeenCalledWith('inv-1'));

    expect(markInvoicePaidMock).toHaveBeenCalledWith('inv-1');
    expect(loadInvoicesForOrgPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true });
    expect(loadAppointmentsForPrimaryOrgMock).toHaveBeenCalledWith({ force: true, silent: true });
    expect(notifyMock).toHaveBeenCalledWith('success', {
      title: 'Cash payment recorded',
      text: 'The invoice was marked paid after confirming cash collection at the clinic.',
    });
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
});
