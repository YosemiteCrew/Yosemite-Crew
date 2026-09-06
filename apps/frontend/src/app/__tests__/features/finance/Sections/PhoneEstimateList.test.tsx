import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneEstimateList from '@/app/features/finance/pages/Estimates/Sections/PhoneEstimateList';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <span data-src={src}>{alt}</span>,
}));

jest.mock('@/app/lib/money', () => ({
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
}));

jest.mock('@/app/lib/date', () => ({
  formatDisplayDate: (value: string | undefined, fallback: string) =>
    value ? `D:${value.slice(0, 10)}` : fallback,
}));

const getSafeImageUrlMock = jest.fn(() => '/img.png');
jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: (...args: unknown[]) => getSafeImageUrlMock(...(args as [])),
}));

jest.mock('@/app/features/companions/pages/Companions/companionsDirectory', () => ({
  getAvatarPalette: () => ({ bg: '#eee' }),
}));

jest.mock('@/app/features/finance/pages/Estimates/Sections/EstimateStatusBadge', () => ({
  __esModule: true,
  default: ({ status }: { status: string }) => <span>{`badge:${status}`}</span>,
}));

const estimate = (over: Partial<Estimate> = {}): Estimate =>
  ({
    id: 'e1',
    organisationId: 'org-1',
    patientId: 'pat-1',
    encounterId: null,
    status: 'DRAFT' as EstimateStatus,
    validUntil: null,
    subtotal: 100,
    taxAmount: 0,
    total: 100,
    currency: 'GBP',
    notes: null,
    approvedBy: null,
    approvedAt: null,
    declinedAt: null,
    declineReason: null,
    convertedToInvoiceId: null,
    createdBy: null,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
    items: [],
    ...over,
  }) as Estimate;

const companion = (patientId: string) => ({
  name: patientId === 'pat-2' ? 'Rufus' : 'Marnie',
  photoUrl: patientId === 'pat-2' ? undefined : 'https://example.test/p.png',
  speciesCode: patientId === 'pat-2' ? undefined : 'dog',
});

const renderList = (props: Partial<React.ComponentProps<typeof PhoneEstimateList>> = {}) =>
  render(
    <PhoneEstimateList
      estimates={[estimate()]}
      activeEstimateId={null}
      onSelect={jest.fn()}
      companion={companion}
      {...props}
    />
  );

beforeEach(() => {
  getSafeImageUrlMock.mockClear();
});

describe('PhoneEstimateList', () => {
  it('draws a card per estimate with the companion and the amount', () => {
    renderList({
      estimates: [
        estimate({ id: 'e1', patientId: 'pat-1', total: 199.97 }),
        estimate({ id: 'e2', patientId: 'pat-2', total: 45.5 }),
      ],
    });

    expect(screen.getByText('Marnie')).toBeInTheDocument();
    expect(screen.getByText('Rufus')).toBeInTheDocument();
    // The column the table pushed off-screen has to be present on the card.
    expect(screen.getByText('GBP 199.97')).toBeInTheDocument();
    expect(screen.getByText('GBP 45.50')).toBeInTheDocument();
  });

  it('carries the same accessible name as the table row action', () => {
    renderList();
    expect(
      screen.getByRole('button', { name: 'Open the estimate for Marnie' })
    ).toBeInTheDocument();
  });

  it('appends the expiry to the date line only when one is set', () => {
    const { unmount } = renderList({
      estimates: [estimate({ validUntil: '2026-11-02T00:00:00.000Z' })],
    });
    expect(screen.getByText('D:2026-08-28 · valid to D:2026-11-02')).toBeInTheDocument();
    unmount();

    renderList({ estimates: [estimate({ validUntil: null })] });
    expect(screen.getByText('D:2026-08-28')).toBeInTheDocument();
    expect(screen.queryByText(/valid to/)).not.toBeInTheDocument();
  });

  it('marks the open estimate and leaves the others unmarked', () => {
    renderList({
      estimates: [
        estimate({ id: 'e1', patientId: 'pat-1' }),
        estimate({ id: 'e2', patientId: 'pat-2' }),
      ],
      activeEstimateId: 'e1',
    });

    expect(
      screen.getByRole('button', { name: 'Open the estimate for Marnie' }).className
    ).toContain('border-[var(--blue)]');
    expect(screen.getByRole('button', { name: 'Open the estimate for Rufus' }).className).toContain(
      'border-[var(--hairline)]'
    );
  });

  it('hands the whole estimate back when a card is tapped', () => {
    const onSelect = jest.fn();
    const only = estimate({ id: 'e7' });
    renderList({ estimates: [only], onSelect });

    fireEvent.click(screen.getByRole('button', { name: 'Open the estimate for Marnie' }));
    expect(onSelect).toHaveBeenCalledWith(only);
  });

  it("falls back to the 'other' species image when the companion has no species", () => {
    renderList({ estimates: [estimate({ patientId: 'pat-2' })] });
    expect(getSafeImageUrlMock).toHaveBeenCalledWith(undefined, 'other');
  });

  it('renders nothing but the container when there are no estimates', () => {
    renderList({ estimates: [] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
