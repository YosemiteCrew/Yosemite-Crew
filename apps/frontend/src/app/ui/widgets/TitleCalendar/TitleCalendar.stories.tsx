import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import TitleCalendar from './index';
import Secondary from '../../primitives/Buttons/Secondary';

const meta = {
  title: 'Widgets/TitleCalendar',
  component: TitleCalendar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The page header for the Appointments and Tasks boards: serif page title with a muted count, ' +
          'an optional one-line description, and a right-hand action cluster ending in the ' +
          'calendar / board / list view switch. The switch is a `--band` track with a raised `--screen` ' +
          'pill on the active segment; it sizes itself to two or three options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showAdd: { control: 'boolean' },
    count: { control: 'number' },
    activeView: { control: 'radio', options: ['calendar', 'board', 'list'] },
  },
  args: {
    title: 'Appointments',
    description: 'Schedule and manage appointments across day, week, and team views',
    count: 24,
    activeView: 'calendar',
    showAdd: false,
    addLabel: 'New appointment',
    setAddPopup: fn(),
    setActiveView: fn(),
  },
} satisfies Meta<typeof TitleCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Appointments, as the page ships it — no header CTA, three views. */
export const Default: Story = {};

/** With the create CTA shown - labelled per page in the "New <thing>" form - which is what the header looks like on pages that keep it. */
export const WithAddAction: Story = {
  name: 'With Add action',
  args: { showAdd: true, activeView: 'board' },
};

/**
 * Two views only — the track narrows and each segment takes half, so a
 * two-option switch does not leave a dead third of empty pill.
 */
export const TwoViews: Story = {
  name: 'Two views',
  args: {
    title: 'Tasks',
    description: 'Track to-dos, assign the team or pet parents, follow through',
    viewOptions: ['board', 'list'],
    activeView: 'list',
    count: 8,
  },
};

/**
 * No description, a long title and an extra control in the `actionBeforeAdd`
 * slot (Tasks threads its week nav through here). This is the crowded case: the
 * cluster wraps under the title rather than squeezing the switch.
 */
export const CrowdedHeader: Story = {
  name: 'Crowded header',
  args: {
    title: 'Appointments and follow-up visits',
    description: undefined,
    count: 132,
    showAdd: true,
    actionBeforeAdd: <Secondary href="#" text="This week" />,
  },
};

const InteractiveTitleCalendar = () => {
  const [activeView, setActiveView] = useState('calendar');
  const [addOpen, setAddPopup] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <TitleCalendar
        title="Appointments"
        description="Schedule and manage appointments across day, week, and team views"
        count={24}
        activeView={activeView}
        setActiveView={setActiveView}
        showAdd
        addLabel="New appointment"
        setAddPopup={setAddPopup}
      />
      <p className="text-[13px] text-[var(--ink-muted)]">
        {`View: ${activeView}${addOpen ? ' — add sheet requested' : ''}`}
      </p>
    </div>
  );
};

/** Live switch, so the raised active pill can be seen moving between segments. */
export const Interactive: Story = {
  render: () => <InteractiveTitleCalendar />,
};
