import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  CompanionsSpeciesFilters,
  CompanionsStatusFilters,
  filter,
  statusFromToken,
} from '../../../features/companions/pages/Companions/types';
import Filters from './index';

const APPOINTMENT_FILTERS = [filter('All', 'all'), filter('Emergencies', 'emergencies')];

const APPOINTMENT_STATUSES = [
  statusFromToken('All', 'all', 'color-pill-neutral'),
  statusFromToken('Confirmed', 'confirmed', 'color-pill-success'),
  statusFromToken('In progress', 'in_progress', 'color-pill-progress'),
  statusFromToken('Cancelled', 'cancelled', 'color-pill-warning'),
];

const meta = {
  title: 'Filters/Filters',
  component: Filters,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The list-toolbar filter bar. With `filterOptions` it renders the inline layout: filter ' +
          'chips on the left, a hairline divider, then a status pill per status, with the optional ' +
          'add button pinned right. Without `filterOptions` it collapses to the compact ' +
          '"All statuses" dropdown used by standalone toolbars. The emergencies chip is always ' +
          'danger-toned and carries the 6px danger dot.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showAddButton: { control: 'boolean' },
    compactFilterPills: { control: 'boolean' },
    hasEmergency: { control: 'boolean' },
  },
  args: {
    setActiveFilter: fn(),
    setActiveStatus: fn(),
    onAddButtonClick: fn(),
  },
} satisfies Meta<typeof Filters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ListToolbar: Story = {
  name: 'List toolbar (chips + status pills)',
  args: {
    filterOptions: APPOINTMENT_FILTERS,
    statusOptions: APPOINTMENT_STATUSES,
    activeFilter: 'all',
    activeStatus: 'all',
    hasEmergency: true,
    showAddButton: true,
    addButtonText: 'New appointment',
  },
};

export const EmergencySelected: Story = {
  name: 'Emergencies selected',
  args: {
    ...ListToolbar.args,
    activeFilter: 'emergencies',
    activeStatus: 'in_progress',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Active emergency chip fills with `--danger-bg`; the active status pill takes that ' +
          "status' own bg/border/text tokens at weight 700 while the rest stay hairline/muted.",
      },
    },
  },
};

export const CompactPills: Story = {
  name: 'Compact pills, no add button',
  args: {
    filterOptions: CompanionsSpeciesFilters,
    statusOptions: CompanionsStatusFilters,
    activeFilter: 'dog',
    activeStatus: 'active',
    compactFilterPills: true,
    showAddButton: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five species chips plus four status pills at the compact 3px/12px padding — the ' +
          'wrapping case the toolbar has to survive on tablet widths.',
      },
    },
  },
};

const StatusOnlyToolbar = () => {
  const [activeStatus, setActiveStatus] = useState('all');
  return (
    <Filters
      statusOptions={CompanionsStatusFilters}
      activeStatus={activeStatus}
      setActiveStatus={setActiveStatus}
      showAddButton
      addButtonText="Add companion"
      onAddButtonClick={fn()}
    />
  );
};

export const StatusDropdown: Story = {
  name: 'Status dropdown only',
  render: () => <StatusOnlyToolbar />,
  parameters: {
    docs: {
      description: {
        story:
          'No `filterOptions`, so the statuses collapse into the compact dropdown trigger. The ' +
          'panel is portalled to `document.body` and positioned against the trigger, so it escapes ' +
          'any clipping toolbar. Interactive: open it and pick a status.',
      },
    },
  },
};
