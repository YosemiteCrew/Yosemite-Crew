import { useId, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, Invoice, Organisation } from '@yosemite-crew/types';

import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import AppointmentPopover from './AppointmentPopover';
import { getCompanionAge } from './appointmentPopoverHelpers';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-popover-1';
const COMPANION_ID = 'companion-poppy';

const COMPANION_REF: Appointment['patient'] = {
  id: COMPANION_ID,
  name: 'Poppy',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: 'parent-maya', name: 'Maya Whitfield' },
};

/**
 * The booking payload carries a name, a species and a breed and nothing else about
 * the animal. Age, sex, neuter status and weight all come from the companion store,
 * and the popover merges the two - which is why the subline is a store question,
 * not a props question.
 */
const STORE_COMPANION: StoredCompanion = {
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: 'parent-maya',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: new Date('2021-06-04T00:00:00.000Z'),
  gender: 'male',
  isneutered: true,
  currentWeight: 12,
  isInsured: false,
  status: 'active',
};

/**
 * Only `type` is ever read here - it picks "Medical Records" over "Care" for the
 * clinical-notes label and intent - so the org is asserted through `unknown`
 * rather than filled out with two dozen irrelevant fields.
 */
const HOSPITAL = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
} as unknown as Organisation;

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: COMPANION_REF,
  companion: COMPANION_REF,
  organisationId: ORG_ID,
  lead: { id: 'practitioner-elena', name: 'Dr. Elena Marsh' },
  supportStaff: [
    { id: 'nurse-tom', name: 'Tom Reyes' },
    { id: 'nurse-priya', name: 'Priya Raman' },
  ],
  room: { id: 'room-consult-2', name: 'Consult 2' },
  appointmentType: {
    id: 'svc-dental-consult',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  // Named explicitly. `resolveEncounterMode` falls back to "a room is assigned,
  // therefore inpatient", so leaving this off changes the mode pill AND the Room
  // cell's label - see the "Room implies inpatient" story.
  appointmentKind: 'OUTPATIENT',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Post-op recheck of the left carpus, plus a nail trim if she tolerates it',
};

const withAppointment = (patch: Partial<Appointment>): Appointment => ({
  ...APPOINTMENT,
  ...patch,
});

const UNPAID_INVOICE: Invoice = {
  id: 'inv-popover-1',
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  items: [
    { name: 'Dental consultation', quantity: 1, unitPrice: 72, total: 72 },
    { name: 'Full mouth radiograph', quantity: 1, unitPrice: 112, total: 112 },
  ],
  subtotal: 184,
  totalAmount: 184,
  paymentCollectionMethod: 'PAYMENT_LINK',
  currency: 'USD',
  status: 'AWAITING_PAYMENT',
  createdAt: new Date('2026-03-12T10:05:00.000Z'),
  updatedAt: new Date('2026-03-12T10:05:00.000Z'),
};

/**
 * The two cells whose copy is produced by a formatter rather than written down.
 * Composed with the app's own formatter rather than hardcoded as "10:30 AM":
 * `getPreferredTimeZone` reads a localStorage token, so a reviewer who changed the
 * timezone anywhere else in this Storybook would fail a literal string for a reason
 * that has nothing to do with the popover.
 */
const timeRangeOf = (event: Appointment): string =>
  `${formatDateInPreferredTimeZone(event.startTime, {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${formatDateInPreferredTimeZone(event.endTime, { hour: 'numeric', minute: '2-digit' })}`;

const longDateOf = (event: Appointment): string =>
  formatDateInPreferredTimeZone(event.appointmentDate, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const SUBLINE = `Beagle · Canine · ${getCompanionAge(STORE_COMPANION.dateOfBirth)} · MN · 12 kg`;

/** The open panel. Not portalled by the popover itself - `SlotPortals` does that. */
const openPanel = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('dialog[open]') as HTMLElement;

/** The eight-cell detail grid, reached from a label rather than from a class chain. */
const detailGrid = (panel: HTMLElement): HTMLElement =>
  within(panel).getByText('Speciality').closest('.grid') as HTMLElement;

/**
 * Every detail cell as a [label, value] pair, in render order. Read positionally
 * rather than by text: the payment cell's label and value are frequently the same
 * word ("Paid" / "Paid"), so a text query for one matches both.
 */
const detailPairs = (panel: HTMLElement): string[][] =>
  [...detailGrid(panel).children].map((cell) => [
    (cell.children[0].textContent ?? '').trim(),
    (cell.children[1].textContent ?? '').trim(),
  ]);

/**
 * Every button in the panel, in render order, by name. The rail is six icon
 * buttons that differ only by glyph, so "which actions are offered" is a list
 * question: asserting three of them by name passes on a rail that lost the other
 * three. `aria-label` first because that is what the rail names its buttons with;
 * the header link, the status trigger and the primary action name themselves by
 * their own text.
 */
const buttonNames = (panel: HTMLElement): string[] =>
  within(panel)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim());

/** The `GlassTooltip` wrapper around one action-rail button. */
const railWrapper = (panel: HTMLElement, accessibleName: string): HTMLElement =>
  within(panel)
    .getByRole('button', { name: accessibleName })
    .closest('.glass-tooltip') as HTMLElement;

type HarnessProps = {
  appointment: Appointment;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  handleAcceptAppointment?: (appt: Appointment) => void;
  onClose: () => void;
};

/** Registering the anchor is the calendar's hover-dismiss wiring; here it is inert. */
const registerAnchorEl = () => () => {};

/**
 * The calendar owns the dialog ref, the generated popover id and the measured
 * placement, so the harness supplies all three.
 *
 * `popoverStyle` deliberately carries only `top`/`left`. The real caller passes
 * `getPopoverStyle(440, 490)`, which also returns `width: 440` - omitted here so
 * the width assertion measures the panel's own `w-[440px]` rather than a number
 * this file handed it.
 */
const Harness = ({
  appointment,
  invoicesByAppointmentId,
  canEditAppointments,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
  onClose,
}: HarnessProps) => {
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const popoverId = useId();
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        Calendar behind the panel. The popover is `position: fixed`, so it floats over this block
        rather than inside it.
      </p>
      <AppointmentPopover
        appointment={appointment}
        invoicesByAppointmentId={invoicesByAppointmentId}
        canEditAppointments={canEditAppointments}
        popoverId={popoverId}
        popoverDialogRef={popoverDialogRef}
        popoverStyle={{ top: 24, left: 24 }}
        handleRescheduleAppointment={handleRescheduleAppointment}
        handleChangeRoomAppointment={handleChangeRoomAppointment}
        handleAcceptAppointment={handleAcceptAppointment}
        onClose={onClose}
        registerAnchorEl={registerAnchorEl}
      />
    </div>
  );
};

const meta = {
  title: 'Appointments/Calendar/AppointmentPopover',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    // No `autodocs`. The panel is `position: fixed` at the coordinates the calendar
    // measures, and `popoverStyle` carries only top/left - so on a generated docs
    // page every story would float at the same spot, stacked on top of each other.
    // The rail and the request buttons carry autodocs in their own story files.
    //
    // `appDirectory`: the companion name, the rail and the primary action all call
    // next/navigation's `useRouter`, so the App Router mock has to be mounted.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The card that opens when you click an appointment block in any calendar view - and the ' +
          'largest single surface in the planner that had never been drawn in Storybook.\n\n' +
          'Reaching it takes a click **and** a wait. `useMarkerInteractions` starts a 180ms timer ' +
          'on mouse-down and only opens the popover if no second click lands, because the same ' +
          'block double-clicks into the workspace. `SlotPortals` then renders it, but only once ' +
          '`activeEvent` and a measured `activeRect` both exist and no drag is in flight. So the ' +
          'panel is three gates deep from a resting render, and every part of it - the header, the ' +
          'eight detail cells, the two staff fields and the action rail - has only ever existed ' +
          'mid-interaction.\n\n' +
          'The detail grid is where the review value is. It is eight `PopoverDetail` cells in a ' +
          'two-column grid, and half of them are **derived**, not passed: the Room cell relabels ' +
          'itself "Room / Unit" when an inpatient unit resolves, the payment cell changes both its ' +
          'label and its value depending on whether an invoice exists and whether it is settled, ' +
          'the Reason cell is the only one that scrolls rather than truncates, and the Duration ' +
          'cell hangs its clock glyph outside its own box on a negative offset. The stories below ' +
          'assert the full [label, value] list rather than "a grid appeared", because a grid that ' +
          'appeared with the wrong eight cells passes the weaker check.\n\n' +
          'Two things a reviewer should look at. First: an appointment with no invoice reads ' +
          '**"Paid: Paid"** - `getAppointmentPaymentDisplay` treats "no invoice" as settled for ' +
          'everything except the legacy NO_PAYMENT status, so the default upcoming booking claims ' +
          'money has changed hands. Second: the Lead and Support fields are real `<input>`s whose ' +
          '`inlabel` is the empty string, so their visible chip labels are decorative spans and ' +
          'the inputs themselves have no accessible name at all.\n\n' +
          'Every store the panel reads (org, companion, workspace encounters, room units) is a ' +
          'plain lookup with no loader attached, so seeding two of them in `beforeEach` is the ' +
          'whole of the setup and nothing here touches the network.',
      },
    },
  },
  args: {
    appointment: APPOINTMENT,
    invoicesByAppointmentId: {},
    canEditAppointments: true,
    handleRescheduleAppointment: fn(),
    handleChangeRoomAppointment: fn(),
    handleAcceptAppointment: fn(),
    onClose: fn(),
  },
  beforeEach: () => {
    const orgSnapshot = useOrgStore.getState();
    const companionSnapshot = useCompanionStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgsById: { [ORG_ID]: HOSPITAL },
      orgIds: [ORG_ID],
      status: 'loaded',
    });
    useCompanionStore.getState().setCompanionsForOrg(ORG_ID, [STORE_COMPANION]);

    return () => {
      useOrgStore.setState(orgSnapshot);
      useCompanionStore.setState(companionSnapshot);
    };
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  name: 'Upcoming (full panel)',
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);
    await expect(panel).not.toBeNull();
    // 440px from the panel's own class. Measured off the box rather than
    // `getComputedStyle().width`, which reports the content box and would read
    // short of the design number on a bordered element.
    await expect(Math.round(panel.getBoundingClientRect().width)).toBe(440);
    // Deliberately non-modal: the calendar stays scrollable underneath and the
    // dialog is a floating card, not a light-dismiss overlay.
    await expect(panel).toHaveAttribute('aria-modal', 'false');

    /* The whole grid in one assertion. Order is part of the design - the two
       columns read Speciality/Duration, Service/Date, Room/Client, Reason/payment -
       so a cell that moved would fail here rather than pass a per-label lookup. */
    await expect(detailPairs(panel)).toEqual([
      ['Speciality', 'Dentistry'],
      ['Duration', timeRangeOf(APPOINTMENT)],
      ['Service', 'Dental consultation'],
      ['Date', longDateOf(APPOINTMENT)],
      ['Room', 'Consult 2'],
      ['Client name', 'Maya'],
      ['Reason', 'Post-op recheck of the left carpus, plus a nail trim if she tolerates it'],
      // No invoice, and the status is not the legacy NO_PAYMENT, so the panel
      // asserts an upcoming appointment has already been paid for.
      ['Paid', 'Paid'],
    ]);

    const tracks = getComputedStyle(detailGrid(panel)).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(detailGrid(panel).children).toHaveLength(8);

    /* The header subline is the merge of two sources: breed and species come from
       the booking payload, age, sex and weight from the companion store. One exact
       string proves both halves arrived and in the right order. */
    await expect(within(panel).getByRole('button', { name: 'Poppy · Whitfield' })).toBeVisible();
    await expect(within(panel).getByText(SUBLINE)).toBeVisible();
    await expect(within(panel).getByRole('button', { name: 'Upcoming' })).toBeVisible();
    await expect(within(panel).getByText('Outpatient')).toBeVisible();

    /* Lead and Support are readonly text inputs with an empty `inlabel`, so their
       visible chips are plain spans that name nothing. The chips are present and
       the fields still have no accessible name - both are asserted, because the
       first without the second reads as a working label. */
    const staffFields = within(panel).getAllByRole('textbox');
    await expect(staffFields).toHaveLength(2);
    await expect(staffFields[0]).toHaveValue('Dr. Elena Marsh');
    await expect(staffFields[1]).toHaveValue('Tom Reyes, Priya Raman');
    await expect(within(panel).getByText('Lead')).toBeVisible();
    await expect(within(panel).queryByRole('textbox', { name: 'Lead' })).toBeNull();

    /* Every button in the panel, in order, rather than a spot check. UPCOMING with
       edit rights is the only status that unlocks all six rail actions - the
       reschedule and assign-room pair are gated on the status as well as the
       permission - so this list is the ceiling the other stories are read down
       from. It also pins that no request buttons appear: UPCOMING is not a
       requested-like status. */
    await expect(buttonNames(panel)).toEqual([
      'Poppy · Whitfield',
      'Upcoming',
      'Appointment overview',
      'Finance summary',
      'Lab tests',
      'Reschedule appointment',
      'Assign room',
      'Medical Records',
      'Start appointment',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as a receptionist sees it on a confirmed booking. Everything below is a ' +
          'variation on this one: the same eight cells, redrawn by a different status, a different ' +
          'invoice or a different permission.',
      },
    },
  },
};

export const Requested: Story = {
  name: 'Booking request (accept / decline)',
  args: { appointment: withAppointment({ status: 'REQUESTED' }) },
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);

    /* Three buttons in the whole panel, and the list says which three. The rail
       and the primary action are both gated on `canEnterAppointmentWorkspace`,
       which excludes REQUESTED, so a request has no clinical entry point at all -
       and the status pill has stopped being a dropdown, which is why no 'Requested'
       trigger appears between the name and the decisions. */
    await expect(buttonNames(panel)).toEqual([
      'Poppy · Whitfield',
      'Accept request',
      'Decline request',
    ]);
    // The pill is still on screen, as a badge rather than a control.
    await expect(within(panel).getByText('Requested')).toBeVisible();

    // The detail grid is unchanged - same eight labels, same order, so nothing
    // about the request status re-forms the body of the card.
    await expect(detailPairs(panel).map(([label]) => label)).toEqual([
      'Speciality',
      'Duration',
      'Service',
      'Date',
      'Room',
      'Client name',
      'Reason',
      'Paid',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A booking request. Three separate things swap at once - the action rail is replaced by ' +
          'the accept/decline pair, the primary action disappears, and the status pill degrades ' +
          'from a dropdown trigger to a static badge - and all three come from different ' +
          'predicates reading the same status. This is the only render where the panel offers no ' +
          'way into the workspace.',
      },
    },
  },
};

export const InpatientWithUnit: Story = {
  name: 'Inpatient (Room / Unit) and emergency',
  args: {
    appointment: withAppointment({
      appointmentKind: 'INPATIENT',
      isEmergency: true,
      status: 'CHECKED_IN',
      room: {
        id: 'room-isolation',
        name: 'Isolation',
        unit: { id: 'unit-kennel-3', name: 'Kennel 3', displayName: 'Kennel 3' },
      },
      concern:
        'Vomiting for 36 hours, suspected foreign body, barrier nursing until the parvo snap test reads',
    }),
  },
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);
    const pairs = detailPairs(panel);

    // Cell five relabels itself. `getAppointmentUnitLabel` only resolves a unit for
    // an INPATIENT encounter, so the same room on an outpatient booking reads
    // "Room / Consult 2" and nothing else changes to warn you.
    await expect(pairs[4]).toEqual(['Room / Unit', 'Isolation / Kennel 3']);
    await expect(within(panel).getByText('Inpatient')).toBeVisible();
    await expect(within(panel).getByText('Emergency')).toBeVisible();

    /* The Reason cell is the only one of the eight that scrolls instead of
       truncating: `scrollValue` swaps `truncate` for an `overflow-x-auto`
       whitespace-nowrap span with its own wheel handler. A long concern therefore
       overflows its own box rather than ending in an ellipsis, which is the
       behaviour a reviewer has to see to judge. */
    const reasonValue = within(panel).getByText(
      'Vomiting for 36 hours, suspected foreign body, barrier nursing until the parvo snap test reads'
    );
    await expect(reasonValue.scrollWidth).toBeGreaterThan(reasonValue.clientWidth);
    await expect(getComputedStyle(reasonValue).whiteSpace).toBe('nowrap');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An admitted, emergency patient. Three things only this render shows: the Room cell ' +
          'carrying a unit, the emergency badge stacked under the status and mode pills in the ' +
          'header column, and the Reason cell overflowing.\n\n' +
          'The Reason cell is worth a second look. It is the one cell that scrolls, and its ' +
          'scrollbar is `scrollbar-x-float` with `pb-3` reserving room for it - so a long concern ' +
          "is reachable by dragging, by shift-wheel, or by the cell's own wheel handler, and by " +
          'nothing else. Every other cell in the grid silently truncates.',
      },
    },
  },
};

export const AmountDue: Story = {
  name: 'Unpaid invoice (Amount Due)',
  args: {
    appointment: withAppointment({ status: 'COMPLETED' }),
    invoicesByAppointmentId: { [APPOINTMENT_ID]: UNPAID_INVOICE },
  },
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);
    const pairs = detailPairs(panel);

    /* Both halves of the cell change together: the label is driven by the payment
       STATE and the value by the invoice TOTAL, from two different helpers. The
       total is rendered with `maximumFractionDigits: 0`, so $184 rather than
       $184.00 - a deliberate rounding this is the only story to show. */
    await expect(pairs[7]).toEqual(['Amount Due', '$184']);
    // Emphasised: this is the one cell in the grid that goes bold ink rather than
    // body ink, which is how it reads as a number rather than as metadata.
    await expect(getComputedStyle(detailGrid(panel).children[7].children[1]).fontWeight).toBe(
      '700'
    );

    /* COMPLETED can no longer be rescheduled or given a room, and it has no
       allowed transition left, so the pill is static too. Worth reading beside the
       read-only story: the two arrive at the SAME five controls from completely
       different causes - one from a permission, one from a terminal status - and
       only the primary action's wording tells them apart. */
    await expect(buttonNames(panel)).toEqual([
      'Poppy · Whitfield',
      'Appointment overview',
      'Finance summary',
      'Lab tests',
      'Medical Records',
      'View appointment',
    ]);
    await expect(within(panel).getByText('Completed')).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A finished visit with an open invoice. Read beside the first story, this is the pair ' +
          'that makes the payment default visible: the same panel says "Paid / Paid" when no ' +
          'invoice exists and "Amount Due / $184" when one does, so the absence of billing data ' +
          'presents as good news rather than as missing data.\n\n' +
          'The primary action also rewords itself - "View appointment" rather than "Start ' +
          'Appointment" - and the button is the same width either way, so the shorter label sits ' +
          'in a fixed `w-50` box.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no edit permission)',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);

    /* The same list as the first story with exactly three entries removed, which
       is the only way to see that the permission does not gate the panel
       uniformly. Reschedule and Assign room drop out of the rail, the status
       trigger stops being a button - and 'Start appointment' is still last,
       because entering the clinical workspace is not gated on
       `canEditAppointments` at all. */
    await expect(buttonNames(panel)).toEqual([
      'Poppy · Whitfield',
      'Appointment overview',
      'Finance summary',
      'Lab tests',
      'Medical Records',
      'Start appointment',
    ]);

    // The status is still readable, as a badge rather than a dropdown.
    await expect(within(panel).getByText('Upcoming')).toBeVisible();

    // The body of the card is untouched by the permission: same eight cells,
    // same values, including the payment default.
    await expect(detailPairs(panel)[7]).toEqual(['Paid', 'Paid']);
    await expect(detailGrid(panel).children).toHaveLength(8);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same appointment for a viewer who cannot edit. Worth pinning because the permission ' +
          'does not gate the panel uniformly: it removes two rail buttons and the status dropdown, ' +
          'and leaves the large primary action that walks into the clinical workspace untouched.',
      },
    },
  },
};

export const RoomImpliesInpatient: Story = {
  name: 'Room implies inpatient (derived mode)',
  args: {
    appointment: withAppointment({ appointmentKind: undefined }),
  },
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);
    /* Identical to the first story except that `appointmentKind` is absent. With no
       kind and no inpatient wording in the service name, `resolveEncounterMode`
       falls back to "has a room, therefore inpatient" - so a 30-minute dental
       consult in Consult 2 is labelled an admission. */
    await expect(within(panel).getByText('Inpatient')).toBeVisible();
    await expect(within(panel).queryByText('Outpatient')).toBeNull();
    // The room cell keeps its plain label only because no unit resolves; assign a
    // unit to this same appointment and it would relabel too.
    await expect(detailPairs(panel)[4]).toEqual(['Room', 'Consult 2']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fallback branch of `resolveEncounterMode`, drawn on purpose. A booking that never ' +
          'declared a kind but was given a consult room reads as **Inpatient** in the header, ' +
          'because room presence is the last resort in the chain. It is a reasonable default for a ' +
          'ward booking and a wrong one for the far more common case of an outpatient consult with ' +
          'a room assigned - and the popover is the surface where it is most visible.',
      },
    },
  },
};

export const RailTooltip: Story = {
  name: 'Rail tooltip escapes the panel',
  play: async ({ canvasElement }) => {
    const panel = openPanel(canvasElement);
    /* `GlassTooltip` binds mouseenter/focusin natively inside an effect, so a single
       dispatch from a play function can land before the listener exists and is lost
       for good - no query-level retry recovers it. `openGlassTooltip` redispatches
       until a bubble that was not already open appears. */
    const wrapper = railWrapper(panel, 'Appointment overview');
    const bubble = await openGlassTooltip(wrapper);

    await expect(bubble).toHaveTextContent('Overview');
    /* The bubble is portalled to `document.body`, so it lives OUTSIDE the dialog
       even though it is anchored to a button inside it. That is the stacking
       question this story exists for: the panel is `z-[1000]` and the bubble is a
       body-level sibling of it, so their order is decided by the portal's own
       z-index rather than by containment. */
    await expect(panel.contains(bubble)).toBe(false);
    await expect(document.body.contains(bubble)).toBe(true);
    await expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);

    // Closed explicitly: opening another wrapper's bubble does not tear this one
    // down, and a leftover on `document.body` outlives this story.
    await closeGlassTooltip(wrapper);
    await expect(within(document.body).queryAllByRole('tooltip')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          "The action rail's labels only exist while a button is hovered, and they are rendered " +
          'into `document.body` rather than into the panel. So the popover has six round icon ' +
          "buttons whose meaning is never inside the dialog's own accessibility tree, and a " +
          'screenshot of the panel can never contain one.\n\n' +
          'The rail itself is storied in full under `Appointments/WorkspaceQuickActions`; this ' +
          'story only pins the one fact that needs the popover to be open - that the bubble ' +
          'escapes the `z-[1000]` dialog instead of being clipped by it.',
      },
    },
  },
};

export const ExitsClosePanel: Story = {
  name: 'Both exits report a close',
  play: async ({ canvasElement, args }) => {
    const panel = openPanel(canvasElement);
    await expect(args.onClose).not.toHaveBeenCalled();

    // The companion name is a button, not a heading: it routes to the animal's
    // history and closes the panel behind it.
    await userEvent.click(within(panel).getByRole('button', { name: 'Poppy · Whitfield' }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);

    /* The panel is still mounted - `AppointmentPopover` never closes itself, it
       reports. In the calendar the parent drops `activePopoverKey` and the portal
       branch stops rendering; here the harness holds it open, which is what makes
       a second exit reachable in one story. */
    await expect(openPanel(canvasElement)).not.toBeNull();

    await userEvent.click(within(panel).getByRole('button', { name: 'Start appointment' }));
    await expect(args.onClose).toHaveBeenCalledTimes(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both routing exits, driven for real. Each one pushes a route and then calls `onClose`, ' +
          'and neither touches the dialog - so "did the popover close?" is a question about the ' +
          "parent's state, never about this component. The story asserts the report rather than " +
          'the disappearance, which is the only thing this component actually controls.',
      },
    },
  },
};
