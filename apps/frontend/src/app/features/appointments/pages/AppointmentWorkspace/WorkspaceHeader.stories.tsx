import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
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

/**
 * Opens the bubble for a control.
 *
 * The wrapper span carries the listeners and binds them in an effect, which has not
 * necessarily flushed when a play function starts - so the dispatch is retried rather
 * than sent once. `findByRole` retries the query but never re-sends the event, so a
 * dispatch that arrives too early is lost for good and the story fails with "unable to
 * find role=tooltip" for a component that works perfectly in a browser.
 */
const hoverTooltipTrigger = async (control: HTMLElement) => {
  const trigger = control.closest('.glass-tooltip');
  await expect(trigger).toBeInTheDocument();
  return openGlassTooltip(trigger as HTMLElement);
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
          'happened - an empty bubble would pass the weaker check.\n\n' +
          'This row is the **desktop branch**. `AppointmentWorkspace` calls `useIsPhone()` ' +
          '(`max-width: 767px`) and returns `PhoneWorkspaceShell` instead below that, so ' +
          'WorkspaceHeader never renders on a phone and a phone-width screenshot of it is ' +
          'not a bug report. Measured down to a 620px canvas, the row itself fits with room ' +
          'to spare. The right-hand cluster is `shrink-0` by design; its widest reachable ' +
          'form is the visit timer, `Admit` and Quick Actions at 373px, because `canAdmit` ' +
          'needs an INPATIENT encounter and `canHospitalize` needs anything but one - the ' +
          'app never renders both.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    /* The frame carries the floor this row actually has: 768px. `AppointmentWorkspace`
       calls `useIsPhone()` at `max-width: 767px` and hands anything narrower to
       `PhoneWorkspaceShell`, so WorkspaceHeader has no phone rendering to get wrong -
       which is why a 390px sweep read this desktop row as a broken phone layout. The
       earlier 620px floor here was measured off a canvas where `Admit` and the
       hospitalize circle rendered together; they are mutually exclusive in the app, so
       620 was never a width this row had to survive. min-w states the floor without
       capping anything (a 1280px canvas is unchanged), and the scroller keeps a
       narrower preview from dragging the document sideways rather than pretending the
       row fits. */
    (Story) => (
      <div className="w-full overflow-x-auto">
        <div className="min-w-[768px] p-6">
          <Story />
        </div>
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
    /* `w-full max-w-[900px]`, not a bare `w-[900px]`. The number is here to constrain
       the strip so the fade has something to hide, and a max-width does that at every
       canvas; a fixed 900 also dragged the preview document 534px wide on a 390px
       sweep, which reads as a layout bug in a component that does not render at 390
       at all. Narrower canvases now overflow the strip harder, which is the point. */
    (Story) => (
      <div className="w-full max-w-[900px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByTestId('workspace-alert-strip');
    await expect(strip).toBeInTheDocument();
    await expect(within(strip).getByText('Bite risk')).toBeInTheDocument();

    /* The strip really is overflowing, which nothing here asserted before - and the
       fade is `mask-image`, so a strip that happened to fit would show no difference
       a screenshot could catch. Without this the story could quietly stop being about
       overflow the next time the frame around it moved. */
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
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
    // `canHospitalize` defaults to true on the component, so a story that only
    // sets `canAdmit` draws both. The app cannot: `canAdmit` requires
    // `encounterMode === 'INPATIENT'` and `canHospitalize` requires it not be.
    canHospitalize: false,
    onAdmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Admit' })).toBeInTheDocument();
    /* Exact, not /emergency/i. The preview decorator injects an sr-only <h1> reading
       "<title> - <story name>" into the canvas, and this story is named "Emergency,
       ready to admit" - so the loose regex matched the banner as well as the badge and
       the query was ambiguous. A looser assertion elsewhere could just as easily match
       ONLY the banner and pass with the component missing. */
    await expect(canvas.getByText('Emergency')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The busiest version of the row the app can actually produce: emergency badge beside ' +
          'the status pill, and the Admit primary ahead of Quick Actions. The hospitalize circle ' +
          'is off because an appointment ready to admit is already on the inpatient path.',
      },
    },
  },
};

export const Admitting: Story = {
  name: 'Admitting (pending)',
  args: {
    appointment: { ...APPOINTMENT, status: 'CHECKED_IN' },
    canAdmit: true,
    canHospitalize: false,
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

export const LongMetaLineAtTheFloor: Story = {
  name: 'Long meta line at the 768px floor',
  /* The tightest row the app can produce, at the narrowest viewport that renders
     it. Before the identity column was allowed to shrink it sized itself to the
     meta line and grew straight over the action cluster - "34.6 kg" rendered
     underneath the visit timer, and because nothing here overflows the document
     the page never gained a scrollbar to give it away. */
  decorators: [
    (Story) => (
      <div className="w-[768px] p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    metaLine: 'German Shorthaired Pointer · M, neutered · 11y 8m · 34.6 kg',
    appointment: { ...APPOINTMENT, status: 'CHECKED_IN' },
    canAdmit: true,
    canHospitalize: false,
    onAdmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* By accessible name, not by level: the preview injects its own sr-only
       <h1> carrying the story title into this canvas. */
    const firstName = canvas.getByRole('heading', { name: 'Poppy' });
    const identityColumn = firstName.closest('div.flex-col');
    const actionCluster = canvas.getByRole('button', { name: 'Quick Actions' }).parentElement;
    await expect(identityColumn).not.toBeNull();
    await expect(actionCluster).not.toBeNull();

    const identityRight = (identityColumn as HTMLElement).getBoundingClientRect().right;
    const clusterLeft = (actionCluster as HTMLElement).getBoundingClientRect().left;
    await expect(identityRight).toBeLessThanOrEqual(clusterLeft);

    // The line gave up the width rather than the name row: the meta line is
    // clipped, while the first name and the status pill beside it are whole.
    const metaLine = canvas.getByText(/German Shorthaired Pointer/);
    await expect(metaLine.scrollWidth).toBeGreaterThan(metaLine.clientWidth);
    await expect(firstName.scrollWidth).toBeLessThanOrEqual(firstName.clientWidth);
    const statusPill = canvas.getByText('Checked in');
    await expect(statusPill.scrollWidth).toBeLessThanOrEqual(statusPill.clientWidth);
  },
  parameters: {
    chromatic: { viewports: [768] },
    docs: {
      description: {
        story:
          'A breed name long enough to matter, on the inpatient path, at 768px. The meta line ' +
          'ellipses; the first name, the status pill and the action cluster all keep their full ' +
          'width. Breed, sex, age and weight repeat in the companion panel, so the meta line is ' +
          'the right thing to spend when the row runs out of room.',
      },
    },
  },
};
