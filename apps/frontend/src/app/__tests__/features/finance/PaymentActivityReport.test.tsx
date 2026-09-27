import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentActivityReportPage from '@/app/features/finance/pages/PaymentActivityReport';
import {
  downloadPaymentActivityReport,
  fetchPaymentActivityReport,
} from '@/app/features/finance/services/paymentActivityReportService';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <p>Not available</p>,
}));
jest.mock('@/app/ui/layout/PageSkeleton', () => ({
  __esModule: true,
  default: () => <p>Loading page</p>,
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string | null }) => unknown) =>
    selector({ primaryOrgId: mockOrgId() }),
}));
jest.mock('@/app/lib/money', () => ({
  formatMoneyPrecise: (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`,
}));
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({
    text,
    type = 'button',
    isDisabled,
    ariaLabel,
  }: {
    text: string;
    type?: 'button' | 'submit';
    isDisabled?: boolean;
    ariaLabel?: string;
  }) => (
    <button type={type} disabled={isDisabled} aria-label={ariaLabel}>
      {text}
    </button>
  ),
  Secondary: ({
    href,
    text,
    type = 'button',
    isDisabled,
    ariaLabel,
    onClick,
  }: {
    href?: string;
    text: string;
    type?: 'button' | 'submit';
    isDisabled?: boolean;
    ariaLabel?: string;
    onClick?: () => void;
  }) =>
    href ? (
      <a href={href} aria-label={ariaLabel}>
        {text}
      </a>
    ) : (
      <button type={type} disabled={isDisabled} aria-label={ariaLabel} onClick={onClick}>
        {text}
      </button>
    ),
}));
jest.mock('@/app/features/finance/services/paymentActivityReportService', () => ({
  downloadPaymentActivityReport: jest.fn(),
  fetchPaymentActivityReport: jest.fn(),
}));

const mockFetch = fetchPaymentActivityReport as jest.Mock;
const mockDownload = downloadPaymentActivityReport as jest.Mock;
const mockOrgId = jest.fn((): string | null => 'org-1');
const report = {
  rows: [
    {
      id: 'pay-1',
      date: '2026-09-27T10:00:00.000Z',
      type: 'Payment',
      status: 'SUCCEEDED',
      provider: 'STRIPE',
      currency: 'USD',
      amount: 25,
      invoiceId: 'inv-1',
    },
    {
      id: 'refund-1',
      date: '2026-09-27T11:00:00.000Z',
      type: 'Refund',
      status: 'PENDING',
      provider: 'MANUAL',
      currency: 'USD',
      amount: 5,
      invoiceId: 'inv-1',
    },
    {
      id: 'future-1',
      date: '2026-09-27T12:00:00.000Z',
      type: 'Payment',
      status: 'NEW_STATUS',
      provider: 'NEW_PROVIDER',
      currency: 'USD',
      amount: 1,
      invoiceId: 'inv-1',
    },
  ],
  totals: [{ currency: 'USD', payments: 25, refunds: 0, net: 25 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgId.mockReturnValue('org-1');
  mockFetch.mockResolvedValue(report);
  mockDownload.mockResolvedValue(new Blob(['report']));
});

describe('PaymentActivityReportPage', () => {
  it('loads and renders report totals, friendly labels, and activity', async () => {
    render(<PaymentActivityReportPage />);

    expect(
      await screen.findByRole('heading', { name: 'Payments and refunds' })
    ).toBeInTheDocument();
    await screen.findByText('Completed');
    expect(screen.getAllByText('USD 25.00')).toHaveLength(3);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      'org-1',
      expect.stringContaining('T00:00:00.000Z'),
      expect.stringContaining('T23:59:59.999Z')
    );
  });

  it('validates the selected date range before requesting another report', async () => {
    render(<PaymentActivityReportPage />);
    await screen.findByRole('heading', { name: 'Payments and refunds' });
    const from = screen.getByLabelText('From date');
    const to = screen.getByLabelText('To date');
    fireEvent.change(from, { target: { value: '2026-09-28' } });
    fireEvent.change(to, { target: { value: '2026-09-01' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run report' })));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid date range.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly error when the report request fails', async () => {
    mockFetch.mockRejectedValue(new Error('private backend detail'));
    render(<PaymentActivityReportPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The report could not be loaded. Try again.'
    );
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
  });

  it('does not request or expose report data when no organisation is selected', () => {
    mockOrgId.mockReturnValue(null);
    render(<PaymentActivityReportPage />);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the empty state when no activity is returned', async () => {
    mockFetch.mockResolvedValue({ rows: [], totals: [] });
    render(<PaymentActivityReportPage />);

    expect(
      await screen.findByText('No payments or refunds were recorded in this period.')
    ).toBeInTheDocument();
  });

  it('downloads the selected CSV and reports a safe error if export fails', async () => {
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    const createObjectURL = jest.spyOn(URL, 'createObjectURL');
    const revokeObjectURL = jest.spyOn(URL, 'revokeObjectURL');
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<PaymentActivityReportPage />);
    await screen.findByRole('heading', { name: 'Payments and refunds' });
    await screen.findByText('Completed');

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Download CSV report' }))
    );
    expect(mockDownload).toHaveBeenCalledWith(
      'org-1',
      expect.any(String),
      expect.any(String),
      'csv'
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');

    mockDownload.mockRejectedValueOnce(new Error('private export detail'));
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Download PDF report' }))
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The report could not be loaded. Try again.'
      )
    );

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
    click.mockRestore();
  });
});
