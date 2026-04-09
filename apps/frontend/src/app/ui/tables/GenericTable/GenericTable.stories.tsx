import type { Meta, StoryObj } from '@storybook/react';
import GenericTable from './GenericTable';
import type { Column } from './GenericTable';

type User = { id: number; name: string; role: string; status: string };

const getRoleByIndex = (index: number): User['role'] => {
  if (index % 3 === 0) return 'Admin';
  if (index % 3 === 1) return 'Vet';
  return 'Technician';
};

const COLUMNS: Column<User>[] = [
  { label: 'Name', key: 'name' },
  { label: 'Role', key: 'role' },
  {
    label: 'Status',
    key: 'status',
    render: (row) => (
      <span
        className={`px-2 py-0.5 rounded-full text-caption-1 ${
          row.status === 'Active'
            ? 'bg-status-success-bg text-status-success-text'
            : 'bg-card-bg text-text-secondary'
        }`}
      >
        {row.status}
      </span>
    ),
  },
];

const DATA: User[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `Team member ${i + 1}`,
  role: getRoleByIndex(i),
  status: i % 4 === 0 ? 'Inactive' : 'Active',
}));

const meta = {
  title: 'Tables/GenericTable',
  component: GenericTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Fully generic typed table. Accepts `columns` with optional custom `render` functions. ' +
          'Supports client-side pagination with `Back`/`Next` navigation. Empty-state row built in.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    bordered: { control: 'boolean' },
    pagination: { control: 'boolean' },
    pageSize: { control: 'number' },
  },
} satisfies Meta<typeof GenericTable<User>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: DATA.slice(0, 5), columns: COLUMNS },
};

export const WithPagination: Story = {
  name: 'With pagination (25 rows, page 10)',
  args: { data: DATA, columns: COLUMNS, pagination: true, pageSize: 10 },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { data: [], columns: COLUMNS },
  parameters: {
    docs: { description: { story: 'Empty data renders a "quiet day" placeholder row.' } },
  },
};
