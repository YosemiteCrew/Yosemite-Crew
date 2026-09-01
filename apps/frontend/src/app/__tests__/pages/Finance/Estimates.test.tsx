import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// Renders children so the page gate, the "New estimate" gate and the detail's
// action gate are all exercised; PermissionGate has its own tests.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ href, text, ariaLabel, onClick, isDisabled }: any) =>
    href ? (
      <a href={href} aria-label={ariaLabel}>
        {text}
      </a>
    ) : (
      <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children, ariaLabel }: any) =>
    showModal ? (
      <div role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

const mockOrgState = { primaryOrgId: 'org-1' as string | null };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(mockOrgState),
}));

const mockCompanionState: {
  companionsById: Record<string, { id: string; name: string }>;
  companionsIdsByOrgId: Record<string, string[]>;
} = { companionsById: {}, companionsIdsByOrgId: {} };
jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (selector: any) => selector(mockCompanionState),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

const mockLoadCompanions = jest.fn();
jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: (...args: unknown[]) => mockLoadCompanions(...args),
}));

const mockLoadInvoices = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/features/billing/services/invoiceService', () => ({
  loadInvoicesForOrgPrimaryOrg: (...args: unknown[]) => mockLoadInvoices(...args),
}));

// Mock the transport, not the hook, so the page's real load/merge/error paths run.
const mockEstimateService = {
  listEstimates: jest.fn(),
  createEstimate: jest.fn(),
  markEstimateSent: jest.fn(),
  approveEstimate: jest.fn(),
  declineEstimate: jest.fn(),
  convertEstimate: jest.fn(),
};
jest.mock('@/app/features/finance/services/estimateService', () => ({
  listEstimates: (...args: unknown[]) => mockEstimateService.listEstimates(...args),
  createEstimate: (...args: unknown[]) => mockEstimateService.createEstimate(...args),
  markEstimateSent: (...args: unknown[]) => mockEstimateService.markEstimateSent(...args),
  approveEstimate: (...args: unknown[]) => mockEstimateService.approveEstimate(...args),
  declineEstimate: (...args: unknown[]) => mockEstimateService.declineEstimate(...args),
  convertEstimate: (...args: unknown[]) => mockEstimateService.convertEstimate(...args),
  getEstimateErrorMessage: (error: unknown, fallback: string) => {
    const body = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return fallback;
  },
}));

import ProtectedEstimates from '@/app/features/finance/pages/Estimates';

const buildEstimate = (overrides: Partial<Estimate> = {}): Estimate => ({
  id: 'est-1',
  organisationId: 'org-1',
  patientId: 'c1',
  encounterId: null,
  status: 'DRAFT',
  validUntil: '2026-12-31T00:00:00.000Z',
  subtotal: 100,
  taxAmount: 10,
  total: 110,
  currency: 'USD',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  items: [
    {
      id: 'item-1',
      description: 'Dental clean',
      quantity: 2,
      unitPrice: 50,
      taxRate: 10,
      lineTotal: 100,
      notes: null,
    },
  ],
  ...overrides,
});

const rowFor = (name: string) =>
  screen.getByRole('button', { name: `Open the estimate for ${name}` });
const detailHeading = (name: string) => screen.queryByRole('heading', { level: 2, name });
const filterPill = (label: string) => screen.getByRole('button', { name: label });

beforeEach(() => {
  jest.clearAllMocks();
  mockOrgState.primaryOrgId = 'org-1';
  mockCompanionState.companionsById = {
    c1: { id: 'c1', name: 'Bruno' },
    c2: { id: 'c2', name: '' },
  };
  mockCompanionState.companionsIdsByOrgId = { 'org-1': ['c1', 'c2'] };
  mockLoadCompanions.mockResolvedValue(undefined);
  mockEstimateService.listEstimates.mockResolvedValue([buildEstimate()]);
});

describe('Finance > Estimates page', () => {
  it('shows the "nothing yet" empty state under the all filter', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([]);

    render(<ProtectedEstimates />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Estimates' })).toBeInTheDocument();
    expect(await screen.findByText('No estimates yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create an estimate to quote a treatment plan before it is invoiced.')
    ).toBeInTheDocument();
    expect(mockEstimateService.listEstimates).toHaveBeenCalledWith('org-1', undefined);
  });

  it('words the empty state differently under a status filter', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([]);

    render(<ProtectedEstimates />);
    await screen.findByText('No estimates yet');

    await userEvent.click(filterPill('Sent'));

    expect(await screen.findByText('No estimate currently has this status.')).toBeInTheDocument();
    expect(
      screen.queryByText('Create an estimate to quote a treatment plan before it is invoiced.')
    ).not.toBeInTheDocument();
    expect(mockEstimateService.listEstimates).toHaveBeenLastCalledWith('org-1', { status: 'SENT' });
  });

  it('shows the skeleton while the list is in flight', async () => {
    let resolveList!: (rows: Estimate[]) => void;
    mockEstimateService.listEstimates.mockReturnValue(
      new Promise<Estimate[]>((resolve) => {
        resolveList = resolve;
      })
    );

    const { container } = render(<ProtectedEstimates />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    await act(async () => {
      resolveList([]);
    });

    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getByText('No estimates yet')).toBeInTheDocument();
  });

  it('surfaces a load failure and retries it', async () => {
    mockEstimateService.listEstimates
      .mockRejectedValueOnce(new Error('Unable to load estimates.'))
      .mockResolvedValueOnce([buildEstimate()]);

    render(<ProtectedEstimates />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load estimates.');

    await userEvent.click(screen.getByRole('button', { name: 'Retry loading estimates' }));

    expect(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockEstimateService.listEstimates).toHaveBeenCalledTimes(2);
  });

  it('renders a row and opens its detail on click', async () => {
    render(<ProtectedEstimates />);

    const row = await screen.findByRole('button', { name: 'Open the estimate for Bruno' });
    expect(screen.getByText('$110.00')).toBeInTheDocument();
    expect(detailHeading('Bruno')).not.toBeInTheDocument();

    await userEvent.click(row);

    expect(detailHeading('Bruno')).toBeInTheDocument();
    // The detail's totals list, which only the open estimate renders.
    expect(document.querySelector('dl[aria-label="Estimate totals"]')).toBeInTheDocument();
    expect(screen.getByText('Dental clean')).toBeInTheDocument();
  });

  it('runs a lifecycle action, merges the result and confirms it', async () => {
    mockEstimateService.markEstimateSent.mockResolvedValue(buildEstimate({ status: 'SENT' }));

    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mark this estimate as sent' }));

    await waitFor(() =>
      expect(mockEstimateService.markEstimateSent).toHaveBeenCalledWith('org-1', 'est-1')
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Estimate sent' })
    );
    // The merged row is a SENT estimate, so sending is no longer offered.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Mark this estimate as sent' })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Approve this estimate' })).toBeInTheDocument();
  });

  it('declines an estimate through the decline endpoint', async () => {
    mockEstimateService.declineEstimate.mockResolvedValue(buildEstimate({ status: 'DECLINED' }));

    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Decline this estimate' }));

    await waitFor(() =>
      expect(mockEstimateService.declineEstimate).toHaveBeenCalledWith('org-1', 'est-1')
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Estimate declined' })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Decline this estimate' })
      ).not.toBeInTheDocument()
    );
  });

  it('reports a failed action without dropping the row', async () => {
    mockEstimateService.approveEstimate.mockRejectedValue({
      response: { data: { error: 'This estimate cannot be approved.' } },
    });

    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Approve this estimate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This estimate cannot be approved.');
    expect(mockNotify).toHaveBeenCalledWith('error', {
      title: 'Estimate not updated',
      text: 'This estimate cannot be approved.',
    });
    expect(rowFor('Bruno')).toBeInTheDocument();
    expect(detailHeading('Bruno')).toBeInTheDocument();
  });

  it('creates an estimate and selects the new row', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([]);
    mockEstimateService.createEstimate.mockResolvedValue(
      buildEstimate({ id: 'est-2', patientId: 'c2' })
    );

    render(<ProtectedEstimates />);
    await screen.findByText('No estimates yet');

    await userEvent.click(screen.getByRole('button', { name: 'Create a new estimate' }));

    const dialog = screen.getByRole('dialog', { name: 'Create an estimate' });
    // A companion with no stored name is still selectable, under a placeholder.
    expect(within(dialog).getByRole('option', { name: 'Unnamed companion' })).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText('Companion'), 'c2');
    await userEvent.type(within(dialog).getByLabelText('Line 1 description'), 'Dental clean');
    await userEvent.clear(within(dialog).getByLabelText('Line 1 unit price'));
    await userEvent.type(within(dialog).getByLabelText('Line 1 unit price'), '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create this estimate' }));

    await waitFor(() =>
      expect(mockEstimateService.createEstimate).toHaveBeenCalledWith('org-1', {
        patientId: 'c2',
        currency: 'USD',
        notes: undefined,
        validUntil: undefined,
        items: [{ description: 'Dental clean', quantity: 1, unitPrice: 50, taxRate: 0 }],
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Estimate created' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The created estimate is selected, so its detail is already open.
    expect(detailHeading('Unknown companion')).toBeInTheDocument();
  });

  it('keeps the create dialog open and shows the reason when creating fails', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([]);
    mockEstimateService.createEstimate.mockRejectedValue({
      response: { data: { error: 'items: Required' } },
    });

    render(<ProtectedEstimates />);
    await screen.findByText('No estimates yet');

    await userEvent.click(screen.getByRole('button', { name: 'Create a new estimate' }));
    const dialog = screen.getByRole('dialog', { name: 'Create an estimate' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Companion'), 'c1');
    await userEvent.type(within(dialog).getByLabelText('Line 1 description'), 'Dental clean');
    await userEvent.type(within(dialog).getByLabelText('Line 1 unit price'), '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create this estimate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('items: Required');
    expect(screen.getByRole('dialog', { name: 'Create an estimate' })).toBeInTheDocument();
  });

  it('drops a converted estimate out of the filtered list and closes its detail', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([buildEstimate({ status: 'APPROVED' })]);
    mockEstimateService.convertEstimate.mockResolvedValue(
      buildEstimate({ status: 'CONVERTED', convertedToInvoiceId: 'inv-1' })
    );

    render(<ProtectedEstimates />);
    await screen.findByRole('button', { name: 'Open the estimate for Bruno' });

    await userEvent.click(filterPill('Approved'));
    await waitFor(() =>
      expect(mockEstimateService.listEstimates).toHaveBeenLastCalledWith('org-1', {
        status: 'APPROVED',
      })
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );
    expect(detailHeading('Bruno')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Convert this estimate to an invoice' })
    );

    await waitFor(() =>
      expect(mockEstimateService.convertEstimate).toHaveBeenCalledWith('org-1', 'est-1')
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Invoice created' })
    );
    // The estimate no longer matches the APPROVED pill, so it leaves the list
    // and the detail panel must not keep showing the stale row.
    await waitFor(() => expect(screen.getByText('No estimates yet')).toBeInTheDocument());
    expect(screen.getByText('No estimate currently has this status.')).toBeInTheDocument();
    expect(detailHeading('Bruno')).not.toBeInTheDocument();
    expect(mockEstimateService.listEstimates).toHaveBeenCalledTimes(2);

    // Converting mints an Invoice. The invoice store already holds an entry for
    // this organisation, so useLoadInvoicesForPrimaryOrg would skip loading and
    // the "View the invoice" link would point at a row the store has never
    // seen. Only a forced refetch fixes that.
    await waitFor(() =>
      expect(mockLoadInvoices).toHaveBeenCalledWith({ force: true, silent: true })
    );
  });

  it('still reports success when the post-convert invoice refetch fails', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([buildEstimate({ status: 'APPROVED' })]);
    mockEstimateService.convertEstimate.mockResolvedValue(
      buildEstimate({ status: 'CONVERTED', convertedToInvoiceId: 'inv-1' })
    );
    mockLoadInvoices.mockRejectedValueOnce(new Error('network down'));
    // The page logs the refetch failure; the shared setup turns console.error
    // into a thrown assertion, so it is silenced for this one case.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Convert this estimate to an invoice' })
    );

    // The conversion itself succeeded, so the user is told so - a failed
    // background refresh must not be reported as a failed conversion.
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Invoice created' })
      )
    );
    await waitFor(() => expect(logged).toHaveBeenCalled());
    logged.mockRestore();
  });

  it('does not refetch invoices for a non-converting action', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([buildEstimate({ status: 'DRAFT' })]);
    mockEstimateService.approveEstimate.mockResolvedValue(buildEstimate({ status: 'APPROVED' }));

    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve this estimate' }));

    await waitFor(() =>
      expect(mockEstimateService.approveEstimate).toHaveBeenCalledWith('org-1', 'est-1')
    );
    expect(mockLoadInvoices).not.toHaveBeenCalled();
  });

  it('closes the detail when the status filter changes', async () => {
    render(<ProtectedEstimates />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open the estimate for Bruno' })
    );
    expect(detailHeading('Bruno')).toBeInTheDocument();

    await userEvent.click(filterPill('Draft'));

    await waitFor(() => expect(detailHeading('Bruno')).not.toBeInTheDocument());
  });

  it('loads companions when the organisation has none cached, and logs a failure', async () => {
    mockCompanionState.companionsById = {};
    mockCompanionState.companionsIdsByOrgId = {};
    mockLoadCompanions.mockRejectedValue(new Error('companions unavailable'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedEstimates />);

    await waitFor(() => expect(mockLoadCompanions).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load companions for the estimates page:',
        expect.any(Error)
      )
    );
    expect(
      await screen.findByRole('button', { name: 'Open the estimate for Unknown companion' })
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('does not reload companions that are already cached', async () => {
    render(<ProtectedEstimates />);

    await screen.findByRole('button', { name: 'Open the estimate for Bruno' });
    expect(mockLoadCompanions).not.toHaveBeenCalled();
  });

  it('queries nothing without a primary organisation and links back to invoices', async () => {
    mockOrgState.primaryOrgId = null;

    render(<ProtectedEstimates />);

    expect(await screen.findByText('No estimates yet')).toBeInTheDocument();
    expect(mockEstimateService.listEstimates).not.toHaveBeenCalled();
    expect(mockLoadCompanions).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
  });
});

describe('Finance > Estimates status filters', () => {
  it('asks the API for each status the pills offer', async () => {
    mockEstimateService.listEstimates.mockResolvedValue([]);
    render(<ProtectedEstimates />);
    await screen.findByText('No estimates yet');

    const statuses: { label: string; key: EstimateStatus }[] = [
      { label: 'Draft', key: 'DRAFT' },
      { label: 'Converted', key: 'CONVERTED' },
      { label: 'Declined', key: 'DECLINED' },
      { label: 'Expired', key: 'EXPIRED' },
    ];

    for (const { label, key } of statuses) {
      await userEvent.click(filterPill(label));
      await waitFor(() =>
        expect(mockEstimateService.listEstimates).toHaveBeenLastCalledWith('org-1', { status: key })
      );
    }

    await userEvent.click(filterPill('All'));
    await waitFor(() =>
      expect(mockEstimateService.listEstimates).toHaveBeenLastCalledWith('org-1', undefined)
    );
  });
});
