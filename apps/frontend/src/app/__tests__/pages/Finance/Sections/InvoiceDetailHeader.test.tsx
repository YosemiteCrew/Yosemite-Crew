import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceDetailHeader from '@/app/features/finance/pages/Finance/Sections/InvoiceDetailHeader';
import { Appointment, Invoice } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="avatar">{alt}</span>,
}));

jest.mock('react-icons/io5', () => ({
  IoDownloadOutline: () => <span data-testid="download-icon" />,
  IoOpenOutline: () => <span data-testid="open-icon" />,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => '12 Jun 2026',
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => '/avatar.png',
}));

jest.mock('@/app/lib/appointments', () => ({
  getAppointmentCompanion: () => ({ name: 'Poppy', species: 'dog', parent: { name: 'Lena' } }),
  getAppointmentCompanionPhotoUrl: () => '',
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: () => 'Lena Hartmann / Poppy',
}));

const statusStyle = { color: 'green' } as React.CSSProperties;

const appointment = {
  id: 'appt-1',
  appointmentDate: new Date(),
  appointmentType: { name: 'rabies booster' },
} as Appointment;

const makeInvoice = (overrides: Partial<Invoice>): Invoice =>
  ({ id: 'inv-1', items: [], metadata: { invoiceNumber: '2038' }, ...overrides }) as Invoice;

describe('InvoiceDetailHeader', () => {
  it('renders the invoice number, status badge and context subtitle', () => {
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({})}
        appointment={appointment}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '#2038' })).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(
      screen.getByText('Lena Hartmann / Poppy · rabies booster · 12 Jun 2026')
    ).toBeInTheDocument();
  });

  it('renders a PDF download link when a pdf url exists', () => {
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({ pdfUrl: 'https://cdn.test/inv.pdf' })}
        appointment={appointment}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('link', { name: /Download invoice #2038 PDF/ })).toHaveAttribute(
      'href',
      'https://cdn.test/inv.pdf'
    );
  });

  it('renders an Open appointment action and invokes the handler when clicked', () => {
    const onOpenAppointment = jest.fn();
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({})}
        appointment={appointment}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
        onOpenAppointment={onOpenAppointment}
      />
    );

    const openButton = screen.getByRole('button', { name: /Open appointment/ });
    fireEvent.click(openButton);
    expect(onOpenAppointment).toHaveBeenCalledTimes(1);
  });

  it('omits the Open appointment action when there is no appointment', () => {
    const onOpenAppointment = jest.fn();
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({})}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
        onOpenAppointment={onOpenAppointment}
      />
    );

    expect(screen.queryByRole('button', { name: /Open appointment/ })).not.toBeInTheDocument();
  });

  it('omits the PDF link and subtitle when there is no pdf url or appointment', () => {
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({})}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/rabies booster/)).not.toBeInTheDocument();
  });

  it('falls back to a generic title and hides the badge when data is missing', () => {
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={{ id: '', items: [], metadata: {} } as unknown as Invoice}
        statusLabel=""
        statusStyle={statusStyle}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Invoice' })).toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({})}
        appointment={appointment}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <InvoiceDetailHeader
        titleId="title"
        invoice={makeInvoice({ pdfUrl: 'https://cdn.test/inv.pdf' })}
        appointment={appointment}
        statusLabel="Paid"
        statusStyle={statusStyle}
        onClose={jest.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
