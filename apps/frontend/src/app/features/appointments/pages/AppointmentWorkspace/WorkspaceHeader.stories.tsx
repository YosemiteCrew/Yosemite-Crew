import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import WorkspaceHeader from './WorkspaceHeader';

const APPOINTMENT: Appointment = {
  id: 'appt-workspace-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: 'org-storybook',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const ALERTS: CompanionAlert[] = [
  { id: 'alert-1', label: 'Bite risk', severity: 'high' },
  { id: 'alert-2', label: 'Needs muzzle', severity: 'medium' },
];

const MANY_ALERTS: CompanionAlert[] = [
  ...ALERTS,
  { id: 'alert-3', label: 'Anaesthetic sensitivity', severity: 'critical' },
  { id: 'alert-4', label: 'Chicken protein allergy', severity: 'medium' },
  { id: 'alert-5', label: 'Fear of clippers', severity: 'low' },
];

/** Hovers the tooltip's wrapper span, which is the element carrying the listeners. */
const hoverTooltipTrigger = async (control: HTMLElement) => {
  const trigger = control.closest('.glass-tooltip');
  await expect(trigger).toBeInTheDocument();
  await userEvent.hover(trigger as HTMLElement);
  return within(document.body).findByRole('tooltip');
};

const meta = {
  title: 'Workspace/WorkspaceHeader',
  component: WorkspaceHeader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The identity row at the top of the appointment workspace: back arrow, 44px avatar, ' +
          'first name with the shared status pill inline, the meta line, then the clinical ' +
          'alert strip and the right-hand action cluster.\n\n' +
          'The surface that had never been drawn is the `GlassTooltip` on the round 24px "+" ' +
          'button at the end of the alert strip. It is doubly gated: the strip itself only ' +
          'exists when `alerts.length > 0 || clientAlerts.length > 0 || onAddAlert`, the "+" ' +
          'only when `onAddAlert` is passed, and the bubble only after a hover or focus - at ' +
          'which point it is `createPortal`ed to `document.body`, outside the story canvas ' +
          'entirely. Its copy also runs through `useCompanionTerminologyText`, so what it says ' +
          'depends on the org’s companion noun rather than being a fixed string.\n\n' +
          'The strip around it is worth seeing at both widths. It is ' +
          '`overflow-x-auto scrollbar-hidden` with a ' +
          '`[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]` right-edge ' +
          'fade, which is the only cue that alerts are hidden - measured on a real patient, ' +
          '666px of pills in a 276px box with the third cut mid-word. With few pills the fade ' +
          'falls on empty background and costs nothing, and the two cases look nothing alike.\n\n' +
          'The stories assert the tooltip bubble has its text, not merely that a hover ' +
          'happened - an empty bubble would pass the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    appointment: APPOINTMENT,
    companionName: 'Poppy Hartmann',
    alerts: ALERTS,
    metaLine: 'Beagle · F, spayed · 4y 2m · 12.4 kg',
    speciesType: 'dog',
    onBack: fn(),
    onQuickActions: fn(),
    onHospitalize: fn(),
    onAddAlert: fn(),
    onRemoveAlert: fn(),
  },
} satisfies Meta<typeof WorkspaceHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting',
  parameters: {
    docs: {
      description: {
        story:
          'Two alerts and the "+" button, with the visit timer in its "not started" rest state ' +
          'because no `visitStartAt` is supplied.',
      },
    },
  },
};

export const AddAlertTooltip: Story = {
  name: 'Add-alert tooltip open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButton = canvas.getByRole('button', { name: 'Add alert' });
    const tooltip = await hoverTooltipTrigger(addButton);
    // Assert the bubble carries its copy: an empty portalled div would still
    // satisfy role="tooltip", which is exactly how a blank panel stays invisible.
    await expect(tooltip).toBeInTheDocument();
    await expect(tooltip).toHaveTextContent(/add alerts for/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The bubble, portalled to `document.body` and positioned `side="bottom"` from the ' +
          'trigger rect with a 10px gap and an 8px viewport clamp. Nothing renders it without a ' +
          'hover or a focus, so it had never appeared in a snapshot.',
      },
    },
  },
};

export const HospitalizeTooltip: Story = {
  name: 'Hospitalize button (terminology-driven label)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The label is rewritten by the org terminology, so it is matched loosely.
    const hospitalize = canvas.getByRole('button', { name: /^Hospitalize/i });
    await expect(hospitalize).toBeInTheDocument();
    await expect(hospitalize).toHaveClass('size-11');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The 44px black circular action on the right. Its accessible name is produced by ' +
          '`useCompanionTerminologyText`, so it reads "Hospitalize companion" by default and ' +
          '"Hospitalize patient" for a hospital org - a string no static story can hard-code.',
      },
    },
  },
};

export const OverflowingAlerts: Story = {
  name: 'Alert strip overflowing (fade)',
  args: { alerts: MANY_ALERTS },
  decorators: [
    (Story) => (
      <div className="w-[900px] p-6">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByTestId('workspace-alert-strip');
    await expect(strip).toBeInTheDocument();
    await expect(within(strip).getByText('Bite risk')).toBeInTheDocument();
    // The "+" stays reachable at the end of the scrolling strip.
    await expect(within(strip).getByRole('button', { name: 'Add alert' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five standing clinical alerts in a constrained row. The scrollbar is hidden, so the ' +
          'right-edge mask is the only signal that there is more - compare it against the resting ' +
          'story, where the same fade falls on empty background.',
      },
    },
  },
};

export const ClientAlerts: Story = {
  name: 'Client alerts (read-only)',
  args: {
    alerts: [ALERTS[0]],
    clientAlerts: [{ id: 'client-1', label: 'Payment on hold', severity: 'medium' }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Client alerts are prefixed and carry NO remove control - they are managed
    // from the companion modal, not here.
    const clientPill = canvas.getByText('Client: Payment on hold');
    await expect(clientPill).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Remove alert Client: Payment on hold' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Remove alert Bite risk' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Parent-level alerts sit in the same strip, prefixed "Client:" and rendered without an ' +
          '`onRemove`, so they have no X. The two pill kinds are otherwise identical, which is ' +
          'precisely why they need to be seen side by side.',
      },
    },
  },
};

export const NoAlertStrip: Story = {
  name: 'No alert strip',
  args: { alerts: [], onAddAlert: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // With no alerts and no add handler the whole strip is unmounted, not empty.
    await expect(canvas.queryByTestId('workspace-alert-strip')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add alert' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Quick Actions' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A companion with no standing alerts, in a role that cannot add one. The strip is ' +
          'removed rather than left as an empty flex child, so the name block sits directly ' +
          'beside the right-hand actions.',
      },
    },
  },
};

export const EmergencyReadyToAdmit: Story = {
  name: 'Emergency, ready to admit',
  args: {
    appointment: { ...APPOINTMENT, isEmergency: true, status: 'CHECKED_IN' },
    canAdmit: true,
    onAdmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Admit' })).toBeInTheDocument();
    await expect(canvas.getByText(/emergency/i)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The busiest version of the row: emergency badge beside the status pill, plus the Admit ' +
          'primary ahead of the hospitalize circle and Quick Actions. Four controls compete for ' +
          'the right edge here, which only shows up when all of them render at once.',
      },
    },
  },
};

export const Admitting: Story = {
  name: 'Admitting (pending)',
  args: {
    appointment: { ...APPOINTMENT, status: 'CHECKED_IN' },
    canAdmit: true,
    isAdmitting: true,
    onAdmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const admitting = canvas.getByRole('button', { name: 'Admitting' });
    await expect(admitting).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Admit button relabels and disables while the admission request is in flight. It is ' +
          'a prop here, but in the app it exists only for the length of a network call.',
      },
    },
  },
};
