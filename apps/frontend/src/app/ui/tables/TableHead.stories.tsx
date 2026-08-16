import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import React from 'react';

import TableHead from './TableHead';
import GenericTable from './GenericTable/GenericTable';

const meta: Meta<typeof TableHead> = {
  title: 'Tables/TableHead',
  component: TableHead,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The column-header band for list shells that are not a `<table>`. PIMS grew five of these by hand and they drifted apart, so one page could show three header sizes over the same `--screen-2` band. `Consistency` below is the story that matters: it renders the real `<table>` header beside every shell variant, so any future drift shows up as a Chromatic diff rather than as a bug report.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TableHead>;

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'speciality', label: 'Speciality' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
];

const TRACK = '1.6fr 1fr 1fr 110px 44px';

const Row = ({ track }: { track: string }) => (
  <div
    className="grid items-center border-b border-[var(--hairline)] px-5 py-3 text-[14px] text-[var(--ink-body)]"
    style={{ gridTemplateColumns: track, gap: '10px' }}
  >
    <span>Dr. Smith</span>
    <span>Veterinarian</span>
    <span>Cardiology</span>
    <span>Available</span>
    <span aria-hidden="true" />
  </div>
);

export const Default: Story = {
  args: { columns: COLUMNS, track: TRACK },
  render: (args) => (
    <div className="TableShell">
      <TableHead {...args} />
      <Row track={args.track} />
      <Row track={args.track} />
    </div>
  ),
};

export const NotSticky: Story = {
  name: 'Inside a drawer (not sticky)',
  args: { columns: COLUMNS, track: TRACK, sticky: false },
  render: (args) => (
    <div className="TableShell">
      <TableHead {...args} />
      <Row track={args.track} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Side modals and drawers are transformed containers, so `position: sticky` resolves against the wrong ancestor and strands the band mid-panel. Pass `sticky={false}` there.',
      },
    },
  },
};

export const RightAligned: Story = {
  name: 'Numeric columns',
  args: {
    columns: [
      { key: 'item', label: 'Item' },
      { key: 'qty', label: 'Qty', align: 'right' as const },
      { key: 'gross', label: 'Gross', align: 'right' as const },
      { key: 'amount', label: 'Amount', align: 'right' as const },
    ],
    track: 'minmax(0,1.7fr) 72px 130px 120px',
  },
  render: (args) => (
    <div className="TableShell">
      <TableHead {...args} />
    </div>
  ),
};

/**
 * The regression guard. If a shell's header ever drifts from the table's, these
 * two bands stop matching and Chromatic flags the diff.
 */
export const Consistency: StoryObj = {
  name: 'Consistency — table vs shell',
  parameters: {
    docs: {
      description: {
        story:
          'The real `<table>` header and the shell header, stacked. They must be indistinguishable: same 10.5px/700, same 0.1em tracking, same `--screen-2` band, same closing hairline. A visual diff here is the drift this component exists to prevent.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-[12px] text-[var(--ink-faint)]">
          GenericTable — real &lt;table&gt;
        </p>
        <GenericTable
          data={[{ name: 'Dr. Smith', role: 'Veterinarian', speciality: 'Cardiology' }]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role' },
            { key: 'speciality', label: 'Speciality' },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-[12px] text-[var(--ink-faint)]">TableHead — grid shell</p>
        <div className="TableShell">
          <TableHead
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'speciality', label: 'Speciality' },
            ]}
            track="1.6fr 1fr 1fr"
          />
          <Row track="1.6fr 1fr 1fr" />
        </div>
      </div>
    </div>
  ),
};
