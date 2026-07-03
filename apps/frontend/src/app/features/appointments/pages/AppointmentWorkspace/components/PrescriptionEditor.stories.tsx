import type { Meta, StoryObj } from '@storybook/react';
import PrescriptionEditor from './PrescriptionEditor';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

// Seeded prescriptions for visual verification of the Treatment-step Prescription
// section (Bug 8: the printer button now prints each saved item's label PDF).
const items: PrescriptionItem[] = [
  {
    id: 'rx-1',
    medicineName: 'Amoxicillin 625mg',
    dosage: '1 tab',
    route: 'Oral',
    frequency: 'BID',
    durationDays: '5 days',
    refill: 'x2',
    instructions: 'Give with food',
    fulfillment: 'IN_HOUSE',
    priceCents: 16500,
    stockQty: 14,
  },
  {
    id: 'rx-2',
    medicineName: 'Prednisone 10mg',
    dosage: '10mg',
    route: 'Oral',
    frequency: 'QD',
    durationDays: '5 days',
    refill: 'x1',
    instructions: 'Morning with food',
    fulfillment: 'IN_HOUSE',
    priceCents: 9000,
    stockQty: 3,
    lowStock: true,
  },
];

const meta = {
  title: 'Workspace/PrescriptionEditor',
  component: PrescriptionEditor,
  args: {
    items,
    readOnly: false,
    onAddItem: () => undefined,
    onUpdateItem: () => undefined,
    onRemoveItem: () => undefined,
    onPrint: () => undefined,
  },
} satisfies Meta<typeof PrescriptionEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSavedPrescriptions: Story = {};

export const Empty: Story = {
  args: { items: [] },
};
