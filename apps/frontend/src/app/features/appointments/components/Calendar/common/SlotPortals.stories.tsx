import { useId, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useOrgStore } from '@/app/stores/orgStore';
import SlotPortals from './SlotPortals';
import type { MarkerContextMenuState } from './useMarkerInteractions';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-slot-portals-1';

const COMPANION: Appointment['patient'] = {
  id: 'companion-poppy',
  name: 'Poppy',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: 'parent-maya', name: 'Maya Whitfield' },
};

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: COMPANION,
  companion: COMPANION,
  organisationId: ORG_ID,
  lead: { id: 'practitioner-elena', name: 'Dr. Elena Marsh' },
  room: { id: 'room-consult-2', name: 'Consult 2' },
  appointmentType: {
    id: 'svc-dental-consult',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  appointmentKind: 'OUTPATIENT',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Post-op recheck of the left carpus',
};

/**
 * What `openPopover` measured off the clicked marker. Nothing reads its numbers -
 * the panel is placed from `popoverStyle` - so this value is only ever a "has the
 * anchor been measured yet" flag. It is a real DOMRect rather than a cast object so
 * the gate is exercised with the type the calendar actually passes.
 */
const MARKER_RECT = new DOMRect(320, 240, 220, 56);

const CONTEXT_MENU: MarkerContextMenuState = {
  appointment: APPOINTMENT,
  x: 520,
  y: 24,
};

const NO_INVOICES: Record<string, Invoice> = {};

/** The popover panel, wherever in the document it ended up. */
const openPanel = (): HTMLElement | null => document.querySelector('dialog[open]');

/** The right-click menu, matched on the attribute the dismiss logic keys off. */
const contextMenuEl = (): HTMLElement | null =>
  document.querySelector('[data-context-menu="true"]');

type HarnessProps = {
  activeEvent: Appointment | null;
  activeRect: DOMRect | null;
  draggedAppointmentId?: string | null;
  contextMenu: MarkerContextMenuState | null;
  canEditAppointments: boolean;
  invoicesByAppointmentId: Record<string, Invoice>;
  handleViewAppointment: (appt: Appointment) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  handleAcceptAppointment?: (appt: Appointment) => void;
  onPopoverClose: () => void;
  onContextMenuClose: () => void;
};

const registerAnchorEl = () => () => {};

/**
 * Stands in for `Slot`, which owns the refs, the generated popover id and both
 * measured placements. Everything else the real slot passes through untouched.
 *
 * The wrapper is deliberately opaque and sized: the whole claim of these stories is
 * that neither layer ends up inside it, so a visible block to NOT contain them is
 * part of the evidence.
 */
const Harness = ({
  activeEvent,
  activeRect,
  draggedAppointmentId,
  contextMenu,
  canEditAppointments,
  invoicesByAppointmentId,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
  onPopoverClose,
  onContextMenuClose,
}: HarnessProps) => {
  const popoverDialogRef = useRef<HTMLDialogElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const appointmentPopoverId = useId();

  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <div
        data-testid="slot-stand-in"
        className="h-40 w-64 overflow-hidden rounded-2xl border border-card-border bg-card-hover p-3 text-[12px] text-[var(--ink-muted)]"
      >
        The hour slot. It clips its own content, which is the reason both floating layers are
        portalled out of it.
      </div>
      <SlotPortals
        activeEvent={activeEvent}
        activeRect={activeRect}
        draggedAppointmentId={draggedAppointmentId}
        invoicesByAppointmentId={invoicesByAppointmentId}
        canEditAppointments={canEditAppointments}
        appointmentPopoverId={appointmentPopoverId}
        popoverDialogRef={popoverDialogRef}
        popoverStyle={{ top: 24, left: 24 }}
        registerAnchorEl={registerAnchorEl}
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        contextMenuStyle={
          contextMenu ? { top: contextMenu.y, left: contextMenu.x, width: 280 } : null
        }
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        handleChangeRoomAppointment={handleChangeRoomAppointment}
        handleAcceptAppointment={handleAcceptAppointment}
        onPopoverClose={onPopoverClose}
        onContextMenuClose={onContextMenuClose}
      />
    </div>
  );
};

const meta = {
  title: 'Appointments/Calendar/SlotPortals',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    // No `autodocs`: both layers are `position: fixed` at coordinates the calendar
    // measures, so on a generated docs page every story would stack them at the
    // same spot. Their contents are documented in the AppointmentPopover and
    // AppointmentContextMenu story files.
    //
    // `appDirectory`: both layers call next/navigation's `useRouter`.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          "The slot's floating layers. At rest this component renders **literally nothing** - it " +
          'is two guarded `createPortal` calls inside a fragment - which is why nothing about it ' +
          'has ever appeared in a snapshot, a test or a Chromatic frame.\n\n' +
          'The popover branch needs four things true at once: a document to portal into, no drag ' +
          'in flight, an `activeEvent`, and an `activeRect`. In the calendar that state is three ' +
          'interactions deep - click a marker, survive the 180ms double-click timer, then have ' +
          '`usePopoverManager` measure the anchor - so a resting `Slot` is exactly this ' +
          'component rendering nothing.\n\n' +
          'The gates are worth reading individually, because they are not all the same kind of ' +
          'thing. `!draggedAppointmentId` is real behaviour: pick a card up and its popover must ' +
          'get out of the way. `activeRect` is a measurement flag and nothing more - the panel is ' +
          'placed entirely from `popoverStyle`, so the rect is never read, it only proves the ' +
          'anchor was measured. And the two branches are independent here even though the calendar ' +
          'treats them as exclusive: `useMarkerInteractions` clears one before setting the other, ' +
          'but `SlotPortals` will happily render both, so the last story pins what would happen ' +
          'if that invariant ever slipped.\n\n' +
          'Both layers land on `document.body`, outside the canvas, which is the practical reason ' +
          'this needed a story: a play function or a DOM assertion scoped to `canvasElement` finds ' +
          'nothing here and passes for the wrong reason. Every query below is against ' +
          '`document`, and every absence is asserted against `dialog[open]` rather than `dialog`, ' +
          'because a closed dialog stays mounted without its `open` attribute.',
      },
    },
  },
  args: {
    activeEvent: null,
    activeRect: null,
    contextMenu: null,
    canEditAppointments: true,
    invoicesByAppointmentId: NO_INVOICES,
    handleViewAppointment: fn(),
    handleRescheduleAppointment: fn(),
    handleChangeRoomAppointment: fn(),
    handleAcceptAppointment: fn(),
    onPopoverClose: fn(),
    onContextMenuClose: fn(),
  },
  beforeEach: () => {
    const orgSnapshot = useOrgStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    /* `status: 'loading'` is load-bearing, not cosmetic: the context menu calls
       `useLoadRoomsForPrimaryOrg({ force: true })`, and that hook returns at its
       first line on exactly this value. Without it the menu reaches for the rooms
       endpoint the moment it portals. */
    useOrganisationRoomStore.setState({ status: 'loading' });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useOrganisationRoomStore.setState(roomSnapshot);
    };
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: 'At rest (renders nothing)',
  play: async ({ canvasElement }) => {
    // The harness itself is on screen, so the absences below are absences and not
    // a story that failed to mount.
    await expect(within(canvasElement).getByTestId('slot-stand-in')).toBeVisible();

    await expect(openPanel()).toBeNull();
    await expect(contextMenuEl()).toBeNull();
    /* Three hooks, all absent, all queried against the whole document rather than
       the canvas - "no dialog inside the canvas" is true in every story in this
       file, including the ones where the panel is open on document.body.
       `dialog` rather than `dialog[open]` is the stronger claim: a closed dialog
       stays mounted without its `open` attribute, so counting bare `dialog`
       elements says none was ever created. */
    await expect(document.querySelectorAll('dialog')).toHaveLength(0);
    await expect(document.querySelectorAll('[data-popover-panel]')).toHaveLength(0);
    await expect(document.querySelectorAll('[data-context-menu]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a resting calendar is in for the entire time nobody is clicking: no panel, no ' +
          'menu, no dialog element in the document at all. Everything else in this file is a ' +
          'departure from here.',
      },
    },
  },
};

export const PopoverOpen: Story = {
  name: 'Popover portal (marker clicked)',
  args: { activeEvent: APPOINTMENT, activeRect: MARKER_RECT },
  play: async ({ canvasElement }) => {
    const panel = openPanel() as HTMLElement;
    await expect(panel).not.toBeNull();

    /* Where it landed is the point. `createPortal(..., document.body)` makes the
       panel a direct child of body, so it escapes the slot's `overflow-auto` and is
       nowhere inside the canvas - which is what a canvas-scoped assertion would
       have silently missed. */
    await expect(panel.parentElement).toBe(document.body);
    await expect(canvasElement.contains(panel)).toBe(false);

    // A live panel, not an empty shell: the header button and the full eight-cell
    // detail grid both arrived through the portal. Track count as well as child
    // count - a two-column grid holding four cells and a one-column grid holding
    // eight are different bugs, and each check alone misses one of them.
    const detailGrid = within(panel).getByText('Speciality').closest('.grid') as HTMLElement;
    const tracks = getComputedStyle(detailGrid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(detailGrid.children).toHaveLength(8);
    await expect(within(panel).getByRole('button', { name: 'Poppy · Whitfield' })).toBeVisible();
    await expect(within(panel).getByRole('button', { name: 'Start Appointment' })).toBeVisible();

    // The other branch stayed shut - the two portals are separately gated.
    await expect(contextMenuEl()).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both popover conditions satisfied. This is what a marker click produces 180ms after the ' +
          'pointer goes down, assuming no second click lands and no drag has begun.\n\n' +
          'The assertion that matters is `panel.parentElement === document.body`. The slot section ' +
          'this component renders beside is `overflow-auto` inside a 180px hour row, so a panel ' +
          'rendered in place would be clipped to a sliver. The portal is the only reason the card ' +
          'is visible at all.',
      },
    },
  },
};

export const HiddenDuringDrag: Story = {
  name: 'Suppressed while a card is dragged',
  args: {
    activeEvent: APPOINTMENT,
    activeRect: MARKER_RECT,
    draggedAppointmentId: 'appt-being-moved',
  },
  play: async ({ canvasElement }) => {
    /* Positive control first. Everything this story claims is an absence, and a
       story that failed to mount produces every one of those absences too - so
       the harness has to be proven on screen before the missing panel means
       anything. */
    await expect(within(canvasElement).getByTestId('slot-stand-in')).toBeVisible();

    /* Identical props to the story above plus one drag id, and the panel is gone.
       Note the id belongs to a DIFFERENT appointment: the gate is "is any drag in
       flight", not "is this appointment being dragged", so picking up any card in
       the grid dismisses an open popover anywhere in it. */
    await expect(openPanel()).toBeNull();
    await expect(document.querySelectorAll('dialog')).toHaveLength(0);
    await expect(document.querySelectorAll('[data-popover-panel]')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A drag is in flight. `Slot` also clears `activePopoverKey` during render when the drag ' +
          'id changes, so in the running app this gate is belt and braces - but it is the only one ' +
          'of the two that lives in this component, and it is the reason a popover never floats ' +
          'over a card being moved.\n\n' +
          'Read against the story above, this pair is the whole behaviour: same event, same rect, ' +
          'one extra prop, no panel.',
      },
    },
  },
};

export const AwaitingMeasurement: Story = {
  name: 'Event without a measured rect',
  args: { activeEvent: APPOINTMENT, activeRect: null },
  play: async ({ canvasElement }) => {
    // Same positive control as the drag story: prove the mount, then the absence.
    await expect(within(canvasElement).getByTestId('slot-stand-in')).toBeVisible();

    // The rect is a precondition even though nothing ever reads its numbers, so an
    // event that arrived before its anchor was measured draws nothing at all.
    await expect(openPanel()).toBeNull();
    await expect(document.querySelectorAll('dialog')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The defensive half of the gate. `usePopoverManager.openPopover` sets the rect and the ' +
          'key in the same tick, so this combination is not reachable by clicking - but the ' +
          'condition is in the source, and what it does is refuse to draw rather than draw at the ' +
          'origin.\n\n' +
          'Worth knowing because the rect is otherwise dead weight in this component: placement ' +
          'comes from `popoverStyle`, which `Slot` computes with `getPopoverStyle(440, 490)` from ' +
          'that same rect one level up. Here it is a boolean wearing a DOMRect.',
      },
    },
  },
};

export const ContextMenuOnly: Story = {
  name: 'Context menu portal (right-click)',
  args: { contextMenu: CONTEXT_MENU },
  play: async ({ canvasElement }) => {
    const menu = contextMenuEl() as HTMLElement;
    await expect(menu).not.toBeNull();
    await expect(menu.parentElement).toBe(document.body);
    await expect(canvasElement.contains(menu)).toBe(false);

    /* The rows, not just the box. Which rows appear is derived from five separate
       predicates reading the status and the permission, so an UPCOMING booking for
       an editor gets all eight - and an empty menu would satisfy a presence check
       just as well. */
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());
    await expect(items).toEqual([
      'View appointment',
      'Open companion overview',
      'Medical Records',
      'Finance summary',
      'Lab tests',
      'Change status',
      'Reschedule',
      'Assign room',
    ]);

    await expect(openPanel()).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second portal, opened on its own. It is gated on `contextMenu` **and** ' +
          '`contextMenuStyle`, and the style is computed from the click coordinates clamped 12px ' +
          'inside the viewport - so a right-click near the bottom edge produces a menu that has ' +
          'already been moved before it renders.\n\n' +
          "The menu's own behaviour (submenus, status changes, room assignment) is storied under " +
          '`Appointments/AppointmentContextMenu`. What this story adds is that the rows survive ' +
          'the portal hop intact and land on `document.body` rather than in the slot.',
      },
    },
  },
};

export const BothLayers: Story = {
  name: 'Both layers at once (menu wins)',
  args: { activeEvent: APPOINTMENT, activeRect: MARKER_RECT, contextMenu: CONTEXT_MENU },
  play: async () => {
    const panel = openPanel() as HTMLElement;
    const menu = contextMenuEl() as HTMLElement;
    await expect(panel).not.toBeNull();
    await expect(menu).not.toBeNull();

    // Two independent portals, two direct children of body - neither nests inside
    // the other, so their order is decided by z-index alone.
    await expect(panel.parentElement).toBe(document.body);
    await expect(menu.parentElement).toBe(document.body);
    await expect(panel.contains(menu)).toBe(false);

    // The menu is z-[1001] against the panel's z-[1000]: a single step, and the
    // right-click menu is the layer that wins.
    await expect(getComputedStyle(panel).zIndex).toBe('1000');
    await expect(getComputedStyle(menu).zIndex).toBe('1001');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both branches handed live props at the same time. The calendar never does this - ' +
          '`handleMarkerClick` clears the menu and `handleMarkerContextMenu` clears the popover key ' +
          '- but the exclusion lives in `useMarkerInteractions`, not here, so this is what the ' +
          'component would draw if that ever slipped.\n\n' +
          'The answer is a one-step z-index difference, which is a thin margin for two overlapping ' +
          'glass panels: the menu covers the popover, the popover stays interactive underneath, ' +
          'and neither one dismisses the other. Worth deciding deliberately rather than inheriting ' +
          'from two literals written a hundred lines apart.',
      },
    },
  },
};
