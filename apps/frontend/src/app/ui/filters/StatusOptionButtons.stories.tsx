import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import { AppointmentLabels, statusLabel } from '../../constants/status';
import StatusOptionButtons, { type StatusOptionButtonsOption } from './StatusOptionButtons';

/**
 * Every caller passes options that already carry their own text token, so the
 * stories use the same shape rather than a colour map of their own.
 */
type FilterOption = StatusOptionButtonsOption & { text: string };

/**
 * The neutral "all" row takes plain primary ink; each real status keeps its own
 * `--status-*-text` token so the row reads as the status it filters to.
 */
const getTextColor = (option: FilterOption): string =>
  option.key === 'ALL' ? 'var(--color-text-primary)' : option.text;

const ALL_OPTION = statusLabel('All', 'ALL', 'color-badge-blue', 'var(--color-primary-500)');

const APPOINTMENT_OPTIONS: FilterOption[] = [ALL_OPTION, ...AppointmentLabels];

const STOCK_HEALTH_OPTIONS: FilterOption[] = [
  ALL_OPTION,
  statusLabel('Healthy', 'HEALTHY', 'color-pill-success'),
  statusLabel('Low stock', 'LOW_STOCK', 'color-pill-progress'),
  statusLabel('Expiring soon', 'EXPIRING_SOON', 'color-pill-info'),
  statusLabel('Expired', 'EXPIRED', 'color-pill-warning'),
];

const meta = {
  title: 'Filters/StatusOptionButtons',
  component: StatusOptionButtons<FilterOption>,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "The option rows inside every status-filter dropdown: a dot swatch in the option's border " +
          'colour, the name in its own text colour, and a trailing check on the active row. It owns ' +
          'nothing else - the trigger, the portal, the panel chrome and the selection state all stay ' +
          'with the caller, which is why the stories supply the `yc-glass-overlay` panel around it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    options: APPOINTMENT_OPTIONS,
    allKey: 'ALL',
    activeKey: 'ALL',
    onSelect: fn(),
    getTextColor,
  },
  decorators: [
    (StoryFn) => (
      <div className="yc-glass-overlay rounded-2xl overflow-hidden" style={{ minWidth: 200 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusOptionButtons<FilterOption>>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The resting panel: "All" is active, so it carries the check but not the
 * active font weight - it is the neutral row, not a status.
 */
export const Default: Story = {};

export const StatusSelected: Story = {
  name: 'Status selected',
  args: { activeKey: 'in_progress' },
  parameters: {
    docs: {
      description: {
        story:
          'A real status is active. Unlike the "all" row it takes `font-medium`, and both the check ' +
          'and the label render in the status text token rather than plain ink.',
      },
    },
  },
};

export const StockHealth: Story = {
  name: 'Stock health options',
  args: { options: STOCK_HEALTH_OPTIONS, activeKey: 'EXPIRING_SOON' },
  parameters: {
    docs: {
      description: {
        story:
          'The inventory panel, which draws from the `--color-pill-*` family instead. Same rows, ' +
          'different token set - worth keeping side by side so the two panels stay the same shape.',
      },
    },
  },
};

export const NoSwatches: Story = {
  name: 'Options without a swatch',
  args: {
    options: [
      { key: 'ALL', name: 'All', text: 'var(--color-text-primary)' },
      { key: 'ACTIVE', name: 'Active', text: 'var(--color-text-primary)' },
      { key: 'HIDDEN', name: 'Hidden', text: 'var(--color-text-tertiary)' },
    ],
    activeKey: 'ACTIVE',
  },
  parameters: {
    docs: {
      description: {
        story:
          '`border` is optional. Without it the dot is dropped entirely rather than rendered ' +
          'transparent, so the labels sit flush against the left padding.',
      },
    },
  },
};

const InteractiveStatusOptions = (
  args: ComponentProps<typeof StatusOptionButtons<FilterOption>>
) => {
  const [activeKey, setActiveKey] = useState('ALL');
  return (
    <StatusOptionButtons<FilterOption> {...args} activeKey={activeKey} onSelect={setActiveKey} />
  );
};

export const Interactive: Story = {
  render: (args) => <InteractiveStatusOptions {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Selection wired to local state, so the check and hover states can be exercised.',
      },
    },
  },
};
