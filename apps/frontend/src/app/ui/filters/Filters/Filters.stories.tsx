import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
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
          'danger-toned and carries the 6px danger dot.\n\n' +
          'Everything above is the resting bar. The half that had never been drawn is the status ' +
          'dropdown panel: it lives behind `useState(open)`, and when it opens it is ' +
          '`createPortal`ed to `document.body` and positioned `fixed` from the trigger rect - so it ' +
          'is not in the story canvas at all, and no snapshot contained it. That is the gap worth ' +
          'naming: four production bugs on this branch lived on exactly such post-interaction ' +
          'surfaces, including dropdown panels whose option text used fill tokens where ink tokens ' +
          'were meant, which is unreadable but invisible to tsc, eslint and jest.\n\n' +
          'The panel rows are `StatusOptionButtons`: an 8px dot in the option border colour, the ' +
          'name painted from `dropdownText ?? text` - a second colour per status, separate from ' +
          'the one the pill uses - and a trailing check on the active row. Because the ' +
          'dropdown ink is its own token, a status can read correctly as a pill and wrongly in the ' +
          'panel; only an opened panel shows both at once.\n\n' +
          'The stories below open it in a `play` function and assert it has its full row set, not ' +
          'merely that the trigger flipped state - an empty panel would satisfy the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showAddButton: { control: 'boolean' },
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

export const WrappingRow: Story = {
  name: 'Wrapping row, no add button',
  args: {
    filterOptions: CompanionsSpeciesFilters,
    statusOptions: CompanionsStatusFilters,
    activeFilter: 'dog',
    activeStatus: 'active',
    showAddButton: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five species chips plus four status pills — the wrapping case the toolbar has to ' +
          'survive on tablet widths. Every pill in the row is now 32px tall at 12.5px: the ' +
          'chips are the shared `FilterChip`, and the status pills carry its geometry. The ' +
          'toolbar previously hand-rolled a second 12px chip on an unfixed height, plus a ' +
          '`compactFilterPills` variant that no page ever passed.',
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

/** Opens the portalled panel and returns it, located from a row rather than the canvas. */
const openStatusPanel = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: /all statuses/i }));
  // The panel is portalled out of canvasElement, so it has to be found on the
  // document. It carries no role or label, so a known row anchors the lookup.
  const row = await within(document.body).findByRole('button', { name: 'Archived' });
  return row.closest('.yc-glass-overlay') as HTMLElement;
};

export const StatusDropdownOpen: Story = {
  name: 'Status dropdown open',
  render: () => <StatusOnlyToolbar />,
  play: async ({ canvasElement }) => {
    const panel = await openStatusPanel(canvasElement);
    await expect(panel).toBeInTheDocument();
    // Assert the panel has every option and its selection mark - not merely that
    // the trigger toggled, which an empty panel would also satisfy.
    await expect(within(panel).getAllByRole('button')).toHaveLength(CompanionsStatusFilters.length);
    for (const status of CompanionsStatusFilters) {
      await expect(within(panel).getByText(status.name)).toBeInTheDocument();
    }
    await expect(within(panel).getByText('✓')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The surface itself: four rows on the `yc-glass-overlay` panel, each with its dot ' +
          'swatch, and the check on the active row. The panel is `position: fixed` at ' +
          '`rect.bottom + 6` and right-aligned to the trigger, with `minWidth` clamped to the ' +
          'larger of the trigger width and 180px - so a narrow trigger still yields a readable ' +
          'panel, which is only checkable with it open.',
      },
    },
  },
};

export const StatusDropdownSelection: Story = {
  name: 'Selecting a status',
  render: () => <StatusOnlyToolbar />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await openStatusPanel(canvasElement);
    await userEvent.click(within(panel).getByRole('button', { name: 'Archived' }));
    // The panel closes and the trigger takes the chosen status' label and tint.
    await expect(canvas.getByRole('button', { name: /archived/i })).toBeInTheDocument();
    await expect(within(document.body).queryByText('✓')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two interactions deep, and the only place the tinted trigger exists. Selecting anything ' +
          'other than "all" repaints the trigger with that status\' own bg/border/text - a state ' +
          'the closed-by-default stories can never reach, because the tint is derived from the ' +
          'selection rather than passed in.',
      },
    },
  },
};
