import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import type { Appointment } from '@yosemite-crew/types';

import AppointmentBoardCard from './AppointmentBoardCard';

const ORG_ID = 'org-storybook';

const APPOINTMENT: Appointment = {
  id: 'appt-board-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  room: { id: 'room-2', name: 'Consult 2' },
  appointmentType: {
    id: 'type-1',
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
};

const withStatus = (status: Appointment['status']): Appointment => ({ ...APPOINTMENT, status });

/** Every control on the rail, in render order, for an editable UPCOMING card at a hospital. */
const HOSPITAL_RAIL = [
  'View appointment',
  'Overview',
  'Change status',
  'Reschedule',
  'Assign room',
  'Medical Records',
  'Finance summary',
  'Lab tests',
];

/**
 * A board column. The card is `w-full`, so without a column it stretches to the
 * canvas and the rail never reaches the `max-w-[184px]` wrap it has in the app.
 * The extra height below is for the tooltip, which is placed `side="bottom"`.
 */
const Column = (Story: React.ComponentType) => (
  <div className="flex min-h-[460px] justify-center p-6">
    <div className="w-[276px]">
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Appointments/AppointmentBoardCard',
  component: AppointmentBoardCard,
  decorators: [Column],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One card in an appointments board column. Every lookup it needs - encounters, room ' +
          'units, orgs, invoices - arrives as a prop, so it renders from data alone with no store ' +
          'behind it.\n\n' +
          'The surface these stories exist for is the tooltip on the action rail. Each round 28px ' +
          'button is wrapped in `GlassTooltip`, which mounts nothing until the wrapper receives ' +
          '`mouseenter` or `focusin` and then `createPortal`s a `role="tooltip"` bubble to ' +
          '`document.body`, positioned from the trigger rect. No story had ever hovered one, so ' +
          'the bubble - and the fact that eight of them share one card - had never been drawn. ' +
          'That is the same class of gap that let four layout bugs ship on this branch: a popover ' +
          'whose grid template used a comma and collapsed to a single column, two calendar ' +
          'overlays with an orphaned grid child that doubled their height, and dropdown text ' +
          'painted with fill tokens instead of ink tokens. All post-interaction, all invisible to ' +
          'tsc, eslint and jest.\n\n' +
          'Which buttons exist is derived, not decorative. `View appointment` is dropped for ' +
          'REQUESTED / CANCELLED / NO_SHOW; `Change status` only when the status has an onward ' +
          'transition; `Reschedule` only for REQUESTED and UPCOMING; `Assign room` only for ' +
          'UPCOMING, CHECKED_IN and IN_PROGRESS - and the last three each need ' +
          '`canEditAppointments`. The clinical-notes button relabels from "Medical Records" to ' +
          '"Care" purely from the org type read out of `orgsById`, and that label is the tooltip ' +
          'text, so it is only checkable with a tooltip open.\n\n' +
          'The tooltip stories assert the bubble has the right copy. Asserting only that a hover ' +
          'happened would pass on an empty bubble - the weak form is how this kind of regression ' +
          'survives.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    encountersById: {},
    roomUnitsById: {},
    canEditAppointments: true,
    draggedAppointmentId: null,
    invoicesByAppointmentId: {},
    orgsById: { [ORG_ID]: { type: 'HOSPITAL' } },
    updatingStatusId: null,
    handleAppointmentDragStart: fn(),
    setDraggedAppointmentId: fn(),
    openAppointment: fn(),
    openAppointmentHistory: fn(),
    openChangeStatus: fn(),
    openReschedule: fn(),
    openChangeRoom: fn(),
    openAppointmentWorkspace: fn(),
  },
} satisfies Meta<typeof AppointmentBoardCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  name: 'Upcoming (full rail)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of HOSPITAL_RAIL) {
      await expect(canvas.getByRole('button', { name: label })).toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'All eight controls, wrapped inside `max-w-[184px]` so the rail runs onto a second row ' +
          'rather than widening the card past its column.',
      },
    },
  },
};

export const TooltipOnHover: Story = {
  name: 'Action tooltip (hover)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The bubble portals to document.body, so it is outside canvasElement - and it is
       asserted to carry its copy, not merely to exist. `openGlassTooltip` because the
       wrapper binds its listeners in an effect that a play function can outrun. */
    const tooltip = await openGlassTooltip(canvas.getByRole('button', { name: 'Assign room' }));
    await expect(tooltip).toHaveTextContent('Assign room');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface itself. The bubble is the only label these icon buttons carry visually ' +
          '- the glyphs are 13-14px `--ink-soft` with no text beside them - so a bubble that renders ' +
          'empty, mispositioned or off-viewport leaves the whole rail unreadable.',
      },
    },
  },
};

export const TooltipOnKeyboardFocus: Story = {
  name: 'Action tooltip (keyboard focus)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* `focusin` reaches the GlassTooltip wrapper, which is the whole reason a keyboard
       user gets the label at all - separate code from the hover path. Dispatched at the
       wrapper rather than via `.focus()`, which fires nothing unless the page itself has
       focus, and no automated run can guarantee that. */
    const tooltip = await openGlassTooltip(canvas.getByRole('button', { name: 'Lab tests' }), {
      via: 'focus',
    });
    await expect(tooltip).toHaveTextContent('Lab tests');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same bubble reached without a pointer. It opens on `focusin` and closes on `focusout` ' +
          'unless focus stayed inside the wrapper, so a keyboard user tabbing along the rail sees ' +
          'one label at a time rather than none.',
      },
    },
  },
};

export const NonHospitalClinicalNotes: Story = {
  name: 'Care label (non-hospital org)',
  args: { orgsById: { [ORG_ID]: { type: 'GROOMER' } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Medical Records' })).toBeNull();
    const tooltip = await openGlassTooltip(canvas.getByRole('button', { name: 'Care' }));
    await expect(tooltip).toHaveTextContent('Care');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The clinical-notes button is one control with two identities: a hospital sends the reader ' +
          'to `prescription / subjective` labelled Medical Records, every other org type to ' +
          '`care / forms` labelled Care. The label lives in the tooltip, so the wrong one is only ' +
          'visible with the tooltip open.',
      },
    },
  },
};

export const CheckedIn: Story = {
  name: 'Checked in (waiting + Start visit)',
  args: {
    appointment: {
      ...withStatus('CHECKED_IN'),
      // Relative rather than fixed: the label is derived from `Date.now()`, so a
      // hardcoded stamp would read as a wait of several months.
      checkedInAt: new Date(Date.now() - 12 * 60 * 1000),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^Waiting \d+ min$/)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Start visit' })).toBeInTheDocument();
    // Checked-in cannot be rescheduled, so that one control drops out of the rail.
    await expect(canvas.queryByRole('button', { name: 'Reschedule' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The emphasised card: a 1.5px `--status-checked-in-border` outline, the deeper ' +
          '`0_4px_14px_var(--sh08)` shadow, the wait so far, and a `--blue-strong` "Start visit" ' +
          'button. The wait row only renders when `checkedInAt` is present - it is deliberately not ' +
          'derived from `startTime`, which would measure lateness rather than waiting - so the whole ' +
          'row is absent on live data until the backend stamps it.',
      },
    },
  },
};

export const Emergency: Story = {
  name: 'Emergency',
  args: { appointment: { ...APPOINTMENT, isEmergency: true } },
  parameters: {
    docs: {
      description: {
        story:
          'Emergency wins over every other emphasis: a `--danger-border` outline with a 3px ' +
          '`--danger` left edge, plus the 8.5px uppercase pill in the header row. It also outranks ' +
          'the checked-in outline, which is why the two are separate branches rather than combined ' +
          'classes.',
      },
    },
  },
};

export const Requested: Story = {
  name: 'Requested (accept / decline)',
  args: { appointment: withStatus('REQUESTED') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Accept request' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Decline request' })).toBeInTheDocument();
    // A requested card swaps the rail out entirely rather than disabling it.
    await expect(canvas.queryByRole('button', { name: 'Overview' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A request has no rail at all - the eight icons are replaced by a `--cta` Accept and an ' +
          'outlined Decline. Decline calls the reject service straight from the card, so it is the ' +
          'one control here that reaches the network without a confirmation step.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no edit permission)',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ['Change status', 'Reschedule', 'Assign room']) {
      await expect(canvas.queryByRole('button', { name: label })).toBeNull();
    }
    for (const label of ['View appointment', 'Overview', 'Medical Records']) {
      await expect(canvas.getByRole('button', { name: label })).toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without edit permission the three mutating controls are removed rather than dimmed, and ' +
          'the card stops being draggable - which also means the full-bleed `inset-0` overlay button ' +
          'appears, so a plain click anywhere opens the appointment.',
      },
    },
  },
};

export const Completed: Story = {
  name: 'Completed (muted)',
  args: { appointment: withStatus('COMPLETED') },
  parameters: {
    docs: {
      description: {
        story:
          'Closed-out work recedes by losing its lift shadow entirely (`shadow-none`). The design ' +
          'asked for 72% opacity as well; it is deliberately not applied because it dropped the ' +
          'meta line, which is `text-text-tertiary` on this card, below AA.',
      },
    },
  },
};

export const Dragging: Story = {
  name: 'Dragging',
  args: { draggedAppointmentId: 'appt-board-1' },
  parameters: {
    docs: {
      description: {
        story:
          'The state while the card is held over another column: `opacity-60`, no shadow, and no ' +
          'hover border - reachable in the app only mid-drag, which no static story could show.',
      },
    },
  },
};

export const UpdatingStatus: Story = {
  name: 'Status update in flight',
  args: { updatingStatusId: 'appt-board-1' },
  parameters: {
    docs: {
      description: {
        story:
          'The 10px "Updating…" line appended under the rail while a transition is being written. It ' +
          'is keyed on the id of the card being changed, so no sibling in the column shows it.',
      },
    },
  },
};
