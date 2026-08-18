import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import StatusSubmenu from './StatusSubmenu';
import type { AppointmentStatus } from '@/app/features/appointments/types/appointments';

const OPTIONS: AppointmentStatus[] = ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'];

/**
 * The real submenu is `position: fixed` at coordinates measured from the parent menu
 * item. The harness supplies a static position instead so the panel can be read, and
 * passes the ref the component requires.
 */
const Harness = ({
  statusOptions,
  savingKey,
  onSelectStatus,
}: {
  statusOptions: AppointmentStatus[];
  savingKey: string | null;
  onSelectStatus: (status: AppointmentStatus) => void;
}) => {
  const submenuRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="relative min-h-[220px] p-6">
      <StatusSubmenu
        submenuRef={submenuRef}
        submenuStyle={{ position: 'static' }}
        statusOptions={statusOptions}
        savingKey={savingKey}
        onSelectStatus={onSelectStatus}
      />
    </div>
  );
};

const meta = {
  title: 'Appointments/StatusSubmenu',
  component: Harness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The status picker that flies out of the appointment context menu - the sibling of ' +
          '`RoomSubmenu`, which had a story while this one did not.\n\n' +
          'It only exists after two interactions (open the context menu, hover Change status), so ' +
          'nothing had drawn it. That matters here specifically because these calendar submenus ' +
          'are where a themed-surface bug already bit once: they sit on `yc-glass-overlay`, whose ' +
          'background follows the theme, and were filling their hovered and selected rows with ' +
          'literal white while their dividers went invisible in light mode - for exactly as long ' +
          'as no story rendered them.\n\n' +
          'Which statuses appear is data rather than decoration: the parent passes only the ' +
          'transitions allowed out of the current status, so this panel is three rows from ' +
          '`UPCOMING` and one from `CHECKED_IN`.\n\n' +
          'The dividers are drawn between items rather than around them - `index > 0` - so the ' +
          'first row must have no rule above it, which is only checkable with the panel open.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    statusOptions: OPTIONS,
    savingKey: null,
    onSelectStatus: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Transitions out of upcoming',
};

export const SingleOption: Story = {
  name: 'One transition',
  args: { statusOptions: ['IN_PROGRESS'] },
  parameters: {
    docs: {
      story:
        'What a checked-in appointment offers. With one row the divider rule must not render at ' +
        'all, and the panel keeps its 22px radius against a single item.',
    },
  },
};

export const Saving: Story = {
  name: 'Saving a status',
  args: { savingKey: 'status-CANCELLED' },
  parameters: {
    docs: {
      story:
        'The row being written disables and gains an 8px "Saving" tag on its right. The tag is ' +
        '`shrink-0` against a `truncate` label, so the label gives up width rather than pushing ' +
        'the tag out of the panel.',
    },
  },
};

export const LongLabels: Story = {
  name: 'Long labels truncate',
  args: { statusOptions: ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
  parameters: {
    docs: {
      story:
        'Every allowed status at once, which is more than any real transition set, to show how the ' +
        'panel sizes itself and where the labels start to truncate.',
    },
  },
};
