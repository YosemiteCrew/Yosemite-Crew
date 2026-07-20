import type { Meta, StoryObj } from '@storybook/react';
import DispensaryTable from './DispensaryTable';
import type { DispensaryRecord } from '@/app/features/inventory/pages/Inventory/types';

const record = (
  id: string,
  status: DispensaryRecord['status'],
  overrides: Partial<DispensaryRecord> = {}
): DispensaryRecord => ({
  id,
  prescriptionId: `RX-${id}`,
  patient: { name: 'Poppy', appointmentId: 'AP-2043', petBreed: 'Beagle' },
  status,
  prescriptionItems: ['Carprofen 50 mg', 'Nobivac Rabies 1 ml'],
  prescriptionCreated: '2026-06-30T09:12:00.000Z',
  amountCents: 8620,
  currency: 'USD',
  lead: 'Ruth Baumann',
  petParentName: 'Lena Hartmann',
  location: 'Shelf B2',
  requestType: 'PATIENT',
  items: [
    { name: 'Carprofen 50 mg', quantity: 14, priceCents: 168 },
    { name: 'Nobivac Rabies 1 ml', quantity: 1, priceCents: 2480 },
  ],
  ...overrides,
});

const ROWS: DispensaryRecord[] = [
  record('1', 'PENDING'),
  record('2', 'DISPENSED', {
    patient: { name: 'Biscuit', appointmentId: 'AP-2042', petBreed: 'Domestic Shorthair' },
    petParentName: 'Martha Ellis',
    timeDispensed: '2026-06-30T10:31:00.000Z',
    amountCents: 5837,
  }),
  record('3', 'NOT_DISPENSED', {
    patient: { name: 'Bruno', appointmentId: 'AP-2041', petBreed: 'German Shepherd' },
    petParentName: 'Amelia Ross',
    amountCents: 4200,
  }),
];

const meta = {
  title: 'Tables/DispensaryTable',
  component: DispensaryTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dispensary request queue rendered through the shared PaginatedGridTable shell. ' +
          'Status badges follow the design micro-badge (fully round, padding 3px 9px, 9.5px / 700, ' +
          'no tracking). Swaps to wrapped cards at <=1023px.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DispensaryTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    filteredList: ROWS,
    onView: () => {},
    onDispense: () => {},
  },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { filteredList: [], onView: () => {} },
};
