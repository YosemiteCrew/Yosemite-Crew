import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InsuranceClaimsHeader from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimsHeader';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ href, text, ariaLabel }: any) => (
    <a href={href} aria-label={ariaLabel}>
      {text}
    </a>
  ),
}));

const baseProps = {
  claims: [] as InsuranceClaim[],
  currency: 'USD',
  activeStatus: 'all',
  onStatusChange: jest.fn(),
  companions: [{ id: 'c1', name: 'Bruno' }] as any,
  onCreate: jest.fn(),
};

describe('InsuranceClaimsHeader', () => {
  it('shows the claim count and back-to-invoices link', () => {
    render(<InsuranceClaimsHeader {...baseProps} claims={[{ id: '1' } as InsuranceClaim]} />);

    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
  });

  it('stacks page actions above the status filter, not beside it', () => {
    render(<InsuranceClaimsHeader {...baseProps} />);

    const backLink = screen.getByRole('link', { name: 'Back to invoices' });
    const statusFilter = screen.getByRole('group', { name: 'Filter claims by status' });

    // Document order, not just presence: the nav row must come before the
    // filter row, otherwise they render as one mixed row again.
    expect(
      backLink.compareDocumentPosition(statusFilter) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
