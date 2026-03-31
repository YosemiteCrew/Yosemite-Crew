import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import HistoryEntryCard from '@/app/features/companionHistory/components/HistoryEntryCard';

jest.mock('@/app/ui', () => ({
  Card: ({ children }: any) => <div data-testid="history-card">{children}</div>,
}));

jest.mock('react-icons/ri', () => ({
  RiExternalLinkLine: () => <span data-testid="external-icon" />,
}));

jest.mock('@/app/features/companionHistory/utils/historyFormatters', () => ({
  formatCurrency: jest.fn(
    (amount?: number, currency?: string) => `${currency ?? ''}:${amount ?? 0}`
  ),
  formatHistoryDate: jest.fn(() => 'formatted-date'),
  formatHistoryDateTime: jest.fn(() => 'formatted-datetime'),
  getHistoryTypeLabel: jest.fn((type: string) => type),
  getPayloadBoolean: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'boolean' ? value : null;
  }),
  getPayloadNumber: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'number' ? value : null;
  }),
  getPayloadString: jest.fn((payload: any, keys: string[]) => {
    const value = keys.map((k) => payload?.[k]).find((v) => v !== undefined);
    return typeof value === 'string' ? value : null;
  }),
  getPrimaryActionLabel: jest.fn(() => 'Open history entry'),
  getTypeBadgeClassName: jest.fn(() => 'badge-class'),
}));

jest.mock('@/app/lib/invoicePaymentMethod', () => ({
  getPaymentCollectionMethodLabel: jest.fn((value?: string) => value ?? ''),
}));

const baseEntry = {
  id: 'entry-1',
  type: 'TASK',
  occurredAt: '2026-01-01T10:00:00.000Z',
  status: 'IN_PROGRESS',
  title: 'Medication reminder',
  subtitle: 'Morning dose',
  summary: 'Give medicine with food',
  actor: { name: 'Dr Vet', role: 'VET' },
  tags: ['Important'],
  link: {
    kind: 'task',
    id: 'task-1',
    companionId: 'companion-1',
  },
  source: 'Manual',
  payload: {
    audience: 'Parent',
    dueAt: '2026-01-03T10:00:00.000Z',
    medicationSummary: 'Tablet',
  },
} as any;

describe('HistoryEntryCard', () => {
  it('renders key details and opens entry on click', () => {
    const onOpen = jest.fn();
    render(<HistoryEntryCard entry={baseEntry} onOpen={onOpen} />);

    expect(screen.getByTestId('history-card')).toBeInTheDocument();
    expect(screen.getByText('TASK')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('formatted-datetime')).toBeInTheDocument();
    expect(screen.getByText('Morning dose')).toBeInTheDocument();
    expect(screen.getByText('Give medicine with food')).toBeInTheDocument();
    expect(screen.getByText('Actor: Dr Vet • VET')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open history entry' }));
    expect(onOpen).toHaveBeenCalledWith(baseEntry);
  });

  it('renders document-specific details and synced source label', () => {
    const documentEntry = {
      ...baseEntry,
      type: 'DOCUMENT',
      status: '',
      actor: {},
      payload: {
        category: 'Prescription',
        subcategory: 'Medication',
        issueDate: '2026-02-01T10:00:00.000Z',
        issuingBusinessName: 'Yosemite Clinic',
        syncedFromPms: true,
      },
    } as any;

    render(<HistoryEntryCard entry={documentEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('Category:')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();
    expect(screen.getByText('Sub-category:')).toBeInTheDocument();
    expect(screen.getByText('Medication')).toBeInTheDocument();
    expect(screen.getByText('Issue date:')).toBeInTheDocument();
    expect(screen.getByText('formatted-date')).toBeInTheDocument();
    expect(screen.queryByText(/^Actor:/)).not.toBeInTheDocument();
  });

  it('renders invoice branch values', () => {
    const invoiceEntry = {
      ...baseEntry,
      type: 'INVOICE',
      status: 'PAID',
      payload: {
        totalAmount: 100,
        currency: 'USD',
        paymentCollectionMethod: 'CARD',
        paidAt: '2026-03-01T10:00:00.000Z',
      },
    } as any;

    render(<HistoryEntryCard entry={invoiceEntry} onOpen={jest.fn()} />);

    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('USD:100')).toBeInTheDocument();
    expect(screen.getByText('Payment method:')).toBeInTheDocument();
    expect(screen.getByText('CARD')).toBeInTheDocument();
  });
});
