import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import FilterChip from './FilterChip';

const meta = {
  title: 'Filters/FilterChip',
  component: FilterChip,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one filter-chip recipe for list toolbars: sentence case, 12.5px, pill, hairline ' +
          'outline at rest and the solid ink pill when active. Counts live inside the chip, and an ' +
          'optional status dot marks rows like Emergencies. Templates and Finance previously used ' +
          'the ALL-CAPS status pill as a filter, which made a filter row read as a row of statuses.',
      },
    },
  },
  tags: ['autodocs'],
  args: { label: 'Upcoming', active: false, onClick: () => {} },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};

export const Active: Story = { args: { active: true } };

export const WithCount: Story = { name: 'With count', args: { label: 'Completed', count: 271 } };

export const WithDot: Story = {
  name: 'With status dot',
  args: { label: 'Emergencies', dotColor: 'var(--danger)' },
};

const Row = () => {
  const options = [
    { key: 'all', label: 'All', count: 322 },
    { key: 'requested', label: 'Requested', count: 4 },
    { key: 'upcoming', label: 'Upcoming', count: 18 },
    { key: 'checked-in', label: 'Checked in', count: 6 },
    { key: 'completed', label: 'Completed', count: 271 },
  ];
  const [active, setActive] = useState('all');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          count={option.count}
          active={option.key === active}
          onClick={() => setActive(option.key)}
        />
      ))}
    </div>
  );
};

export const ToolbarRow: Story = {
  name: 'Toolbar row',
  render: () => <Row />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /All 322/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await userEvent.click(canvas.getByRole('button', { name: /Upcoming 18/ }));
    await expect(canvas.getByRole('button', { name: /Upcoming 18/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: /All 322/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  },
};

export const ToolbarRowDark: Story = {
  name: 'Toolbar row (dark)',
  render: () => <Row />,
  globals: { theme: 'dark' },
};
