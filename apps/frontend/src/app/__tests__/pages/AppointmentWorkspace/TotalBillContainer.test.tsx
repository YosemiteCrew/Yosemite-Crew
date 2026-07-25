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
  const onAddItem = jest.fn();
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
      onAddItem={onAddItem}
      onUpdateItem={onUpdateItem}
      onRemoveItem={noop}
      {...props}
    />
  );
  return { onUpdateItem, onChangeOverallDiscount, onAddItem, view };
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

  it('renders the empty state when there are no line items', () => {
    render(
      <TotalBillContainer
        items={[]}
        billableItems={[]}
        currency="USD"
        depositCents={0}
        withdrawDeposit={false}
        overallDiscountPercent={0}
        onToggleWithdrawDeposit={noop}
        onChangeOverallDiscount={noop}
        onAddItem={noop}
        onUpdateItem={noop}
        onRemoveItem={noop}
      />
    );

    expect(screen.getByText('No invoice line items added yet.')).toBeInTheDocument();
  });

  it('edits the line quantity, flooring it to at least 1', () => {
    const { onUpdateItem } = renderBill();
    const qtyInput = screen.getByLabelText('Quantity for Arthritis care package');

    fireEvent.change(qtyInput, { target: { value: '3' } });
    expect(onUpdateItem).toHaveBeenCalledWith('line-1', { qty: 3 });

    // A blank / zero entry cannot drop the quantity below one.
    fireEvent.change(qtyInput, { target: { value: '0' } });
    expect(onUpdateItem).toHaveBeenLastCalledWith('line-1', { qty: 1 });
  });

  it('derives the per-line max-discount hint from maxDiscountCents when no percent is set', () => {
    // No maxDiscountPercent, so the ceiling is read from cents: 2500 / 10000 = 25%.
    renderBill({ ...baseItem, maxDiscountPercent: undefined, maxDiscountCents: 2500 });

    expect(screen.getByText(/Max discount 25%/)).toBeInTheDocument();
  });

  it('withdraws the invoice total from the deposit when withdrawDeposit is set', () => {
    // Estimated total = 10000 gross − 1000 line discount = 9000 ($90).
    // Remaining deposit = max(0, 15000 − 9000) = 6000 ($60).
    renderBill(baseItem, { depositCents: 15000, withdrawDeposit: true });

    const remainingRow = screen.getByText('Remaining Deposit').closest('div');
    expect(remainingRow).toHaveTextContent('$60');
  });

  it('shows the exclusive-of-tax footer copy when a tax rate applies', () => {
    renderBill(baseItem, { taxPercent: 8 });
    expect(screen.getByText('Exclusive of 8% tax')).toBeInTheDocument();

    renderBill(baseItem, { taxPercent: 0 });
    expect(screen.getAllByText('No tax applied').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a line with no discount ceiling and no discount meta', () => {
    const plainItem: InvoiceLineItem = {
      id: 'line-plain',
      name: 'Nail trim',
      unitPriceCents: 3000,
      qty: 1,
      grossCents: 3000,
      discountCents: 0,
      amountCents: 3000,
    };
    const { onUpdateItem } = renderBill(plainItem);

    // No cap configured -> no "Max discount" hint, and the gross cell renders no
    // minus-discount caption because the line discount is 0.
    expect(screen.queryByText(/Max discount/)).not.toBeInTheDocument();

    // A non-numeric entry falls back to 0, and with no cap it passes straight through.
    fireEvent.change(screen.getByLabelText('Discount percent for Nail trim'), {
      target: { value: 'abc' },
    });
    expect(onUpdateItem).toHaveBeenCalledWith('line-plain', { discountCents: 0 });
  });

  it('treats a zero-gross line as 0% and derives no cap from cents', () => {
    const zeroGrossItem: InvoiceLineItem = {
      id: 'line-zero',
      name: 'Complimentary recheck',
      unitPriceCents: 0,
      qty: 1,
      grossCents: 0,
      discountCents: 0,
      amountCents: 0,
      // A cents ceiling is present, but a zero gross can't be turned into a percent.
      maxDiscountCents: 500,
    };
    renderBill(zeroGrossItem);

    expect(screen.getByLabelText('Discount percent for Complimentary recheck')).toHaveValue(0);
    expect(screen.queryByText(/Max discount/)).not.toBeInTheDocument();
  });

  it('shows no discount hint when the per-line cap is exactly 0', () => {
    renderBill({
      ...baseItem,
      maxDiscountPercent: 0,
      maxDiscountCents: undefined,
      discountCents: 0,
    });
    expect(screen.queryByText(/Max discount/)).not.toBeInTheDocument();
  });

  it('toggles withdraw-from-deposit', () => {
    const onToggleWithdrawDeposit = jest.fn();
    renderBill(baseItem, { onToggleWithdrawDeposit });

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onToggleWithdrawDeposit).toHaveBeenCalledWith(true);
  });

  it('removes a line via its trash control', () => {
    const onRemoveItem = jest.fn();
    renderBill({ ...baseItem, removable: true }, { onRemoveItem });

    fireEvent.click(screen.getByRole('button', { name: /remove arthritis care package/i }));

    expect(onRemoveItem).toHaveBeenCalledWith('line-1');
  });

  describe('search and add', () => {
    const vaccine: React.ComponentProps<typeof TotalBillContainer>['billableItems'][number] = {
      name: 'Rabies vaccine',
      kind: 'INVENTORY',
      unitPriceCents: 5000,
      qty: 1,
      grossCents: 5000,
      discountCents: 0,
      amountCents: 5000,
    };

    it('filters billables, renders a result row, and adds it without the display-only kind', () => {
      const { onAddItem } = renderBill(baseItem, { billableItems: [vaccine] });

      fireEvent.change(screen.getByLabelText('Search invoice items'), { target: { value: 'rab' } });

      fireEvent.click(screen.getByRole('button', { name: /rabies vaccine/i }));

      expect(onAddItem).toHaveBeenCalledTimes(1);
      const added = onAddItem.mock.calls[0][0];
      expect(added).toMatchObject({ name: 'Rabies vaccine', amountCents: 5000 });
      expect(added).not.toHaveProperty('kind');
    });

    it('adds the first match when the add-item button is pressed', () => {
      const { onAddItem } = renderBill(baseItem, { billableItems: [vaccine] });

      fireEvent.change(screen.getByLabelText('Search invoice items'), { target: { value: 'rab' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add invoice item' }));

      expect(onAddItem).toHaveBeenCalledTimes(1);
      expect(onAddItem.mock.calls[0][0]).not.toHaveProperty('kind');
    });

    it('adds nothing from the add-item button when there are no matches', () => {
      const { onAddItem } = renderBill(baseItem, { billableItems: [vaccine] });

      // No query typed, so matches[0] is undefined and the button is a no-op.
      fireEvent.click(screen.getByRole('button', { name: 'Add invoice item' }));

      expect(onAddItem).not.toHaveBeenCalled();
    });

    it('renders a match with no source pill when the billable has no kind', () => {
      renderBill(baseItem, {
        billableItems: [
          {
            name: 'Ear clean',
            unitPriceCents: 2000,
            qty: 1,
            grossCents: 2000,
            discountCents: 0,
            amountCents: 2000,
          },
        ],
      });

      fireEvent.change(screen.getByLabelText('Search invoice items'), { target: { value: 'ear' } });

      expect(screen.getByRole('button', { name: /ear clean/i })).toBeInTheDocument();
      // With no kind, none of the source pills are rendered.
      expect(screen.queryByText('Stock item')).not.toBeInTheDocument();
    });

    it('closes the results dropdown on an outside press', () => {
      renderBill(baseItem, { billableItems: [vaccine] });

      fireEvent.change(screen.getByLabelText('Search invoice items'), { target: { value: 'rab' } });
      expect(screen.getByRole('button', { name: /rabies vaccine/i })).toBeInTheDocument();

      // A press outside the search anchor and panel clears the query and closes the list.
      fireEvent.mouseDown(document.body);

      expect(screen.queryByRole('button', { name: /rabies vaccine/i })).not.toBeInTheDocument();
    });
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

    it('treats a cleared / non-numeric overall discount as 0', () => {
      const { onChangeOverallDiscount } = renderBill(baseItem, {
        maxOverallDiscountPercent: 20,
      });

      // Clearing the field yields Number.parseFloat('') === NaN, so the `|| 0`
      // fallback takes over: the discount reads as 0, which is under the cap.
      fireEvent.change(overallDiscountInput(), { target: { value: '' } });

      expect(onChangeOverallDiscount).toHaveBeenCalledWith(0);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
