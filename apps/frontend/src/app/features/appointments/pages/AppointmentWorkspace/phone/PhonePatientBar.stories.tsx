import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import PhonePatientBar from './PhonePatientBar';

const MINUTE = 60_000;

const APPOINTMENT: Appointment = {
  id: 'appt-workspace-1',
  organisationId: 'org-storybook',
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'prac-amara', name: 'Dr. Amara Weber' },
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

type Offsets = {
  /** Minutes before now that the visit started; omit for a visit with no start. */
  startedMinutesAgo?: number;
  /** Minutes before now that the booked slot ended; negative means still to come. */
  bookedEndMinutesAgo?: number;
};

/**
 * `VisitTimer` reads the real clock and has no injectable now, so the fixtures are
 * offsets rather than timestamps, resolved in a `useState` initializer - i.e. once
 * per MOUNT.
 *
 * That distinction is the whole reason this wrapper exists. Module-level constants
 * are evaluated when the story file is first imported and then never again, so
 * "started 20 minutes ago" quietly becomes "started 80 minutes ago" in a Storybook
 * tab left open, or in a play-function run that walks a few hundred stories on one
 * page load. The pill would cross from MM:SS into HH:MM:SS and the compact-format
 * assertion below would fail for reasons that have nothing to do with the
 * component. Resolving at mount pins each story to its own clock.
 */
const TimerBar = ({
  startedMinutesAgo,
  bookedEndMinutesAgo,
  ...props
}: React.ComponentProps<typeof PhonePatientBar> & Offsets) => {
  const [stamps] = useState(() => ({
    visitStartAt:
      startedMinutesAgo === undefined
        ? undefined
        : new Date(Date.now() - startedMinutesAgo * MINUTE).toISOString(),
    bookedEndAt:
      bookedEndMinutesAgo === undefined
        ? undefined
        : new Date(Date.now() - bookedEndMinutesAgo * MINUTE).toISOString(),
  }));
  return <PhonePatientBar {...props} {...stamps} />;
};

const timerPill = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('visit-timer');

const meta = {
  title: 'Workspace/PhonePatientBar',
  component: PhonePatientBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The phone workspace header: back circle, species avatar, name, status pill, a ' +
          'truncating signalment line, and the visit timer.\n\n' +
          'The timer is the part that had never been drawn in this variant. `VisitTimer` renders ' +
          'six different pills - three states across two variants - and which one appears is ' +
          'decided by the wall clock against `startAt` and `bookedEndAt`, not by a prop. A story ' +
          'with no timestamps only ever shows the resting "Not started" pill, which is what this ' +
          'component had.\n\n' +
          'The phone variant is not a smaller copy of the desktop one. It drops the pulsing green ' +
          'dot and the "In room" / "Over booked slot" words entirely and shows the bare elapsed ' +
          'time at 10px with `px-[9px] py-[5px]`, because the bar has roughly 70px to spare next ' +
          'to a truncating name. It also strips a leading `00:` so an under-an-hour visit reads ' +
          '`MM:SS` rather than `00:MM:SS`.\n\n' +
          'The over-booked pill is the one worth reviewing: `warning-100` fill, `warning-300` ' +
          'border, `warning-900` label. The 900 step is deliberate - the 700 step measured 2.77:1 ' +
          'against this tint, and this pill sits on every step of the workspace.\n\n' +
          'Every story states its start as an offset from the moment it mounts, because the ' +
          'component has no injectable clock. See `TimerBar` in the source for why a module-level ' +
          'timestamp is not good enough.',
      },
    },
  },
  tags: ['autodocs'],
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10. This bar only ever renders under 768px, so a story of it at
  // panel width would be showing a layout the app never produces.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    appointment: APPOINTMENT,
    companionName: 'Poppy Hartmann',
    speciesType: 'dog',
    breed: 'Beagle',
    ageLabel: '9 yr',
    weightKg: 12.4,
    onBack: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhonePatientBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  name: 'Timer running',
  render: (args) => <TimerBar {...args} startedMinutesAgo={20} bookedEndMinutesAgo={-10} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = timerPill(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'running');

    /* Compact MM:SS, not HH:MM:SS - `toCompactElapsed` drops the leading "00:" for
       a visit under an hour, which is the only reason this fits beside the name.
       The seconds tick, so the shape is asserted rather than a value. */
    await expect(pill.textContent?.trim()).toMatch(/^\d{2}:\d{2}$/);
    /* The desktop pill says "In room HH:MM:SS" and carries a pulsing dot; the phone
       one drops both. Asserted, because a desktop pill in this bar would still
       satisfy the data-state check and still look like a timer. */
    await expect(pill.textContent).not.toContain('In room');
    await expect(pill.querySelector('.animate-pulse')).toBeNull();

    // The phone variant, confirmed by its own type ramp: 10px against the desktop
    // pill's caption-1.
    const style = getComputedStyle(pill);
    await expect(style.fontSize).toBe('10px');
    // tabular-nums, so the digits do not jitter the bar's width every second.
    await expect(style.fontVariantNumeric).toContain('tabular-nums');

    // The bar's other content, which shares the row with the timer.
    await expect(canvas.getByText('Poppy Hartmann')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A visit 20 minutes in and still inside its booked slot. The pill sits on ' +
          '`--pill-raised` with a hairline border and `--ink-body` digits - the quiet state, ' +
          'because a visit running to plan is not news.',
      },
    },
  },
};

export const OverBooked: Story = {
  name: 'Timer over the booked slot',
  render: (args) => <TimerBar {...args} startedMinutesAgo={95} bookedEndMinutesAgo={35} />,
  play: async ({ canvasElement }) => {
    const pill = timerPill(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'over');
    // Past an hour, so the leading group survives: HH:MM:SS.
    await expect(pill.textContent?.trim()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // The desktop pill prefixes "Over booked slot ·"; the phone one shows digits only.
    await expect(pill.textContent).not.toContain('Over booked slot');

    /* Three warning steps on one pill, and all three have to differ from each other
       or the amber reads as a flat block. Polled because these are custom
       properties resolved at paint. */
    await waitFor(() => {
      const style = getComputedStyle(pill);
      expect(style.backgroundColor).not.toBe(style.color);
      expect(style.borderTopColor).not.toBe(style.backgroundColor);
      expect(style.borderTopColor).not.toBe(style.color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same visit 95 minutes in, 35 minutes past its booked end. Nothing is blocked - the ' +
          'pill is informational - but it is the only signal on the phone layout that a room is ' +
          'running over, so it has to survive being 10px on an amber tint.',
      },
    },
  },
};

export const NotStarted: Story = {
  name: 'Timer resting',
  render: (args) => <TimerBar {...args} />,
  play: async ({ canvasElement }) => {
    const pill = timerPill(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'idle');
    await expect(pill).toHaveTextContent('Not started');
    // No elapsed value is fabricated when there is no start timestamp.
    await expect(pill.textContent?.trim()).not.toMatch(/\d/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'No start timestamp at all, which is what an appointment that has not been checked in ' +
          'still looks like. The words rather than digits are why this state is the widest of the ' +
          'three, so it is the one that squeezes the name beside it.',
      },
    },
  },
};

export const StatesSideBySide: Story = {
  name: 'Three timer states, compared',
  render: (args) => (
    <div className="flex flex-col">
      <TimerBar {...args} />
      <TimerBar {...args} startedMinutesAgo={20} bookedEndMinutesAgo={-10} />
      <TimerBar {...args} startedMinutesAgo={95} bookedEndMinutesAgo={35} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pills = canvas.getAllByTestId('visit-timer');
    await expect(pills).toHaveLength(3);
    await expect(pills.map((pill) => pill.dataset.state)).toEqual(['idle', 'running', 'over']);

    /* The one comparison a single-state story cannot make: idle and running share
       the --pill-raised ground and differ only in ink, while over-booked changes
       ground, border AND ink. Rendered together so the amber is judged against the
       neutral it replaces rather than in isolation. */
    await waitFor(() => {
      const [idle, running, over] = pills.map((pill) => getComputedStyle(pill));
      expect(running.backgroundColor).toBe(idle.backgroundColor);
      expect(running.color).not.toBe(idle.color);
      expect(over.backgroundColor).not.toBe(running.backgroundColor);
      expect(over.borderTopColor).not.toBe(running.borderTopColor);
      expect(over.color).not.toBe(running.color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'All three states stacked, because the interesting question about this pill is not what ' +
          'each state looks like but how far apart they are. Idle and running are the same shape ' +
          'and the same ground; only the over-booked state is allowed to change the ground.',
      },
    },
  },
};

export const WithAllergy: Story = {
  name: 'Allergy tail',
  args: { allergy: 'Penicillin' },
  render: (args) => <TimerBar {...args} startedMinutesAgo={20} bookedEndMinutesAgo={-10} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const allergy = canvas.getByText('Allergy: Penicillin');
    const signalment = allergy.parentElement as HTMLElement;

    /* The tail is a span inside the same truncating paragraph as the signalment, so
       it is the FIRST thing lost when the name is long - and the only thing marking
       it as different is the ink. Both are asserted: same line, different colour. */
    await expect(signalment.textContent).toContain('Beagle · 9 yr · 12.4 kg · Allergy: Penicillin');
    await expect(getComputedStyle(signalment).textOverflow).toBe('ellipsis');
    await waitFor(() => {
      expect(getComputedStyle(allergy).color).not.toBe(getComputedStyle(signalment).color);
    });
    await expect(getComputedStyle(allergy).fontWeight).toBe('700');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Breed, age and weight are joined with a middot and the allergy is appended in ' +
          '`--danger-text` at 700. The whole line is one `truncate` paragraph at 10.5px, so on a ' +
          'long signalment the allergy is what disappears - which is worth seeing before deciding ' +
          'it belongs there.',
      },
    },
  },
};
