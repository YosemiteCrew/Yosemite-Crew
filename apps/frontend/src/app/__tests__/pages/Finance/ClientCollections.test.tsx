import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ClientCollections from '@/app/features/finance/pages/ClientCollections';

const mockApi = {
  list: jest.fn(),
  saveTerms: jest.fn(),
  review: jest.fn(),
};
const mockPermission = { canEdit: true };
const mockOrg = { primaryOrgId: 'org-1' as string | null };
const mockParents = {
  parentsById: { 'parent-1': { firstName: 'Mara', lastName: 'Jones' } } as Record<
    string,
    { firstName?: string; lastName?: string; name?: string }
  >,
};

jest.mock('@/app/features/finance/services/clientCollectionsService', () => ({
  listOverdueClientInvoices: (...args: unknown[]) => mockApi.list(...args),
  saveClientPaymentTerms: (...args: unknown[]) => mockApi.saveTerms(...args),
  markClientInvoiceReviewed: (...args: unknown[]) => mockApi.review(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: typeof mockOrg) => unknown) => selector(mockOrg),
}));

jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: (selector: (state: typeof mockParents) => unknown) => selector(mockParents),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => mockPermission.canEdit }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>Unavailable</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => {
  const Button = ({
    href,
    text,
    ariaLabel,
    onClick,
    isDisabled,
    type = 'button',
  }: {
    href?: string;
    text: string;
    ariaLabel?: string;
    onClick?: () => void;
    isDisabled?: boolean;
    type?: 'button' | 'submit';
  }) =>
    href ? (
      <a href={href} aria-label={ariaLabel}>
        {text}
      </a>
    ) : (
      <button type={type} aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    );
  return { Primary: Button, Secondary: Button };
});

jest.mock('@/app/lib/money', () => ({
  formatMoneyPrecise: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
}));

const overdue = {
  invoiceId: 'invoice-12345678',
  parentId: 'parent-1',
  dueAt: '2026-09-02T03:59:59.999Z',
  dueDate: '2026-09-01',
  currency: 'EUR',
  balance: 54.25,
  netDays: 14,
  reviewedAt: null as string | null,
  reviewedBy: null as string | null,
};

beforeEach(() => {
  mockApi.list.mockReset().mockResolvedValue([overdue]);
  mockApi.saveTerms
    .mockReset()
    .mockResolvedValue({ netDays: 30, updatedAt: null, updatedBy: null });
  mockApi.review.mockReset().mockResolvedValue({
    id: overdue.invoiceId,
    collectionsReviewedAt: '2026-09-20T00:00:00.000Z',
    collectionsReviewedBy: 'user-1',
  });
  mockPermission.canEdit = true;
  mockOrg.primaryOrgId = 'org-1';
  mockParents.parentsById = { 'parent-1': { firstName: 'Mara', lastName: 'Jones' } };
});

describe('ClientCollections', () => {
  it('loads overdue invoices and payment terms, then saves an edited term', async () => {
    const user = userEvent.setup();
    render(<ClientCollections />);

    expect(await screen.findByRole('heading', { name: 'Mara Jones' })).toBeInTheDocument();
    expect(screen.getByText('EUR 54.25')).toBeInTheDocument();
    // The practice's calendar date, whatever the viewer's time zone.
    expect(screen.getByText('Due Sep 1, 2026')).toBeInTheDocument();
    expect(mockApi.list).toHaveBeenCalledTimes(1);
    const input = screen.getByRole('spinbutton', { name: /Payment due after/ });
    expect(input).toHaveValue(14);
    expect(input).toHaveAccessibleDescription('Applies to invoices finalized from now on.');
    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'Save payment terms for Mara Jones' }));
    await waitFor(() => expect(mockApi.saveTerms).toHaveBeenCalledWith('org-1', 'parent-1', 30));
    await waitFor(() => expect(input).toHaveValue(30));
  });

  it('validates term days before saving and marks the invoice reviewed', async () => {
    render(<ClientCollections />);
    await screen.findByRole('heading', { name: 'Mara Jones' });
    const input = screen.getByRole('spinbutton', { name: /Payment due after/ });
    fireEvent.change(input, { target: { value: '366' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('0 to 365');
    expect(mockApi.saveTerms).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('0 to 365');
    expect(mockApi.saveTerms).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Mark invoice/ }));
    expect(await screen.findByText(/Reviewed/)).toBeInTheDocument();
    expect(mockApi.review).toHaveBeenCalledWith('org-1', overdue.invoiceId);
  });

  it('keeps payment and review actions disabled while each update is pending', async () => {
    mockApi.saveTerms.mockReturnValue(new Promise(() => {}));
    mockApi.review.mockReturnValue(new Promise(() => {}));
    render(<ClientCollections />);
    await screen.findByRole('heading', { name: 'Mara Jones' });

    fireEvent.click(screen.getByRole('button', { name: 'Save payment terms for Mara Jones' }));
    fireEvent.click(screen.getByRole('button', { name: /Mark invoice/ }));

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save payment terms for Mara Jones' });
      const reviewButton = screen.getByRole('button', { name: /Mark invoice/ });
      expect(saveButton).toHaveTextContent('Saving…');
      expect(saveButton).toBeDisabled();
      expect(reviewButton).toHaveTextContent('Saving…');
      expect(reviewButton).toBeDisabled();
    });
  });

  it('shows the empty state when no balances are overdue', async () => {
    mockApi.list.mockResolvedValueOnce([]);
    render(<ClientCollections />);
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
  });

  it('shows loading while the overdue request is pending', () => {
    mockApi.list.mockReturnValue(new Promise(() => {}));
    render(<ClientCollections />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading overdue accounts');
  });

  it('groups invoices by client and uses stored client display names', async () => {
    const second = { ...overdue, invoiceId: 'invoice-22345678', currency: 'KWD', balance: 1.5 };
    const otherClient = {
      ...overdue,
      invoiceId: 'invoice-32345678',
      parentId: 'parent-2',
      netDays: 30,
    };
    const missingClient = { ...overdue, invoiceId: 'invoice-42345678', parentId: 'parent-3' };
    mockApi.list.mockResolvedValueOnce([overdue, second, otherClient, missingClient]);
    mockParents.parentsById = {
      'parent-1': { name: 'Mara Jones' },
      'parent-2': { name: 'Sam Lee' },
    };
    render(<ClientCollections />);
    expect(await screen.findByRole('heading', { name: 'Sam Lee' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Client account' })).toBeInTheDocument();
    expect(screen.getByText('2 overdue invoices')).toBeInTheDocument();
    // Each invoice keeps its own currency; nothing is totalled across them.
    expect(screen.getAllByText('EUR 54.25')).toHaveLength(3);
    expect(screen.getByText('KWD 1.50')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('spinbutton', { name: /Payment due after/ })
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(['14', '30', '14']);
    fireEvent.click(screen.getAllByRole('button', { name: /Mark invoice/ })[0]);
    await waitFor(() => expect(mockApi.review).toHaveBeenCalledWith('org-1', overdue.invoiceId));
    expect(screen.getAllByRole('button', { name: /Mark invoice/ })).toHaveLength(3);
  });

  it('does not request overdue accounts without an active organisation', () => {
    mockOrg.primaryOrgId = null;
    render(<ClientCollections />);
    expect(mockApi.list).not.toHaveBeenCalled();
  });

  it('shows a retry state when loading fails', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('network'));
    render(<ClientCollections />);
    expect(
      await screen.findByText('Unable to load overdue accounts. Please try again.')
    ).toBeInTheDocument();
    mockApi.list.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading overdue accounts' }));
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
  });

  it('keeps review and terms read-only without edit permission', async () => {
    mockPermission.canEdit = false;
    render(<ClientCollections />);
    await screen.findByRole('heading', { name: 'Mara Jones' });
    expect(screen.queryByRole('spinbutton', { name: /Payment due after/ })).not.toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Payment due after 14 days')).toBeInTheDocument();
  });

  it('shows action errors when saving terms or reviewing fails', async () => {
    mockApi.saveTerms.mockRejectedValueOnce(new Error('network'));
    mockApi.review.mockRejectedValueOnce(new Error('network'));
    render(<ClientCollections />);
    await screen.findByRole('heading', { name: 'Mara Jones' });
    fireEvent.click(screen.getByRole('button', { name: 'Save payment terms for Mara Jones' }));
    expect(
      await screen.findByText('Unable to save payment terms. Please try again.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark invoice/ }));
    expect(
      await screen.findByText('Unable to update this account. Refresh the list and try again.')
    ).toBeInTheDocument();
  });
});
