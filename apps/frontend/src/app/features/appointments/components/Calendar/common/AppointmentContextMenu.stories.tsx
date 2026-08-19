import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, Organisation, OrganisationRoom, RoomUnit } from '@yosemite-crew/types';

import AppointmentContextMenu from './AppointmentContextMenu';
import type { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

const ORG_ID = 'org-storybook';

const room = (id: string, name: string, type: OrganisationRoom['type']): OrganisationRoom => ({
  id,
  name,
  organisationId: ORG_ID,
  code: id.toUpperCase(),
  type,
});

const ROOMS: OrganisationRoom[] = [
  room('room-consult-1', 'Consult 1', 'EXAM_ROOM'),
  room('room-consult-2', 'Consult 2', 'EXAM_ROOM'),
  room('room-theatre', 'Theatre', 'SURGERY'),
  room('room-isolation', 'Isolation ward', 'ISOLATION'),
];

const unit = (id: string, roomId: string, isOccupied: boolean): RoomUnit => ({
  id,
  organisationId: ORG_ID,
  roomId,
  code: id.toUpperCase(),
  displayName: id,
  isActive: true,
  isOccupied,
});

/**
 * Theatre's only kennel is taken and Isolation's is free. This only changes what
 * the room submenu offers for an INPATIENT booking, where
 * `toAssignableRoomOptions` is called with `requireAssignableUnit`.
 */
const ROOM_UNITS: RoomUnit[] = [
  unit('theatre-bay-1', 'room-theatre', true),
  unit('isolation-kennel-1', 'room-isolation', false),
];

const APPOINTMENT: Appointment = {
  id: 'appt-context-1',
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
  organisationId: ORG_ID,
  room: { id: 'room-consult-2', name: 'Consult 2' },
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
};

const withAppointment = (patch: Partial<Appointment>): Appointment => ({
  ...APPOINTMENT,
  ...patch,
});

type SeedOptions = {
  rooms?: OrganisationRoom[];
  roomUnits?: RoomUnit[];
  orgType?: string;
};

/**
 * Seeds the two stores the menu reads and puts them back afterwards.
 *
 * `status: 'loading'` is deliberate rather than cosmetic: `useLoadRoomsForPrimaryOrg`
 * bails out early on exactly that value, so the menu never reaches for the rooms
 * endpoint and these stories stay offline and deterministic.
 */
const seedStores =
  ({ rooms = ROOMS, roomUnits = ROOM_UNITS, orgType }: SeedOptions = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgsById: orgType
        ? { [ORG_ID]: { id: ORG_ID, type: orgType } as unknown as Organisation }
        : {},
      status: 'loaded',
    });

    useOrganisationRoomStore.setState({
      roomsById: Object.fromEntries(rooms.map((item) => [item.id, item])),
      roomIdsByOrgId: { [ORG_ID]: rooms.map((item) => item.id) },
      roomUnitsById: Object.fromEntries(roomUnits.map((item) => [item.id, item])),
      roomUnitIdsByRoomId: roomUnits.reduce<Record<string, string[]>>((acc, item) => {
        acc[item.roomId] = [...(acc[item.roomId] ?? []), item.id];
        return acc;
      }, {}),
      status: 'loading',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useOrganisationRoomStore.setState(roomSnapshot);
    };
  };

/** Where the calendar would have dropped the menu after a right-click. */
const MENU_STYLE = { top: 32, left: 32 };

type HarnessProps = {
  appointment: Appointment;
  canEditAppointments: boolean;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  onClose: () => void;
};

/**
 * The calendar owns the ref and the measured coordinates, so the harness supplies
 * both. The menu itself is `position: fixed`, which the inline style cannot
 * override here - `menuStyle` only contributes `top` and `left` - so it floats at
 * the viewport origin rather than inside this block.
 */
const Harness = ({
  appointment,
  canEditAppointments,
  handleViewAppointment,
  handleRescheduleAppointment,
  onClose,
}: HarnessProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="min-h-[460px] p-6">
      <AppointmentContextMenu
        appointment={appointment}
        canEditAppointments={canEditAppointments}
        menuRef={menuRef}
        menuStyle={MENU_STYLE}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        onClose={onClose}
      />
    </div>
  );
};

const meta = {
  title: 'Appointments/AppointmentContextMenu',
  component: Harness,
  parameters: {
    // No `autodocs`: the menu and both submenus are `position: fixed` at
    // coordinates the calendar measures, and `menuStyle` carries only top/left -
    // so on a generated docs page every story would float at the same spot on
    // top of the page and on top of each other. The sibling `RoomSubmenu` and
    // `StatusSubmenu` stories carry the autodocs for the panels themselves.
    layout: 'fullscreen',
    // `openCompanionHistory` and `openWorkspace` call next/navigation's useRouter.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The right-click menu on a calendar appointment block, and the composition its two ' +
          'submenus were only ever storied apart from.\n\n' +
          '`RoomSubmenu` and `StatusSubmenu` already had stories, but nothing had ever rendered ' +
          'the thing that decides *whether they appear at all*. That decision is data, not ' +
          'decoration, and it is spread across five separate predicates: ' +
          '`canEnterAppointmentWorkspace` adds the three clinical rows, ' +
          '`getAllowedAppointmentStatusTransitions` adds Change status only when the current ' +
          'status has somewhere to go, `allowReschedule` adds Reschedule, ' +
          '`canAssignAppointmentRoom` adds Assign room, and `canEditAppointments` gates the last ' +
          'three together. An `UPCOMING` appointment therefore has eight rows and a `REQUESTED` ' +
          'one has three - a different menu, not a dimmed one.\n\n' +
          'This is the surface class that shipped four production bugs on this branch: a popover ' +
          'whose grid template used a comma and collapsed six children into one column, two ' +
          'calendar overlays whose orphaned grid child doubled their height, and dropdown text ' +
          'using fill tokens instead of ink tokens. All four needed an interaction to reach, so ' +
          'tsc, eslint and jest were all blind to them. Here the submenus need **two** ' +
          'interactions - open the menu, then hover a row - which is why the stories drive them ' +
          'with `play` rather than an arg.\n\n' +
          'The submenu geometry is the part that has never been reviewed as a whole. ' +
          '`useAppointmentContextSubmenuPosition` first guesses from `MENU_ESTIMATED_WIDTH` ' +
          '(220px) plus a 10px gap, then re-measures in a `useLayoutEffect` and flips the panel ' +
          'to the left of the menu if the guess would push it past `innerWidth - 12`. Only a ' +
          'story with the submenu actually open shows which side it lands on.\n\n' +
          'Both stores are seeded rather than fetched, and the room store is seeded `loading` so ' +
          '`useLoadRoomsForPrimaryOrg` short-circuits and nothing here touches the network.',
      },
    },
  },
  args: {
    appointment: APPOINTMENT,
    canEditAppointments: true,
    handleViewAppointment: fn(),
    handleRescheduleAppointment: fn(),
    onClose: fn(),
  },
  beforeEach: seedStores(),
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  name: 'Upcoming (full menu)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = canvas.getByRole('menu', { name: 'Appointment context actions' });
    // Count the rows rather than assert the menu exists: which rows are present
    // is the whole behaviour here, and an empty menu would pass the weaker check.
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(8);
    await expect(within(menu).getByRole('menuitem', { name: 'Medical Records' })).toBeVisible();
    await expect(within(menu).getByRole('menuitem', { name: 'Change status' })).toBeVisible();
    await expect(within(menu).getByRole('menuitem', { name: 'Assign room' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every row an editor sees on an upcoming booking: two navigation rows, the three ' +
          'clinical rows that `canEnterAppointmentWorkspace` unlocks, and the three edit rows. ' +
          'The two submenu rows are the only ones with a trailing chevron.',
      },
    },
  },
};

export const StatusSubmenuOpen: Story = {
  name: 'Change status submenu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('menuitem', { name: 'Change status' }));
    const submenu = await canvas.findByRole('menu', { name: 'Change appointment status' });
    // Two interactions deep, and the transitions are derived - assert the rows.
    await expect(within(submenu).getAllByRole('menuitem')).toHaveLength(3);
    await expect(within(submenu).getByText('Checked in')).toBeInTheDocument();
    await expect(within(submenu).getByText('No show')).toBeInTheDocument();
    // The parent row must advertise the open submenu.
    await expect(canvas.getByRole('menuitem', { name: 'Change status' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three transitions allowed out of `UPCOMING`, flown out beside the menu. This is ' +
          'the first story that composites the two glass panels together, which is where their ' +
          'shared `--hairline` dividers and 22px radii have to agree.',
      },
    },
  },
};

export const RoomSubmenuOpen: Story = {
  name: 'Assign room submenu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('menuitem', { name: 'Assign room' }));
    const submenu = await canvas.findByRole('menu', { name: 'Assign appointment room' });
    // Four rooms plus the Clear room row the component prepends because the
    // appointment already has one.
    await expect(within(submenu).getAllByRole('menuitemradio')).toHaveLength(5);
    await expect(within(submenu).getByRole('menuitemradio', { name: /Clear room/ })).toBeVisible();
    // Exactly the currently assigned room is checked, and it is the one carrying
    // the "Current" tag.
    const checked = within(submenu).getAllByRole('menuitemradio', { checked: true });
    await expect(checked).toHaveLength(1);
    await expect(checked[0]).toHaveAccessibleName(/Consult 2/);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The room picker built from the seeded room store. `Clear room` only exists because ' +
          'this appointment already has one assigned - on an unassigned booking the list is the ' +
          'rooms alone, so the row count is not a constant.',
      },
    },
  },
};

export const InpatientRoomSubmenu: Story = {
  name: 'Inpatient room submenu (occupied rooms dropped)',
  args: { appointment: withAppointment({ appointmentKind: 'INPATIENT', room: undefined }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('menuitem', { name: 'Assign room' }));
    const submenu = await canvas.findByRole('menu', { name: 'Assign appointment room' });
    // INPATIENT passes `requireAssignableUnit`, so Theatre - whose only unit is
    // occupied - drops out, and with no room assigned there is no Clear row.
    await expect(within(submenu).getAllByRole('menuitemradio')).toHaveLength(3);
    await expect(within(submenu).queryByText('Theatre')).not.toBeInTheDocument();
    await expect(within(submenu).getByText('Isolation ward')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch the outpatient story cannot show. For an `INPATIENT` booking the list is ' +
          'filtered by unit availability: rooms with no known units stay (nothing to contradict), ' +
          'rooms with a free unit stay, and a room whose only unit is occupied disappears ' +
          'entirely rather than appearing disabled. A shorter list is the only signal, so it ' +
          'needs to be seen next to the unfiltered one.',
      },
    },
  },
};

export const NoRoomsConfigured: Story = {
  name: 'No rooms configured',
  args: { appointment: withAppointment({ room: undefined }) },
  beforeEach: seedStores({ rooms: [], roomUnits: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('menuitem', { name: 'Assign room' }));
    const submenu = await canvas.findByRole('menu', { name: 'Assign appointment room' });
    await expect(within(submenu).getByText('No rooms available')).toBeInTheDocument();
    await expect(within(submenu).queryAllByRole('menuitemradio')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An org that has not set rooms up yet. The row still opens a submenu rather than being ' +
          'hidden, and the empty panel says so at 9px - noticeably smaller than the 13px rows ' +
          'next to it. This is exactly the state an `aria-expanded` assertion would have called ' +
          'healthy.',
      },
    },
  },
};

export const CheckedIn: Story = {
  name: 'Checked in (no reschedule)',
  args: { appointment: withAppointment({ status: 'CHECKED_IN' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = canvas.getByRole('menu', { name: 'Appointment context actions' });
    // Reschedule drops out; Change status stays but offers a single transition.
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(7);
    await expect(
      within(menu).queryByRole('menuitem', { name: 'Reschedule' })
    ).not.toBeInTheDocument();
    await userEvent.hover(within(menu).getByRole('menuitem', { name: 'Change status' }));
    const submenu = await canvas.findByRole('menu', { name: 'Change appointment status' });
    await expect(within(submenu).getAllByRole('menuitem')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once the patient is in the building the appointment can no longer be rescheduled, so ' +
          'that row is removed rather than disabled - and the status submenu shrinks to the one ' +
          'legal move. A single-row submenu is where a panel sized from its trigger instead of ' +
          'its content shows up.',
      },
    },
  },
};

export const Requested: Story = {
  name: 'Requested (three rows)',
  args: { appointment: withAppointment({ status: 'REQUESTED', room: undefined }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = canvas.getByRole('menu', { name: 'Appointment context actions' });
    // No workspace, no status transitions, no room - Reschedule is all that is left.
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    await expect(
      within(menu).queryByRole('menuitem', { name: 'Change status' })
    ).not.toBeInTheDocument();
    await expect(within(menu).getByRole('menuitem', { name: 'Reschedule' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The shortest menu. A requested appointment cannot enter the workspace, and ' +
          '`isRequestedLikeStatus` short-circuits the status transitions before ' +
          '`getAllowedAppointmentStatusTransitions` is consulted at all - so neither submenu row ' +
          'exists. At three rows the panel is barely taller than its 22px radius, which is the ' +
          'shape worth checking.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (canEditAppointments false)',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = canvas.getByRole('menu', { name: 'Appointment context actions' });
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(5);
    await expect(
      within(menu).queryByRole('menuitem', { name: 'Assign room' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Without edit permission all three edit rows vanish together and the menu is purely ' +
          'navigational. Nothing is dimmed - a row that reads as inactive but stays clickable is ' +
          'its own defect - so the only cue is that the chevrons are gone.',
      },
    },
  },
};

export const GroomerTerminology: Story = {
  name: 'Non-hospital org (Care, not Medical Records)',
  beforeEach: seedStores({ orgType: 'GROOMER' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = canvas.getByRole('menu', { name: 'Appointment context actions' });
    // getClinicalNotesLabel switches on the org type read from the org store.
    await expect(within(menu).getByRole('menuitem', { name: 'Care' })).toBeVisible();
    await expect(
      within(menu).queryByRole('menuitem', { name: 'Medical Records' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The clinical row is relabelled from the org type, and it also changes where it goes - ' +
          '`prescription/subjective` for a hospital, `care/forms` for everyone else. The label is ' +
          'a third the length of the hospital one, so this is the story that shows the menu ' +
          'sizing itself to `max-content` under a 220px cap.',
      },
    },
  },
};
