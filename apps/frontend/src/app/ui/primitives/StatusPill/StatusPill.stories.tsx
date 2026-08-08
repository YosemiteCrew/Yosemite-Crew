import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import StatusPill from './StatusPill';
// `.appointment-status` is the design-system micro-badge this primitive replaces.
// The comparison story renders it side by side so the geometry stays honest.
import '../../tables/DataTable.css';

const meta = {
  title: 'Primitives/StatusPill',
  component: StatusPill,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one status badge for the app: 10px/700 uppercase, +0.08em, 3px 10px padding, full radius. Colour is the only thing callers vary - via `tone`, `tokens`, or a `style` passthrough for features whose helpers already resolve a status colour.',
      },
    },
  },
  tags: ['autodocs'],
  args: { label: 'Awaiting payment' },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill label="Paid" tone="success" />
      <StatusPill label="Awaiting payment" tone="info" />
      <StatusPill label="Pending" tone="neutral" />
      <StatusPill label="In progress" tone="progress" />
      <StatusPill label="Cancelled" tone="warning" />
      <StatusPill label="Overdue" tone="danger" />
      <StatusPill label="Draft" tone="accent" />
      <StatusPill label="Live" tone="success" showDot />
    </div>
  ),
};

/**
 * The badge must hug its label even as the only child of a flex column, whose
 * default `align-items: stretch` would otherwise pull it into a full-width band.
 */
export const InFlexColumn: Story = {
  render: () => (
    <div className="flex w-[320px] flex-col gap-2 rounded-2xl border border-[var(--hairline)] p-4">
      <span className="text-[13px] font-semibold">Amoxicillin 250mg</span>
      <StatusPill label="Low stock" tone="warning" />
    </div>
  ),
};

/**
 * Geometry proof: the primitive and the design-system `.appointment-status`
 * badge it replaces must render at the same size for the same label.
 */
export const MatchesDesignSpec: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <span data-testid="pill-primitive" className="contents">
        <StatusPill label="Awaiting payment" tone="info" />
      </span>
      <span data-testid="pill-spec" className="contents">
        <span className="appointment-status">Awaiting payment</span>
      </span>
    </div>
  ),
};
