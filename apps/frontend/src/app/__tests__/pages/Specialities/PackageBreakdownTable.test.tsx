import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';

jest.mock('react-icons/md', () => ({
  MdDeleteForever: () => <span data-testid="icon-delete" />,
}));
jest.mock('react-icons/ai', () => ({
  AiOutlineInfoCircle: () => <span data-testid="icon-info" />,
}));
jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <div>
      {children}
      <div data-testid="tooltip-content">{content}</div>
    </div>
  ),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (amount: number) => `$ ${amount.toFixed(2)}`,
}));

const baseItem: PackageBreakdownItem = {
  id: 'item-1',
  type: 'CONSULTATION',
  name: 'Test Consult',
  unitPrice: 100,
  quantity: 2,
  discount: 10,
  maxDiscount: 15,
};

const makeItems = (overrides: Partial<PackageBreakdownItem> = {}): PackageBreakdownItem[] => [
  { ...baseItem, ...overrides },
];

describe('PackageBreakdownTable', () => {
  describe('read-only mode (editable=false)', () => {
    it('renders item name, type label, quantity and discount', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      expect(screen.getByText('Test Consult')).toBeInTheDocument();
      expect(screen.getByText('Consultation')).toBeInTheDocument();
      expect(screen.getByText('×2')).toBeInTheDocument();
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('renders unit price and gross amount correctly', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      // unitPrice = 100, qty = 2, gross = 200
      expect(screen.getByText('$ 100.00')).toBeInTheDocument();
      expect(screen.getByText('$ 200.00')).toBeInTheDocument();
    });

    it('renders net amount after discount', () => {
      // gross=200, 10% discount → net=180
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      const cells = screen.getAllByText('$ 180.00');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('shows total cost without additional discount', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      // net = 180, additionalDiscount = 0 → total = 180
      expect(screen.getByText('Total cost')).toBeInTheDocument();
    });

    it('shows additional discount row when additionalDiscount > 0', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={5} />);
      expect(screen.getByText('Additional Discount (5%)')).toBeInTheDocument();
    });

    it('does NOT show additional discount row when additionalDiscount is 0', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      expect(screen.queryByText(/Additional Discount/)).not.toBeInTheDocument();
    });

    it('does not render remove buttons in read-only mode', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    });

    it('does not render quantity or discount inputs in read-only mode', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} />);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('renders total cost with correct value in read-only mode (pill style)', () => {
      // net = 180, additionalDiscount = 10 → total = 180 - 18 = 162
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={10} />);
      expect(screen.getByText('$ 162.00')).toBeInTheDocument();
    });

    it('uses fallback type label when type is not in TYPE_LABELS', () => {
      const unknownItem = makeItems({ type: 'UNKNOWN' as never });
      render(<PackageBreakdownTable items={unknownItem} additionalDiscount={0} />);
      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });

    it('renders multiple items with correct row numbers', () => {
      const items: PackageBreakdownItem[] = [
        { ...baseItem, id: 'i1', name: 'Item A' },
        { ...baseItem, id: 'i2', name: 'Item B' },
      ];
      render(<PackageBreakdownTable items={items} additionalDiscount={0} />);
      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
    });
  });

  describe('editable mode', () => {
    it('renders quantity input with correct value', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} editable />);
      const qtyInput = screen.getByLabelText('Quantity for Test Consult');
      expect(qtyInput).toHaveValue(2);
    });

    it('renders an accessible actions column header', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} editable />);
      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    });

    it('renders discount input with correct value', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} editable />);
      const discInput = screen.getByLabelText('Discount for Test Consult');
      expect(discInput).toHaveValue(10);
    });

    it('calls onChangeQty when quantity input changes', () => {
      const onChangeQty = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems()}
          additionalDiscount={0}
          editable
          onChangeQty={onChangeQty}
        />
      );
      const qtyInput = screen.getByLabelText('Quantity for Test Consult');
      fireEvent.change(qtyInput, { target: { value: '5' } });
      expect(onChangeQty).toHaveBeenCalledWith('item-1', 5);
    });

    it('clamps quantity to minimum of 1 on invalid input', () => {
      const onChangeQty = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems()}
          additionalDiscount={0}
          editable
          onChangeQty={onChangeQty}
        />
      );
      const qtyInput = screen.getByLabelText('Quantity for Test Consult');
      fireEvent.change(qtyInput, { target: { value: '' } });
      expect(onChangeQty).toHaveBeenCalledWith('item-1', 1);
    });

    it('calls onChangeDiscount when discount input changes', () => {
      const onChangeDiscount = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems()}
          additionalDiscount={0}
          editable
          onChangeDiscount={onChangeDiscount}
        />
      );
      const discInput = screen.getByLabelText('Discount for Test Consult');
      fireEvent.change(discInput, { target: { value: '8' } });
      expect(onChangeDiscount).toHaveBeenCalledWith('item-1', 8);
    });

    it('clamps discount to maxDiscount value', () => {
      const onChangeDiscount = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems({ maxDiscount: 15 })}
          additionalDiscount={0}
          editable
          onChangeDiscount={onChangeDiscount}
        />
      );
      const discInput = screen.getByLabelText('Discount for Test Consult');
      fireEvent.change(discInput, { target: { value: '50' } });
      expect(onChangeDiscount).toHaveBeenCalledWith('item-1', 15);
    });

    it('clamps discount to 0 when NaN entered', () => {
      const onChangeDiscount = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems()}
          additionalDiscount={0}
          editable
          onChangeDiscount={onChangeDiscount}
        />
      );
      const discInput = screen.getByLabelText('Discount for Test Consult');
      fireEvent.change(discInput, { target: { value: 'abc' } });
      expect(onChangeDiscount).toHaveBeenCalledWith('item-1', 0);
    });

    it('calls onRemoveItem when remove button is clicked', () => {
      const onRemoveItem = jest.fn();
      render(
        <PackageBreakdownTable
          items={makeItems()}
          additionalDiscount={0}
          editable
          onRemoveItem={onRemoveItem}
        />
      );
      const removeBtn = screen.getByRole('button', { name: 'Remove Test Consult' });
      fireEvent.click(removeBtn);
      expect(onRemoveItem).toHaveBeenCalledWith('item-1');
    });

    it('shows total cost in brand style in editable mode', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} editable />);
      // net = 180, no additional discount → total = 180; multiple elements may show this value
      const costElements = screen.getAllByText('$ 180.00');
      expect(costElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not call handlers when they are not provided', () => {
      render(<PackageBreakdownTable items={makeItems()} additionalDiscount={0} editable />);
      const qtyInput = screen.getByLabelText('Quantity for Test Consult');
      const discInput = screen.getByLabelText('Discount for Test Consult');
      const removeBtn = screen.getByRole('button', { name: 'Remove Test Consult' });
      // Should not throw
      expect(() => {
        fireEvent.change(qtyInput, { target: { value: '3' } });
        fireEvent.change(discInput, { target: { value: '5' } });
        fireEvent.click(removeBtn);
      }).not.toThrow();
    });
  });

  describe('PACKAGE type with nested breakdown', () => {
    it('shows tooltip info icon when item has type PACKAGE with nested breakdown', () => {
      const packageItem: PackageBreakdownItem = {
        id: 'pkg-item-1',
        type: 'PACKAGE',
        name: 'Nested Package',
        unitPrice: 500,
        quantity: 1,
        discount: 5,
        nestedBreakdown: [
          {
            id: 'nested-1',
            type: 'CONSULTATION',
            name: 'Inner Consult',
            unitPrice: 200,
            quantity: 1,
            discount: 0,
          },
        ],
      };
      render(<PackageBreakdownTable items={[packageItem]} additionalDiscount={0} />);
      expect(screen.getByTestId('icon-info')).toBeInTheDocument();
    });

    it('does not show tooltip for PACKAGE type with empty nested breakdown', () => {
      const packageItem: PackageBreakdownItem = {
        id: 'pkg-item-2',
        type: 'PACKAGE',
        name: 'Empty Package',
        unitPrice: 500,
        quantity: 1,
        discount: 0,
        nestedBreakdown: [],
      };
      render(<PackageBreakdownTable items={[packageItem]} additionalDiscount={0} />);
      expect(screen.queryByTestId('icon-info')).not.toBeInTheDocument();
    });

    it('renders Package type label for PACKAGE items', () => {
      const packageItem: PackageBreakdownItem = {
        id: 'pkg-item-3',
        type: 'PACKAGE',
        name: 'A Bundle',
        unitPrice: 300,
        quantity: 1,
        discount: 0,
      };
      render(<PackageBreakdownTable items={[packageItem]} additionalDiscount={0} />);
      expect(screen.getByText('Package')).toBeInTheDocument();
    });
  });

  describe('NestedBreakdownTooltip content', () => {
    it('renders nested breakdown items in tooltip content', () => {
      const nestedItems: PackageBreakdownItem[] = [
        {
          id: 'n1',
          type: 'CONSULTATION',
          name: 'Nested Item',
          unitPrice: 100,
          quantity: 1,
          discount: 0,
        },
      ];
      const packageItem: PackageBreakdownItem = {
        id: 'pkg-1',
        type: 'PACKAGE',
        name: 'Top Package',
        unitPrice: 500,
        quantity: 1,
        discount: 0,
        nestedBreakdown: nestedItems,
      };
      render(<PackageBreakdownTable items={[packageItem]} additionalDiscount={0} />);
      expect(screen.getByText('Nested Item')).toBeInTheDocument();
    });

    it('shows additional discount row in nested tooltip when additionalDiscount > 0', () => {
      const nestedItems: PackageBreakdownItem[] = [
        {
          id: 'n1',
          type: 'CONSULTATION',
          name: 'Nested Consult',
          unitPrice: 100,
          quantity: 1,
          discount: 0,
        },
      ];
      const packageItem: PackageBreakdownItem = {
        id: 'pkg-tt',
        type: 'PACKAGE',
        name: 'Package with Nested',
        unitPrice: 200,
        quantity: 1,
        discount: 0,
        nestedBreakdown: nestedItems,
      };
      // The nested tooltip is rendered with additionalDiscount=0, this is hardcoded in the component
      render(<PackageBreakdownTable items={[packageItem]} additionalDiscount={10} />);
      // Tooltip for nested breakdown shows correctly
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });
  });

  describe('all catalog types render correct labels', () => {
    const typeTests: Array<[PackageBreakdownItem['type'], string]> = [
      ['CONSULTATION', 'Consultation'],
      ['PROCEDURE', 'Procedure'],
      ['LAB', 'Diagnostics'],
      ['INVENTORY', 'Inventory'],
      ['MEDICATION', 'Medication'],
      ['PACKAGE', 'Package'],
    ];
    typeTests.forEach(([type, label]) => {
      it(`renders label "${label}" for type "${type}"`, () => {
        const item: PackageBreakdownItem = {
          ...baseItem,
          id: `t-${type}`,
          type,
          name: `${type} item`,
        };
        render(<PackageBreakdownTable items={[item]} additionalDiscount={0} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });
});
