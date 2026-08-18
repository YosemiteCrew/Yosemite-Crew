import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import WorkspaceQuickActions from './WorkspaceQuickActions';

const APPOINTMENT: Appointment = {
  id: 'appt-quick-actions-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Maya Whitfield' },
  },
  companion: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Maya Whitfield' },
  },
  organisationId: 'org-storybook',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
};

const withStatus = (status: Appointment['status']): Appointment => ({ ...APPOINTMENT, status });

/**
 * Stands in for the popover the rail lives in: the same 440px panel width, and
 * enough height above it for the `side="top"` bubbles, which are positioned from
 * the trigger rect and clamp themselves to the viewport.
 */
const Popover = (Story: React.ComponentType) => (
  <div className="flex min-h-[240px] items-end justify-center p-6">
    <div className="w-[440px] rounded-3xl border border-card-border bg-neutral-0 p-5">
      <Story />
    </div>
  </div>
);

/** GlassTooltip binds mouseenter/focusin to its own wrapper span, not the button. */
const wrapperFor = (canvasElement: HTMLElement, accessibleName: string) =>
  within(canvasElement)
    .getByRole('button', { name: accessibleName })
    .closest('.glass-tooltip') as HTMLElement;

/** Hovers a rail button's tooltip wrapper and returns the portalled bubble. */
const hoverAction = async (canvasElement: HTMLElement, accessibleName: string) => {
  await userEvent.hover(wrapperFor(canvasElement, accessibleName));
  return within(document.body).findByRole('tooltip');
};

const meta = {
  title: 'Appointments/WorkspaceQuickActions',
  component: WorkspaceQuickActions,
  decorators: [Popover],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The round action rail inside the calendar appointment popover: overview, finance, labs, ' +
          'and - depending on status and permission - reschedule, assign room, and the clinical ' +
          'notes entry point.\n\n' +
          'Every label on this rail is **doubly gated**. The rail itself only exists while the ' +
          'popover is open, and each label is a `GlassTooltip` bubble that is not constructed until ' +
          '`mouseenter` or `focusin` fires, at which point it is `createPortal`ed to ' +
          '`document.body` and positioned from the trigger rect. Nothing about a resting render - ' +
          'in Storybook, in Chromatic, or in a DOM snapshot - contains a single one of them.\n\n' +
          'The layout fact worth drawing is the overflow. The rail is a fixed `w-48` (192px) with ' +
          '`overflow-x-auto` and `scrollbar-hidden`, while six 48px buttons and five 8px gaps come ' +
          'to 328px. So on an UPCOMING appointment more than a third of the rail is off-panel ' +
          'behind an invisible scrollbar, reachable only by the wheel handler. That is a real ' +
          'discoverability question, and it is only visible with the popover open and every ' +
          'conditional button rendered.\n\n' +
          'Which buttons render is derived, not passed: `allowReschedule` admits only NO_PAYMENT, ' +
          'REQUESTED and UPCOMING, while `canAssignAppointmentRoom` admits UPCOMING, CHECKED_IN and ' +
          'IN_PROGRESS - so the two conditional buttons overlap on exactly one status. The stories ' +
          'below walk that, and assert each opened bubble has its text rather than asserting a ' +
          'trigger changed state, which an empty bubble would also satisfy.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    canEditAppointments: true,
    clinicalNotesLabel: 'Medical Records',
    onActionBarWheel: fn(),
    onOpenCompanionHistory: fn(),
    onOpenWorkspace: fn(),
    onReschedule: fn(),
    onChangeRoom: fn(),
  },
} satisfies Meta<typeof WorkspaceQuickActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full rail (upcoming)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // UPCOMING is the only status where both conditional buttons render, so this
    // is the widest the rail ever gets.
    await expect(canvas.getAllByRole('button')).toHaveLength(6);

    /* The rail is 192px and its content is not. Assert the overflow rather than
       describing it: if a future change unfixes the width, this is the story
       that notices. */
    const rail = canvasElement.querySelector('.scrollbar-hidden') as HTMLElement;
    await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'All six buttons, with the last two sitting outside the 192px window. Nothing marks the ' +
          'rail as scrollable, so this render is the argument for the wheel handler existing.',
      },
    },
  },
};

export const OverviewTooltip: Story = {
  name: 'Tooltip: Overview',
  play: async ({ canvasElement }) => {
    const bubble = await hoverAction(canvasElement, 'Appointment overview');
    await expect(bubble).toHaveTextContent('Overview');
    /* side="top" - the bubble sits above the button, which is the placement that
       has to clear the popover's own chrome. Read the inline transform, not the
       computed one: a laid-out element resolves any transform to a `matrix(...)`,
       so a computed-style check cannot tell the placements apart. */
    await expect(bubble.style.transform).toBe('translate(-50%, -100%)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first bubble. Its label ("Overview") is deliberately not the button\'s accessible ' +
          'name ("Appointment overview"), so the visible text here cannot be read off the resting ' +
          'markup at all.',
      },
    },
  },
};

export const EveryTooltip: Story = {
  name: 'Tooltips: whole rail',
  play: async ({ canvasElement }) => {
    const expectations: Array<[string, string]> = [
      ['Appointment overview', 'Overview'],
      ['Finance summary', 'Finance summary'],
      ['Lab tests', 'Lab tests'],
      ['Reschedule appointment', 'Reschedule'],
      ['Assign room', 'Assign room'],
      ['Medical Records', 'Medical Records'],
    ];

    for (const [accessibleName, label] of expectations) {
      const wrapper = wrapperFor(canvasElement, accessibleName);
      await userEvent.hover(wrapper);
      const bubble = await within(document.body).findByRole('tooltip');
      await expect(bubble).toHaveTextContent(label);
      // Exactly one live portal at a time - two would stack on top of each other
      // on document.body, since both are absolutely positioned there.
      await expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);

      /* Unhover explicitly. `userEvent.hover` from the direct API starts with a
         fresh pointer position each call, so it never emits the `mouseleave`
         that closes the previous bubble - without this the portals accumulate. */
      await userEvent.unhover(wrapper);
      await waitFor(() => expect(within(document.body).queryByRole('tooltip')).toBeNull());
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every label on the rail, opened and dismissed in turn. It also pins the teardown down: ' +
          'each bubble must be gone before the next opens, since they are absolutely positioned ' +
          'siblings on `document.body` and would otherwise overlap rather than replace each other.',
      },
    },
  },
};

export const ClinicalNotesLabel: Story = {
  name: 'Clinic wording (Care)',
  args: { clinicalNotesLabel: 'Care' },
  play: async ({ canvasElement }) => {
    const bubble = await hoverAction(canvasElement, 'Care');
    await expect(bubble).toHaveTextContent('Care');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A clinic that is not a HOSPITAL gets "Care" instead of "Medical Records" for the same ' +
          'button. The label reaches the tooltip, the `title`, and the `aria-label` from one prop, ' +
          'so the shorter wording changes the bubble width - and only the open bubble shows it.',
      },
    },
  },
};

export const InProgress: Story = {
  name: 'In progress (no reschedule)',
  args: { appointment: withStatus('IN_PROGRESS') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button')).toHaveLength(5);
    await expect(canvas.queryByRole('button', { name: 'Reschedule appointment' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Assign room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An in-progress appointment can still be moved to another room but can no longer be ' +
          'rescheduled, so the two conditionals disagree. This is the only render that separates ' +
          'them.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no edit permission)',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both conditional buttons are gated on the permission first, so the rail
    // drops to the four unconditional actions regardless of status.
    await expect(canvas.getAllByRole('button')).toHaveLength(4);
    // Still wider than its 192px window: 4 x 48px plus 3 x 8px is 216px, so even
    // the narrowest rail hides its last button.
    const rail = canvasElement.querySelector('.scrollbar-hidden') as HTMLElement;
    await expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without edit permission the rail is four buttons - and still overflows, because four ' +
          '48px buttons and three 8px gaps come to 216px against a 192px window. The rail never ' +
          'fits at any status, which is easier to argue with this story beside the full one.',
      },
    },
  },
};
