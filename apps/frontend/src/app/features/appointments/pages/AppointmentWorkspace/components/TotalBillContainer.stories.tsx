import type { Meta, StoryObj } from '@storybook/react';
import TotalBillContainer from './TotalBillContainer';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';

// Total Bill seeded with lines mapped from saved Treatment items (Bug 9: saved
// Services/Packages + in-house prescriptions now auto-appear in the Total Bill so
// they are billable/payable without re-adding each by search).
const items: InvoiceLineItem[] = [
  {
    id: 'inv-1',
    name: 'Dental cleaning',
    unitPriceCents: 5000,
    qty: 2,
    grossCents: 10000,
    discountCents: 0,
    amountCents: 10000,
  },
  {
    id: 'inv-2',
    name: 'Amoxicillin (in-house)',
    unitPriceCents: 800,
    qty: 1,
    grossCents: 800,
    discountCents: 0,
    amountCents: 800,
  },
];

const meta = {
  title: 'Workspace/TotalBillContainer',
  component: TotalBillContainer,
  args: {
    items,
    billableItems: [],
    currency: 'USD',
    depositCents: 0,
    withdrawDeposit: false,
    overallDiscountPercent: 0,
    taxPercent: 8,
    incompleteItemNames: new Set<string>(),
    onToggleWithdrawDeposit: () => undefined,
    onChangeOverallDiscount: () => undefined,
    onAddItem: () => undefined,
    onUpdateItem: () => undefined,
    onRemoveItem: () => undefined,
  },
} satisfies Meta<typeof TotalBillContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

// Subtotal $108.00, Estimated/Total $108.00, caption "Exclusive of 8% tax".
export const SavedItemsInBill: Story = {};

// Overall discount 10% -> -$10.80 -> Total $97.20.
export const WithOverallDiscount: Story = {
  args: { overallDiscountPercent: 10 },
};
