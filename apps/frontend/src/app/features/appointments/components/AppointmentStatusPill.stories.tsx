import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import AppointmentStatusPill from './AppointmentStatusPill';

const APPOINTMENT: Appointment = {
  id: 'appt-status-1',
  patient: {
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

/** The menu is `position: fixed` against the trigger, so the trigger needs room below it. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[260px] items-start justify-center pt-6">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/AppointmentStatusPill',
  component: AppointmentStatusPill,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The single source of truth for appointment status across the calendar popover and the ' +
          'appointment workspace: a badge when nothing can change, a dropdown trigger when it can.\n\n' +
          'The menu is `createPortal`ed to `document.body` and only exists after a click, so nothing ' +
          'in Storybook or Chromatic had ever drawn it. That is the gap worth naming rather than the ' +
          'component: four production bugs on this branch lived on exactly such surfaces - a task ' +
          'popover whose grid template was invalid CSS and so collapsed to one column, and two ' +
          'calendar overlays with an orphaned grid child that silently doubled their height. Each was ' +
          'reachable only after an interaction, and each survived precisely as long as no story ' +
          'rendered it.\n\n' +
          'Which transitions appear is data, not decoration: `UPCOMING` offers checked-in, cancelled ' +
          'and no-show; `CHECKED_IN` offers only in-progress; `COMPLETED` offers nothing and falls ' +
          'back to a static badge.\n\n' +
          'The stories below open the menu in a `play` function and assert it has real content, not ' +
          'merely that the trigger flipped `aria-expanded`. The weaker assertion passes on an empty ' +
          'panel, which is exactly how an earlier dropdown regression stayed invisible.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    canEdit: true,
    onChanged: fn(),
  },
} satisfies Meta<typeof AppointmentStatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Trigger only',
  parameters: {
    docs: {
      description: {
        story: 'What the calendar and the workspace show until the reader asks for the menu.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Menu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /upcoming/i }));
    // The panel portals out of the canvas, so assert against the document - and assert
    // it has items, since an empty panel would satisfy aria-expanded on its own.
    const menu = document.querySelector('[role="menu"]');
    await expect(menu).toBeInTheDocument();
    await expect(within(menu as HTMLElement).getAllByRole('menuitem')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three transitions allowed out of `UPCOMING`, each with the status dot in its own tone.',
      },
    },
  },
};

export const SingleTransition: Story = {
  name: 'One transition (checked in)',
  args: { appointment: withStatus('CHECKED_IN') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /checked in/i }));
    const menu = document.querySelector('[role="menu"]');
    await expect(menu).toBeInTheDocument();
    await expect(within(menu as HTMLElement).getAllByRole('menuitem')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A checked-in appointment can only move to in-progress, so the panel is a single row. This ' +
          'is where a menu sized from its trigger rather than its content shows up.',
      },
    },
  },
};

export const Terminal: Story = {
  name: 'Terminal status (static badge)',
  args: { appointment: withStatus('COMPLETED') },
  parameters: {
    docs: {
      description: {
        story:
          'A completed appointment has no onward transition, so the component drops the trigger ' +
          'entirely and renders a plain badge - no caret, not focusable.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (canEdit false)',
  args: { canEdit: false },
  parameters: {
    docs: {
      description: {
        story:
          'The same upcoming appointment for someone without edit permission. It must render as a ' +
          'badge rather than a disabled-looking trigger: a dim that reads as inactive but stays ' +
          'clickable is its own defect.',
      },
    },
  },
};
