import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => (
    <span>
      {children}
      <span role="tooltip">{content}</span>
    </span>
  ),
}));

const noop = jest.fn();

const baseItem: InvoiceLineItem = {
  id: 'line-1',
  name: 'Arthritis care package',
  unitPriceCents: 10000,
  qty: 1,
  grossCents: 10000,
  discountCents: 1000,
  amountCents: 9000,
  maxDiscountPercent: 20,
  maxDiscountCents: 2000,
  breakdown: [
    {
      id: 'pkg-row-1',
      name: 'Mobility exam',
      qty: 1,
      instructions: 'CONSULTATION',
      unitPriceCents: 10000,
      grossCents: 10000,
      discountPercent: 10,
      discountCents: 1000,
      amountCents: 9000,
    },
  ],
};

const renderBill = (
  item: InvoiceLineItem = baseItem,
  props?: Partial<React.ComponentProps<typeof TotalBillContainer>>
) => {
  const onUpdateItem = jest.fn();
  render(
    <TotalBillContainer
      items={[item]}
      billableItems={[]}
      currency="USD"
      depositCents={0}
      withdrawDeposit={false}
      overallDiscountPercent={0}
      onToggleWithdrawDeposit={noop}
      onChangeOverallDiscount={noop}
      onAddItem={noop}
      onUpdateItem={onUpdateItem}
      onRemoveItem={noop}
      {...props}
    />
  );
  return { onUpdateItem };
};

describe('TotalBillContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('edits line discounts as percentages and shows the read-only money value', () => {
    const { onUpdateItem } = renderBill();

    expect(screen.getByLabelText('Discount percent for Arthritis care package')).toHaveValue(10);
    expect(screen.getByText(/Max discount 20%/)).toBeInTheDocument();
    expect(screen.getAllByText('$90').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText((text) => text.trim() === '− $10')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Discount percent for Arthritis care package'), {
      target: { value: '50' },
    });

    expect(onUpdateItem).toHaveBeenCalledWith('line-1', { discountCents: 2000 });
  });

  it('hides the remove control for a non-removable (booked) line, shows it otherwise', () => {
    renderBill({ ...baseItem, removable: false });
    expect(
      screen.queryByRole('button', { name: /remove arthritis care package/i })
    ).not.toBeInTheDocument();

    renderBill({ ...baseItem, id: 'line-2', name: 'Bandage', removable: true });
    expect(screen.getByRole('button', { name: /remove bandage/i })).toBeInTheDocument();
  });

  it('shows package breakdown and prescription warnings in glass tooltip content', () => {
    renderBill(baseItem, { incompleteItemNames: new Set(['arthritis care package']) });

    expect(
      screen.getByLabelText('View Arthritis care package package breakdown')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Arthritis care package').length).toBeGreaterThan(1);
    expect(screen.getByText('Package breakdown')).toBeInTheDocument();
    expect(screen.getByText('Mobility exam')).toBeInTheDocument();
    expect(screen.getByText('CONSULTATION')).toBeInTheDocument();
    expect(screen.getByText('10% / -$10')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('$90').length).toBeGreaterThan(1);

    expect(screen.getByLabelText('Fill information in previous step')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Fill prescription information in the Treatment step before finalizing this invoice.'
      )
    ).toBeInTheDocument();
  });
});
