import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PackageBreakdownTooltip from '@/app/features/appointments/pages/AppointmentWorkspace/components/PackageBreakdownTooltip';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';

const PACKAGE_ITEM: InvoiceLineItem = {
  id: 'line-dental-package',
  name: 'Dental package (grade 2)',
  unitPriceCents: 38360,
  qty: 1,
  grossCents: 38360,
  discountCents: 3836,
  amountCents: 34524,
  breakdown: [
    {
      id: 'cmp-1',
      name: 'General anaesthesia (first 30 min)',
      qty: 1,
      instructions: 'Procedure',
      unitPriceCents: 12000,
      amountCents: 12000,
    },
  ],
};

describe('PackageBreakdownTooltip', () => {
  it('opens the breakdown by tap, with no hover involved', async () => {
    render(<PackageBreakdownTooltip item={PACKAGE_ITEM} currency="USD" />);

    const trigger = screen.getByRole('button', {
      name: 'View Dental package (grade 2) package breakdown',
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
    expect(screen.getByText('General anaesthesia (first 30 min)')).toBeInTheDocument();
  });
});
