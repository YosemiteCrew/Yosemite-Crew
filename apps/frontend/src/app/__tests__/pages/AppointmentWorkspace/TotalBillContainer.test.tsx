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
  const onChangeOverallDiscount = jest.fn();
  const view = render(
    <TotalBillContainer
      items={[item]}
      billableItems={[]}
      currency="USD"
      depositCents={0}
      withdrawDeposit={false}
      overallDiscountPercent={0}
      onToggleWithdrawDeposit={noop}
      onChangeOverallDiscount={onChangeOverallDiscount}
      onAddItem={noop}
      onUpdateItem={onUpdateItem}
      onRemoveItem={noop}
      {...props}
    />
  );
  return { onUpdateItem, onChangeOverallDiscount, view };
};

const overallDiscountInput = () => screen.getByLabelText('Overall discount percent');

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

  describe('overall discount cap', () => {
    it('accepts any discount when no cap is configured (unchanged behaviour)', () => {
      const { onChangeOverallDiscount } = renderBill();

      fireEvent.change(overallDiscountInput(), { target: { value: '95' } });

      expect(onChangeOverallDiscount).toHaveBeenCalledWith(95);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('accepts a discount exactly at the cap', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
      });

      fireEvent.change(overallDiscountInput(), { target: { value: '20' } });

      expect(onChangeOverallDiscount).toHaveBeenCalledWith(20);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('accepts a discount below the cap', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
      });

      fireEvent.change(overallDiscountInput(), { target: { value: '5' } });

      expect(onChangeOverallDiscount).toHaveBeenCalledWith(5);
    });

    it('rejects a discount above the cap, names the cap, and does NOT clamp', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
      });

      fireEvent.change(overallDiscountInput(), { target: { value: '50' } });

      // Rejected: the bill never hears about it...
      expect(onChangeOverallDiscount).not.toHaveBeenCalled();
      // ...and it is NOT silently clamped down to the cap either.
      expect(onChangeOverallDiscount).not.toHaveBeenCalledWith(20);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        "Overall discount can't go above your organisation's 20% cap"
      );
      // The typed value stays on screen next to the reason it was refused.
      expect(overallDiscountInput()).toHaveValue(50);
      expect(overallDiscountInput()).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears the rejection once a permitted discount is entered', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
      });

      fireEvent.change(overallDiscountInput(), { target: { value: '50' } });
      expect(screen.getByRole('alert')).toBeInTheDocument();

      fireEvent.change(overallDiscountInput(), { target: { value: '10' } });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onChangeOverallDiscount).toHaveBeenCalledWith(10);
    });

    it('rejects a cap breach when the cap is 0 (all discounting disallowed)', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 0,
      });

      fireEvent.change(overallDiscountInput(), { target: { value: '1' } });

      expect(onChangeOverallDiscount).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent("organisation's 0% cap");
    });

    it('re-syncs the field when the accepted discount changes elsewhere', () => {
      const { view } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
        overallDiscountPercent: 5,
      });
      expect(overallDiscountInput()).toHaveValue(5);

      // A rejected entry leaves the field showing what was typed...
      fireEvent.change(overallDiscountInput(), { target: { value: '80' } });
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // ...until the accepted discount changes from outside, which resets both.
      view.rerender(
        <TotalBillContainer
          items={[baseItem]}
          billableItems={[]}
          currency="USD"
          depositCents={0}
          withdrawDeposit={false}
          overallDiscountPercent={15}
          maxOverallDiscountPercent={20}
          onToggleWithdrawDeposit={noop}
          onChangeOverallDiscount={noop}
          onAddItem={noop}
          onUpdateItem={noop}
          onRemoveItem={noop}
        />
      );

      expect(overallDiscountInput()).toHaveValue(15);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
