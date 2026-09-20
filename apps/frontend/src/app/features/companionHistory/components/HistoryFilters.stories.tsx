import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  getHistoryFilters,
  type HistoryFilterKey,
} from '@/app/features/companionHistory/types/history';
import HistoryFilters from './HistoryFilters';

const FILTERS = getHistoryFilters('HOSPITAL');

/**
 * `activeFilter` is a prop, so the bare component never moves on its own. The
 * hook lives in a named component rather than in `render`, which
 * `react-hooks/rules-of-hooks` rejects.
 */
const ControlledHistoryFilters = (args: ComponentProps<typeof HistoryFilters>) => {
  const [active, setActive] = useState<HistoryFilterKey>(args.activeFilter);
  return (
    <HistoryFilters
      {...args}
      activeFilter={active}
      onChange={(next) => {
        setActive(next);
        args.onChange(next);
      }}
    />
  );
};

const meta = {
  title: 'CompanionHistory/HistoryFilters',
  component: HistoryFilters,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The history section tabs as a `SubLabels` pill group: All, Appointments, ' +
          'Diagnostics, Medical records, Tasks, Billing and Audit trail. It is fully ' +
          'controlled - `activeFilter` is a prop and `onChange` hands back the ' +
          '`HistoryFilterKey` - so the timeline that owns it decides what a tab switch ' +
          'means (a refetch with a `types` filter, or the audit endpoint).\n\n' +
          'The pills are real `role="tab"` buttons inside a `tablist`, with ' +
          '`aria-selected` on the active one, which is what makes the row keyboard- and ' +
          'screen-reader-navigable rather than seven look-alike buttons.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filters: FILTERS,
    activeFilter: 'ALL',
    onChange: fn(),
  },
} satisfies Meta<typeof HistoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllActive: Story = {
  name: 'All selected',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All',
      'Appointments',
      'Diagnostics',
      'Medical records',
      'Tasks',
      'Billing',
      'Audit trail',
    ]);
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tab', { name: 'Tasks' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    await userEvent.click(canvas.getByRole('tab', { name: 'Appointments' }));
    // The handler is given the KEY, not the label - the timeline maps the key to a types filter.
    await expect(args.onChange).toHaveBeenCalledWith('APPOINTMENT');
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    // And the bare component does not move by itself.
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  },
};

export const Controlled: Story = {
  name: 'Switching tabs',
  render: (args) => <ControlledHistoryFilters {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Medical records' }));
    await expect(args.onChange).toHaveBeenCalledWith('MEDICAL_RECORDS');
    await expect(canvas.getByRole('tab', { name: 'Medical records' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    // Exactly one selected at any time.
    await expect(
      canvas.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')
    ).toHaveLength(1);
  },
};

export const AuditTrailActive: Story = {
  name: 'Audit trail selected',
  args: { activeFilter: 'AUDIT_TRAIL' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('tab', { name: 'Audit trail' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  },
};

export const Phone: Story = {
  name: 'Phone: pills wrap',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await expect(tabs).toHaveLength(7);
    // Seven pills do not fit one 375px row: the group wraps rather than overflowing.
    const tops = new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
    await expect(tops.size).toBeGreaterThan(1);
    for (const tab of tabs) {
      await expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth + 1);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
