import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
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

/* `itemNoun` is required (a5e6eddb0): it names the records in the footer and the
   empty state, so a table cannot fall back to a generic "No records yet". */
export const Default: Story = {
  args: { data: DATA.slice(0, 5), columns: COLUMNS, itemNoun: 'team members' },
};

export const WithPagination: Story = {
  name: 'With pagination (25 rows, page 10)',
  args: { data: DATA, columns: COLUMNS, pagination: true, pageSize: 10, itemNoun: 'team members' },
};

export const EmptyState: Story = {
  name: 'Empty state',
  args: { data: [], columns: COLUMNS, itemNoun: 'team members' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both lines of the empty state are derived from the noun.
    await expect(canvas.getByText('No team members yet')).toBeInTheDocument();
    await expect(
      canvas.getByText('Team members appear here as soon as there are any.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty data renders a placeholder row whose copy is derived from the required ' +
          '`itemNoun`, so each table names its own records.',
      },
    },
  },
};
