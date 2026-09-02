import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, OrganisationRoom, RoomUnit, Service } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import ViewAppointmentOverviewModal from './index';

const ORG_ID = 'org-storybook-overview';
const SPECIALITY_ID = 'spec-general';
const SERVICE_ID = 'svc-annual';
const ROOM_ID = 'room-consult-2';
const WARD_ID = 'room-ward-a';

const APPOINTMENT: Appointment = {
  id: 'appt-overview-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  supportStaff: [{ id: 'tech-1', name: 'Ana Silva' }],
  room: { id: ROOM_ID, name: 'Consult 2' },
  appointmentType: {
    id: SERVICE_ID,
    name: 'Annual check-up',
    speciality: { id: SPECIALITY_ID, name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Limping on the left hind leg since Sunday.',
  isEmergency: false,
};

const room = (id: string, name: string): OrganisationRoom => ({
  id,
  name,
  organisationId: ORG_ID,
  code: id.toUpperCase(),
  type: 'CONSULTATION',
});

const unit = (id: string, code: string, displayName: string): RoomUnit => ({
  id,
  organisationId: ORG_ID,
  roomId: WARD_ID,
  code,
  displayName,
  isActive: true,
  isOccupied: false,
});

const SERVICE: Service = {
  id: SERVICE_ID,
  organisationId: ORG_ID,
  name: 'Annual check-up',
  durationMinutes: 30,
  cost: 82,
  maxDiscount: 12,
  specialityId: SPECIALITY_ID,
  isActive: true,
};

const UNITS: RoomUnit[] = [unit('unit-a1', 'A1', 'Kennel A1'), unit('unit-a2', 'A2', 'Kennel A2')];

/**
 * Seeds the room, service and org stores and restores them on unmount.
 *
 * The modal does fire one request on open - `loadRoomsForOrgPrimaryOrg({ force: true,
 * silent: true })` - but it is `.catch`ed to nothing and only ever WRITES the store on
 * success, so a Storybook run with no backend leaves these seeds exactly as they are.
 * That is why the room dropdown here has real options rather than being empty.
 */
const seed = (rooms: OrganisationRoom[], units: RoomUnit[] = []) => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();
    const serviceSnapshot = useServiceStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgsById: { [ORG_ID]: { _id: ORG_ID, type: 'HOSPITAL' } as never },
      status: 'loaded',
    });
    useOrganisationRoomStore.setState({
      roomsById: Object.fromEntries(rooms.map((item) => [item.id, item])),
      roomIdsByOrgId: { [ORG_ID]: rooms.map((item) => item.id) },
      roomUnitsById: Object.fromEntries(units.map((item) => [item.id, item])),
      roomUnitIdsByRoomId: units.length ? { [WARD_ID]: units.map((item) => item.id) } : {},
      status: 'loaded',
    });
    useServiceStore.setState({
      servicesById: { [SERVICE_ID]: SERVICE },
      serviceIdsBySpecialityId: { [SPECIALITY_ID]: [SERVICE_ID] },
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useOrganisationRoomStore.setState(roomSnapshot);
      useServiceStore.setState(serviceSnapshot);
    };
  };
};

type ModalProps = ComponentProps<typeof ViewAppointmentOverviewModal>;

/**
 * Opened from a trigger rather than parked open. `ModalBase` takes a ref-counted
 * scroll lock on `document.body` while open, so a story that sat open would hold the
 * whole docs page under `overflow: hidden`.
 */
const Harness = (args: ModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[560px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-text-primary px-6 py-3 text-body-3-emphasis text-[var(--screen)]"
        onClick={() => setOpen(true)}
      >
        Open overview
      </button>
      <ViewAppointmentOverviewModal
        {...args}
        showModal={open}
        setShowModal={(value) => {
          setOpen(value);
          args.setShowModal(value);
        }}
      />
    </div>
  );
};

/**
 * The panel lives on `document.body`, not in the story canvas, and it mounts a tick
 * after the click - so the lookup is polled rather than read once. Absence is asserted
 * against `dialog[open]` specifically: a closed dialog stays mounted without the attribute.
 */
const openOverview = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open overview' }));
  await waitFor(() => {
    expect(document.body.querySelector('dialog[open]')).toBeInTheDocument();
  });
  return within(document.body.querySelector('dialog[open]') as HTMLElement);
};

/**
 * `LabelDropdown` portals its panel to `document.body` to escape the dialog's
 * `overflow-y-auto` body, and positions it from the trigger rect in a layout effect, so
 * it is not in the tree on the click tick. Polled, then re-read outside the callback -
 * a helper that mutated the DOM inside `waitFor` would re-queue forever instead of failing.
 */
const findPortalDropdown = async (): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(document.body.querySelector('[data-portal-dropdown]')).toBeInTheDocument();
  });
  return document.body.querySelector('[data-portal-dropdown]') as HTMLElement;
};

/**
 * The two-column body: `grid-cols-1` with `md:grid-cols-2`, the outermost `.grid` in
 * the dialog and so the first in document order. Measured as resolved tracks, because
 * the class name alone proves nothing about what the browser actually laid out.
 */
const trackCount = (element: HTMLElement): number =>
  getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length;

const getBodyGrid = (): HTMLElement =>
  document.body.querySelector('dialog[open] .grid') as HTMLElement;

const meta = {
  title: 'Appointments/ViewAppointmentOverviewModal',
  component: ViewAppointmentOverviewModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Appointment details" panel that opens from a board card - the two-column ' +
          'overview a clinician reads before starting a visit. The shell around it had a story; ' +
          'the body inside it never did, and the body is where every conditional lives.\n\n' +
          'Three of them matter. **RoomSelectorSection** renders the same field two completely ' +
          'different ways: an editable `LabelDropdown` when the status allows a room change, ' +
          'and a read-only bordered box otherwise - same label, same slot, different element, ' +
          'so a status that flips the branch silently removes an interactive control. The ' +
          '**Unit** selector only exists for `INPATIENT` bookings and only offers units that ' +
          'are active and unoccupied, which means an all-occupied ward renders an empty ' +
          'dropdown rather than an error. And the **blocked panel** under the columns appears ' +
          'for requested, cancelled and no-show appointments, alongside a disabled footer CTA.\n' +
          '\n' +
          'The estimate panel is a fourth: it prefers the real invoice total when one exists ' +
          'and otherwise derives cost minus max discount from the service catalogue, so it is ' +
          'seeded from `serviceStore` here rather than passed in.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    activeAppointment: APPOINTMENT,
    canEditAppointments: true,
    onOpenDetails: fn(),
  },
  render: (args) => <Harness {...args} />,
  beforeEach: seed([room(ROOM_ID, 'Consult 2'), room('room-consult-3', 'Consult 3')]),
} satisfies Meta<typeof ViewAppointmentOverviewModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  name: 'Upcoming - room editable',
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);

    // Left column: the people and the schedule.
    await expect(panel.getByRole('heading', { name: 'Appointment details' })).toBeInTheDocument();
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
    await expect(panel.getByText('Lena Hartmann')).toBeInTheDocument();
    await expect(panel.getByText('Dr. Weber')).toBeInTheDocument();
    await expect(panel.getByText('Ana Silva')).toBeInTheDocument();
    await expect(panel.getByText('30 mins')).toBeInTheDocument();

    // Right column: the appointment rows.
    await expect(panel.getByText('General practice')).toBeInTheDocument();
    await expect(panel.getByText('Limping on the left hind leg since Sunday.')).toBeInTheDocument();
    // Scoped to its own row: a bare `getByText('No')` would be ambiguous the moment
    // any other row answers with the same word.
    const emergencyRow = panel.getByText('Emergency').parentElement as HTMLElement;
    await expect(within(emergencyRow).getByText('No')).toBeInTheDocument();

    // Room is the EDITABLE branch here, and the trigger carries the current value
    // in its accessible name.
    const roomTrigger = panel.getByRole('button', { name: 'Room: Consult 2' });
    await expect(roomTrigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(roomTrigger).toHaveAttribute('aria-expanded', 'false');

    // No unit selector: this is an outpatient booking.
    await expect(panel.queryByRole('button', { name: /^Unit/ })).not.toBeInTheDocument();

    // Estimate falls back to the catalogue (82 cost - 12 max discount) because no
    // invoice exists for this appointment.
    await expect(panel.getByText('$70.00')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Start appointment' })).toBeEnabled();

    // The "two-column" claim, measured: two resolved tracks holding exactly the two
    // column components. A collapse to one track would still render every row above.
    const grid = getBodyGrid();
    await expect(trackCount(grid)).toBe(2);
    await expect(grid.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday panel. Both columns are populated, the room is a live dropdown, and ' +
          'the footer reads "Start appointment" because the status is UPCOMING - the label ' +
          'switches to "View details" for every other status.',
      },
    },
  },
};

export const RoomDropdownOpen: Story = {
  name: 'Room dropdown open',
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);
    const roomTrigger = panel.getByRole('button', { name: 'Room: Consult 2' });
    await userEvent.click(roomTrigger);

    await expect(roomTrigger).toHaveAttribute('aria-expanded', 'true');

    /* The panel is portalled to document.body, so it is NOT inside the dialog - and it
       is a labelled <div> of <button>s rather than a listbox with options, despite the
       trigger advertising `aria-haspopup="listbox"`. Queried as buttons because that
       is what is actually in the tree. */
    const dropdown = await findPortalDropdown();
    await expect(
      within(dropdown)
        .getAllByRole('button')
        .map((option) => option.textContent?.trim())
    ).toEqual(['Consult 2', 'Consult 3']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every consulting room in the organisation, with the current one marked. The list ' +
          'is portalled out of the dialog to escape its `overflow-y-auto` body - which is also ' +
          'why the shell has to whitelist `[data-portal-dropdown]` in its outside-click guard, ' +
          'or picking a room would dismiss the panel.',
      },
    },
  },
};

export const InpatientUnitSelector: Story = {
  name: 'Inpatient - Unit selector',
  args: {
    activeAppointment: {
      ...APPOINTMENT,
      appointmentKind: 'INPATIENT',
      room: { id: WARD_ID, name: 'Ward A' },
    },
  },
  beforeEach: seed([room(WARD_ID, 'Ward A'), room(ROOM_ID, 'Consult 2')], UNITS),
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);

    // Two dropdowns now, not one: Room and the inpatient-only Unit.
    await expect(panel.getByRole('button', { name: 'Room: Ward A' })).toBeInTheDocument();
    const unitTrigger = panel.getByRole('button', { name: 'Unit: Kennel A1' });
    await userEvent.click(unitTrigger);

    const dropdown = await findPortalDropdown();
    await expect(
      within(dropdown)
        .getAllByRole('button')
        .map((option) => option.textContent?.trim())
    ).toEqual(['Kennel A1', 'Kennel A2']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An inpatient booking. The Unit field is added under Room and pre-selects the first ' +
          'assignable unit in the ward, which is why the trigger already reads "Kennel A1" ' +
          'before anything is touched - the appointment itself carries no unit.',
      },
    },
  },
};

export const BlockedWorkspace: Story = {
  name: 'Cancelled - workspace blocked, room read-only',
  args: {
    activeAppointment: { ...APPOINTMENT, status: 'CANCELLED' },
  },
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);

    // The blocked note is built from the status label, so it names the status back.
    await expect(
      panel.getByText('Cancelled appointments cannot be opened in the clinical workspace.')
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'View details' })).toBeDisabled();

    // Room has fallen to the read-only branch: the label survives, the control does not.
    await expect(panel.queryByRole('button', { name: /^Room/ })).not.toBeInTheDocument();
    await expect(panel.getByText('Room')).toBeInTheDocument();
    await expect(panel.getByText('Consult 2')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cancelled appointment. Two things change at once and both are easy to lose: the ' +
          'room dropdown becomes a bordered read-only box carrying the same value, and a ' +
          'neutral panel appears under the columns explaining why the CTA underneath it is ' +
          'dead. The CTA is disabled rather than hidden, so the panel is the only thing that ' +
          'says why.',
      },
    },
  },
};

export const CompletedHidesEstimate: Story = {
  name: 'Completed - estimate panel gone',
  args: {
    activeAppointment: { ...APPOINTMENT, status: 'COMPLETED' },
  },
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);

    // A completed visit has a bill, not an estimate, so the whole panel is dropped.
    await expect(panel.queryByText('Estimate')).not.toBeInTheDocument();
    await expect(panel.queryByText('$70.00')).not.toBeInTheDocument();
    // The workspace is still reachable for a completed appointment.
    await expect(panel.getByRole('button', { name: 'View details' })).toBeEnabled();
    // Room is read-only here too - assignment stops at IN_PROGRESS.
    await expect(panel.queryByRole('button', { name: /^Room/ })).not.toBeInTheDocument();

    /* Everything above the dropped panel is still drawn. Without these the story would
       be four absence checks, which a panel that failed to render at all would also
       satisfy - the estimate is missing because the status says so, not because the
       body is empty. Room keeps its value in the read-only box. */
    await expect(panel.getByRole('heading', { name: 'Appointment details' })).toBeInTheDocument();
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
    await expect(panel.getByText('General practice')).toBeInTheDocument();
    await expect(panel.getByText('Room')).toBeInTheDocument();
    await expect(panel.getByText('Consult 2')).toBeInTheDocument();
    // And the blocked panel is NOT here: completed is reachable, cancelled is not.
    await expect(
      panel.queryByText(/cannot be opened in the clinical workspace/)
    ).not.toBeInTheDocument();
    const grid = getBodyGrid();
    await expect(grid.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third arrangement of the right column: no estimate block at all. It is gated on ' +
          'the status rather than on the invoice, so a completed appointment shows the rows ' +
          'and the read-only room and nothing below them.',
      },
    },
  },
};

export const OverviewNarrow: Story = {
  name: 'Upcoming at 375px',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const panel = await openOverview(canvasElement);

    // One track, same two children: the appointment rows fall under the people rather
    // than beside them. The default `laptop` global gives two tracks, so without this
    // story nothing here exercises the breakpoint.
    const grid = getBodyGrid();
    await expect(trackCount(grid)).toBe(1);
    await expect(grid.children).toHaveLength(2);

    // Both columns still render in full - the layout reflows, it does not truncate.
    await expect(panel.getByText('Poppy')).toBeInTheDocument();
    await expect(panel.getByText('Lena Hartmann')).toBeInTheDocument();
    await expect(panel.getByText('General practice')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Room: Consult 2' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Start appointment' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The stacked panel on a phone. Everything a clinician reads before starting a visit ' +
          'is now one column deep, which puts the estimate and the Start appointment button ' +
          'below a full screen of patient detail - the ordering worth judging here, since the ' +
          'desktop layout keeps the CTA in view and this one does not.',
      },
    },
  },
};
