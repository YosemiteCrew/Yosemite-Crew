import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import PaginatedGridTable, { GridHeaderCell } from './PaginatedGridTable';

type Row = {
  id: string;
  item: string;
  sku: string;
  category: string;
  status: 'Healthy' | 'Low stock' | 'Expired';
  onHand: string;
  amount: string;
};

// Mirrors the inventory design track: item · category · health · on-hand · amount · actions.
const GRID_COLUMNS = '1.7fr 1fr 120px 96px 96px 72px';

const HEADER_CELLS: GridHeaderCell[] = [
  { label: 'Item' },
  { label: 'Category' },
  { label: 'Stock health' },
  { label: 'On hand', align: 'right' },
  { label: 'Amount', align: 'right' },
  { label: '' },
];

const STATUS_STYLE: Record<Row['status'], CSSProperties> = {
  Healthy: {
    color: 'var(--color-pill-success-text)',
    backgroundColor: 'var(--color-pill-success-bg)',
    borderColor: 'var(--color-pill-success-border)',
  },
  'Low stock': {
    color: 'var(--color-pill-warning-text)',
    backgroundColor: 'var(--color-pill-warning-bg)',
    borderColor: 'var(--color-pill-warning-border)',
  },
  Expired: {
    color: 'var(--color-danger-600)',
    backgroundColor: 'var(--color-danger-100)',
    borderColor: 'var(--color-danger-400)',
  },
};

const STATUSES: Row['status'][] = ['Healthy', 'Low stock', 'Expired', 'Healthy'];

const ROWS: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: `row-${i + 1}`,
  item: `Carprofen ${50 + i * 10} mg`,
  sku: `MED-${String(1000 + i)}`,
  category: 'Pharmacy',
  status: STATUSES[i % STATUSES.length],
  onHand: `${(i * 7) % 60} u`,
  amount: `€${(i * 3.5 + 1.68).toFixed(2)}`,
}));

// The design status badge: fully round, padding 3px 9px, 9.5px / 700, no tracking.
const StatusPill = ({ status }: { status: Row['status'] }) => (
  <span
    className="inline-flex items-center rounded-full border px-[9px] py-[3px] text-[9.5px] font-bold uppercase whitespace-nowrap"
    style={STATUS_STYLE[status]}
  >
    {status}
  </span>
);

const renderRow = (row: Row) => (
  <div
    key={row.id}
    className="grid items-center gap-2.5 border-t border-card-border px-5 py-2.5 text-[13px] text-text-primary"
    style={{ gridTemplateColumns: GRID_COLUMNS }}
  >
    <div className="min-w-0">
      <div className="truncate text-[13.5px] font-bold leading-tight text-[var(--ink)]">
        {row.item}
      </div>
      <div className="text-[11px] tabular-nums text-text-tertiary">{row.sku}</div>
    </div>
    <div className="truncate text-[12.5px] text-text-secondary">{row.category}</div>
    <div>
      <StatusPill status={row.status} />
    </div>
    <div className="text-right tabular-nums">{row.onHand}</div>
    <div className="text-right tabular-nums">{row.amount}</div>
    <div />
  </div>
);

const renderCard = (row: Row) => (
  <div
    key={row.id}
    className="w-full rounded-2xl border border-card-border bg-neutral-0 p-3 sm:w-[calc(50%-12px)]"
  >
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-[13.5px] font-bold text-[var(--ink)]">{row.item}</span>
      <StatusPill status={row.status} />
    </div>
    <div className="mt-1 text-[11.5px] text-text-tertiary">
      {row.category} · {row.onHand} · {row.amount}
    </div>
  </div>
);

const meta = {
  title: 'Tables/PaginatedGridTable',
  component: PaginatedGridTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shared grid-table shell behind Inventory and Dispensary. Sticky uppercase header ' +
          '(10.5px / 700 / 0.1em tracking / --ink-faint on --screen-2), a caller grid track shared ' +
          'by header and rows, a paginated desktop table that swaps to wrapped cards at <=1023px, ' +
          'and a footer summary with Back/Next paging.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: 560, minWidth: 0, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaginatedGridTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: ROWS.slice(0, 6),
    pageSize: 8,
    gridColumns: GRID_COLUMNS,
    headerCells: HEADER_CELLS,
    itemNoun: 'items',
    renderRow,
    renderCard,
  },
};

export const WithPagination: Story = {
  name: 'With pagination (14 rows, 8/page)',
  args: { ...Default.args, rows: ROWS },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { ...Default.args, rows: [] },
  parameters: {
    docs: {
      description: { story: 'No rows renders the quiet-day placeholder and "No items" footer.' },
    },
  },
};
