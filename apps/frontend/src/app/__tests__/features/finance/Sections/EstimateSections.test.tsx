import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Renders children so the gated action row is exercised; the permission logic
// itself is covered by PermissionGate's own tests.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import EstimateStatusBadge from '@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge';
import EstimateList from '@/app/features/finance/pages/Estimates/Sections/EstimateList';
import EstimateDetail, {
  type EstimateAction,
} from '@/app/features/finance/pages/Estimates/Sections/EstimateDetail';
import type { Estimate, EstimateItem, EstimateStatus } from '@/app/features/finance/types/estimate';

const makeItem = (overrides: Partial<EstimateItem> = {}): EstimateItem => ({
  id: 'item-1',
  description: 'Consultation',
  quantity: 2,
  unitPrice: 40,
  taxRate: 20,
  lineTotal: 80,
  notes: null,
  ...overrides,
});

// Figures are internally consistent: 80 + 50 subtotal, 20% of the first line as
// tax, so a reader can check the totals against the lines by hand.
const makeEstimate = (overrides: Partial<Estimate> = {}): Estimate => ({
  id: 'est-1',
  organisationId: 'org-1',
  patientId: 'pet-1',
  encounterId: null,
  status: 'DRAFT',
  validUntil: '2026-09-30T00:00:00.000Z',
  subtotal: 130,
  taxAmount: 16,
  total: 146,
  currency: 'USD',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  items: [
    makeItem(),
    makeItem({
      id: 'item-2',
      description: 'Vaccination',
      quantity: 1,
      unitPrice: 50,
      taxRate: 0,
      lineTotal: 50,
      notes: 'Annual booster',
    }),
  ],
  ...overrides,
});

const closestRow = (element: HTMLElement): HTMLElement => {
  const row = element.closest('tr');
  if (!row) throw new Error('Expected the element to sit inside a table row.');
  return row;
};

describe('EstimateStatusBadge', () => {
  const labels: [EstimateStatus, string][] = [
    ['DRAFT', 'Draft'],
    ['SENT', 'Sent'],
    ['APPROVED', 'Approved'],
    ['CONVERTED', 'Converted'],
    ['DECLINED', 'Declined'],
    ['EXPIRED', 'Expired'],
  ];

  it.each(labels)('renders the human label for %s', (status, label) => {
    render(<EstimateStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('colours the pill from the status token set', () => {
    render(<EstimateStatusBadge status="CONVERTED" />);

    // Read the inline style attribute rather than computed style: jsdom does
    // not resolve `var()` references, so a computed-style match would compare
    // two empty strings and pass for any token.
    const style = screen.getByText('Converted').getAttribute('style') ?? '';
    expect(style).toContain('var(--color-pill-success-bg)');
    expect(style).toContain('var(--color-pill-success-text)');
    expect(style).toContain('var(--color-pill-success-border)');
  });
});

describe('EstimateList', () => {
  const estimates = [
    makeEstimate({ id: 'est-1', patientId: 'pet-1', total: 146, status: 'DRAFT' }),
    makeEstimate({
      id: 'est-2',
      patientId: 'pet-2',
      total: 1234.5,
      status: 'APPROVED',
      validUntil: null,
    }),
  ];

  const names: Record<string, string> = { 'pet-1': 'Rex', 'pet-2': 'Milo' };
  const companion = (patientId: string) => ({
    name: names[patientId] ?? 'Unknown companion',
    speciesCode: 'dog',
  });

  const renderList = (overrides: Partial<React.ComponentProps<typeof EstimateList>> = {}) => {
    const onSelect = jest.fn();
    render(
      <EstimateList
        estimates={estimates}
        activeEstimateId={null}
        onSelect={onSelect}
        companion={companion}
        {...overrides}
      />
    );
    return { onSelect };
  };

  const rowFor = (name: string): HTMLElement =>
    closestRow(screen.getByRole('button', { name: `Open the estimate for ${name}` }));

  it('renders a row per estimate with the companion name resolved through the prop', () => {
    renderList();

    // One header row plus one row per estimate.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(within(rowFor('Rex')).getByText('Rex')).toBeInTheDocument();
    expect(within(rowFor('Milo')).getByText('Milo')).toBeInTheDocument();
  });

  it('renders the total with two decimals', () => {
    renderList();

    expect(within(rowFor('Rex')).getAllByRole('cell')[4]).toHaveTextContent('$146.00');
    expect(within(rowFor('Milo')).getAllByRole('cell')[4]).toHaveTextContent('$1,234.50');
  });

  it('calls onSelect with the estimate whose name button was clicked', async () => {
    const { onSelect } = renderList();

    await userEvent.click(screen.getByRole('button', { name: 'Open the estimate for Milo' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(estimates[1]);
  });

  it('renders a dash for a null valid-until date', () => {
    renderList();

    expect(within(rowFor('Milo')).getAllByRole('cell')[3]).toHaveTextContent('-');
    expect(within(rowFor('Rex')).getAllByRole('cell')[3]).not.toHaveTextContent('-');
  });

  it('renders a dash for an unparseable date rather than "Invalid Date"', () => {
    renderList({
      estimates: [makeEstimate({ id: 'est-3', patientId: 'pet-1', validUntil: 'not-a-date' })],
    });

    expect(within(rowFor('Rex')).getAllByRole('cell')[3]).toHaveTextContent('-');
  });

  it('renders the status badge for each row', () => {
    renderList();

    expect(within(rowFor('Rex')).getByText('Draft')).toBeInTheDocument();
    expect(within(rowFor('Milo')).getByText('Approved')).toBeInTheDocument();
  });

  it('highlights the active row only', () => {
    renderList({ activeEstimateId: 'est-2' });

    // classList, not a substring match: the base row classes already carry
    // `hover:bg-card-hover`, which any `toContain` check would match.
    expect(rowFor('Milo').classList.contains('bg-card-hover')).toBe(true);
    expect(rowFor('Rex').classList.contains('bg-card-hover')).toBe(false);
  });
});

describe('EstimateDetail', () => {
  const ARIA_LABELS: Record<EstimateAction, string> = {
    send: 'Mark this estimate as sent',
    decline: 'Decline this estimate',
    approve: 'Approve this estimate',
    convert: 'Convert this estimate to an invoice',
  };

  const IDLE_LABELS: Record<EstimateAction, string> = {
    send: 'Mark as sent',
    decline: 'Decline',
    approve: 'Approve',
    convert: 'Convert to invoice',
  };

  const PENDING_LABELS: Record<EstimateAction, string> = {
    send: 'Sending...',
    decline: 'Declining...',
    approve: 'Approving...',
    convert: 'Converting...',
  };

  const ALL_ACTIONS: EstimateAction[] = ['send', 'decline', 'approve', 'convert'];

  const renderDetail = (overrides: Partial<React.ComponentProps<typeof EstimateDetail>> = {}) => {
    const onAction = jest.fn();
    render(
      <EstimateDetail
        estimate={makeEstimate()}
        companionName="Rex"
        pendingAction={null}
        onAction={onAction}
        error={null}
        {...overrides}
      />
    );
    return { onAction };
  };

  const actionButton = (action: EstimateAction) =>
    screen.queryByRole('button', { name: ARIA_LABELS[action] });

  /**
   * One line of the estimate. The detail renders its lines through the shared
   * TableHead recipe over a CSS grid, matching InvoiceBilledItems, so a line is
   * a grid row rather than a <tr> - the cells are its direct children.
   */
  const lineRow = (description: string): HTMLElement => {
    const row = screen.getByText(description).closest('div[style*="grid-template-columns"]');
    if (!row) throw new Error(`No estimate line row found for "${description}".`);
    return row as HTMLElement;
  };

  const lineCells = (description: string): HTMLElement[] =>
    Array.from(lineRow(description).children) as HTMLElement[];

  /**
   * Scoped to the totals group, because "Tax" is also a column header on the
   * line-items table above and an unscoped query matches both.
   */
  const summaryValue = (label: string): string => {
    // Anchored on the <dt>, so "Tax" here is never confused with the "Tax"
    // column header on the lines table above.
    const term = screen.getAllByText(label).find((node) => node.tagName === 'DT');
    const value = term?.nextElementSibling;
    if (!value) throw new Error(`Expected a value beside the "${label}" summary label.`);
    return value.textContent ?? '';
  };

  it('says so when an estimate has no lines at all', () => {
    renderDetail({ estimate: makeEstimate({ items: [] }) });

    expect(screen.getByText('This estimate has no lines.')).toBeInTheDocument();
  });

  it('omits the notes line when an item carries none', () => {
    renderDetail();

    // Consultation has no notes; Vaccination does. The notes span must exist
    // for one and not the other, rather than rendering an empty element.
    expect(lineCells('Consultation')[0].querySelectorAll('span')).toHaveLength(1);
    expect(lineCells('Vaccination')[0].querySelectorAll('span').length).toBeGreaterThan(1);
  });

  it('renders every line item with its description, quantity, unit price, tax and line total', () => {
    renderDetail();

    const consultation = lineCells('Consultation');
    expect(consultation[0]).toHaveTextContent('Consultation');
    expect(consultation[1]).toHaveTextContent('2');
    expect(consultation[2]).toHaveTextContent('$40.00');
    expect(consultation[3]).toHaveTextContent('20%');
    expect(consultation[4]).toHaveTextContent('$80.00');

    const vaccination = lineCells('Vaccination');
    expect(vaccination[0]).toHaveTextContent('Vaccination');
    expect(vaccination[0]).toHaveTextContent('Annual booster');
    expect(vaccination[1]).toHaveTextContent('1');
    expect(vaccination[2]).toHaveTextContent('$50.00');
    expect(vaccination[3]).toHaveTextContent('0%');
    expect(vaccination[4]).toHaveTextContent('$50.00');
  });

  it('renders the subtotal, tax and total', () => {
    renderDetail();

    expect(summaryValue('Subtotal')).toBe('$130.00');
    expect(summaryValue('Tax')).toBe('$16.00');
    expect(summaryValue('Total')).toBe('$146.00');
  });

  it('renders the companion name and the status badge in the header', () => {
    renderDetail({ estimate: makeEstimate({ status: 'SENT' }) });

    expect(screen.getByRole('heading', { level: 2, name: 'Rex' })).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  describe('action gating', () => {
    const gating: [EstimateStatus, EstimateAction[]][] = [
      ['DRAFT', ['send', 'decline', 'approve']],
      ['SENT', ['decline', 'approve']],
      ['APPROVED', ['convert']],
      ['DECLINED', []],
      ['EXPIRED', []],
      ['CONVERTED', []],
    ];

    it.each(gating)('offers only the accepted transitions for %s', (status, allowed) => {
      renderDetail({ estimate: makeEstimate({ status }) });

      for (const action of ALL_ACTIONS) {
        const button = actionButton(action);
        if (allowed.includes(action)) {
          expect(button).toBeInTheDocument();
          expect(button).toHaveTextContent(IDLE_LABELS[action]);
        } else {
          expect(button).not.toBeInTheDocument();
        }
      }
    });

    it('offers no lifecycle action at all once the estimate is converted', () => {
      renderDetail({ estimate: makeEstimate({ status: 'CONVERTED' }) });

      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('action dispatch', () => {
    const dispatch: [EstimateAction, EstimateStatus][] = [
      ['send', 'DRAFT'],
      ['decline', 'DRAFT'],
      ['approve', 'SENT'],
      ['convert', 'APPROVED'],
    ];

    it.each(dispatch)('calls onAction with "%s"', async (action, status) => {
      const { onAction } = renderDetail({ estimate: makeEstimate({ status }) });

      await userEvent.click(screen.getByRole('button', { name: ARIA_LABELS[action] }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith(action);
    });
  });

  describe('pendingAction', () => {
    const pending: [EstimateAction, EstimateStatus][] = [
      ['send', 'DRAFT'],
      ['decline', 'DRAFT'],
      ['approve', 'SENT'],
      ['convert', 'APPROVED'],
    ];

    it.each(pending)(
      'shows the pending label for "%s" and disables every button',
      (action, status) => {
        renderDetail({ estimate: makeEstimate({ status }), pendingAction: action });

        const button = screen.getByRole('button', { name: ARIA_LABELS[action] });
        expect(button).toHaveTextContent(PENDING_LABELS[action]);
        expect(button).not.toHaveTextContent(IDLE_LABELS[action]);

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        for (const other of buttons) expect(other).toBeDisabled();
      }
    );

    it('leaves the other buttons on their idle labels while one is in flight', () => {
      renderDetail({ estimate: makeEstimate({ status: 'DRAFT' }), pendingAction: 'approve' });

      expect(actionButton('send')).toHaveTextContent('Mark as sent');
      expect(actionButton('decline')).toHaveTextContent('Decline');
      expect(actionButton('approve')).toHaveTextContent('Approving...');
    });

    it('enables the buttons when nothing is in flight', () => {
      renderDetail({ estimate: makeEstimate({ status: 'DRAFT' }) });

      for (const button of screen.getAllByRole('button')) expect(button).toBeEnabled();
    });
  });

  describe('the converted estimate', () => {
    it('explains why converting again is not offered and links to the invoice', () => {
      renderDetail({
        estimate: makeEstimate({ status: 'CONVERTED', convertedToInvoiceId: 'inv-9' }),
      });

      expect(screen.getByText(/converted to an invoice/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View the invoice' })).toHaveAttribute(
        'href',
        '/finance?invoiceId=inv-9'
      );
    });

    it('shows no invoice link when nothing has been converted', () => {
      renderDetail({ estimate: makeEstimate({ status: 'APPROVED' }) });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByText(/converted to an invoice/i)).not.toBeInTheDocument();
    });
  });

  it('renders the error in an alert', () => {
    renderDetail({ error: 'The estimate has already been converted.' });

    expect(screen.getByRole('alert')).toHaveTextContent('The estimate has already been converted.');
  });

  it('renders no alert without an error', () => {
    renderDetail();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the decline reason when there is one', () => {
    renderDetail({
      estimate: makeEstimate({ status: 'DECLINED', declineReason: 'Ran out of budget' }),
    });

    expect(screen.getByText('Declined: Ran out of budget')).toBeInTheDocument();
  });

  it('renders no decline line when there is no reason', () => {
    renderDetail({ estimate: makeEstimate({ status: 'DECLINED' }) });

    expect(screen.queryByText(/^Declined:/)).not.toBeInTheDocument();
  });

  it('renders the estimate notes when present', () => {
    renderDetail({ estimate: makeEstimate({ notes: 'Quoted before the dental x-rays.' }) });

    expect(screen.getByText('Quoted before the dental x-rays.')).toBeInTheDocument();
  });
});
