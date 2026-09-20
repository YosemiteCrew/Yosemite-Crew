import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneInsuranceClaimList from '@/app/features/finance/pages/InsuranceClaims/Sections/PhoneInsuranceClaimList';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

jest.mock('@/app/lib/money', () => ({
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
}));

jest.mock(
  '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimStatusBadge',
  () => ({
    __esModule: true,
    default: ({ status }: { status: string }) => <span>{`badge:${status}`}</span>,
  })
);

const claim = (over: Partial<InsuranceClaim> = {}): InsuranceClaim =>
  ({
    id: 'c1',
    organisationId: 'org-1',
    patientId: 'pat-1',
    insurerName: 'Petplan',
    policyNumber: 'POL-9911',
    claimNumber: 'CLM-2026-004',
    submittedAmount: 420,
    approvedAmount: null,
    paidAmount: null,
    currency: 'GBP',
    status: 'SUBMITTED',
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
    ...over,
  }) as InsuranceClaim;

const renderList = (props: Partial<React.ComponentProps<typeof PhoneInsuranceClaimList>> = {}) =>
  render(
    <PhoneInsuranceClaimList
      claims={[claim()]}
      activeClaimId={null}
      onSelect={jest.fn()}
      {...props}
    />
  );

describe('PhoneInsuranceClaimList', () => {
  it('leads each card with the insurer and the status the table hid', () => {
    renderList();
    expect(screen.getByText('Petplan')).toBeInTheDocument();
    expect(screen.getByText('badge:SUBMITTED')).toBeInTheDocument();
  });

  it('carries the same accessible name as the table row action', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Open the claim for Petplan' })).toBeInTheDocument();
  });

  describe('the settled figure', () => {
    it('prefers paid over approved and submitted', () => {
      renderList({
        claims: [claim({ submittedAmount: 420, approvedAmount: 300, paidAmount: 275 })],
      });
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('GBP 275.00')).toBeInTheDocument();
      expect(screen.queryByText('GBP 300.00')).not.toBeInTheDocument();
      expect(screen.queryByText('GBP 420.00')).not.toBeInTheDocument();
    });

    it('falls back to approved when nothing is paid', () => {
      renderList({
        claims: [claim({ submittedAmount: 420, approvedAmount: 300, paidAmount: null })],
      });
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('GBP 300.00')).toBeInTheDocument();
    });

    it('falls back to the submitted ask when neither is set', () => {
      renderList({
        claims: [claim({ submittedAmount: 420, approvedAmount: null, paidAmount: null })],
      });
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('GBP 420.00')).toBeInTheDocument();
    });

    it('shows a paid figure of zero rather than falling through to approved', () => {
      // `paidAmount: 0` is a real settlement - a nullish check is required here,
      // and a falsy one would report the approved figure as if it had been paid.
      renderList({ claims: [claim({ approvedAmount: 300, paidAmount: 0 })] });
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('GBP 0.00')).toBeInTheDocument();
    });
  });

  it('appends the claim number to the policy only when one has been issued', () => {
    const { unmount } = renderList({ claims: [claim({ claimNumber: 'CLM-2026-004' })] });
    expect(screen.getByText('POL-9911 · CLM-2026-004')).toBeInTheDocument();
    unmount();

    renderList({ claims: [claim({ claimNumber: null })] });
    expect(screen.getByText('POL-9911')).toBeInTheDocument();
  });

  it('marks the open claim and leaves the others unmarked', () => {
    renderList({
      claims: [claim({ id: 'c1' }), claim({ id: 'c2', insurerName: 'Agria' })],
      activeClaimId: 'c1',
    });
    expect(screen.getByRole('button', { name: 'Open the claim for Petplan' }).className).toContain(
      'border-[var(--blue)]'
    );
    expect(screen.getByRole('button', { name: 'Open the claim for Agria' }).className).toContain(
      'border-[var(--hairline)]'
    );
  });

  it('hands the whole claim back when a card is tapped', () => {
    const onSelect = jest.fn();
    const only = claim({ id: 'c9' });
    renderList({ claims: [only], onSelect });
    fireEvent.click(screen.getByRole('button', { name: 'Open the claim for Petplan' }));
    expect(onSelect).toHaveBeenCalledWith(only);
  });

  it('renders nothing but the container when there are no claims', () => {
    renderList({ claims: [] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
