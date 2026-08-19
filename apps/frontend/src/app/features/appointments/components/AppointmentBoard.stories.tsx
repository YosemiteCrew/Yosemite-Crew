import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AppointmentBoard from './AppointmentBoard';

const ORG_ID = 'org-storybook-board';
/** Not a credential: an opaque app user id, the value `authStore.attributes.sub` holds. */
const CURRENT_USER_ID = 'user-storybook-lead';
const OTHER_LEAD_ID = 'vet-nadia';

/**
 * The board keeps only appointments whose start instant falls on `currentDate`
 * IN THE PREFERRED TIME ZONE, which defaults to Europe/Berlin and is not the
 * machine's zone. Fixtures are therefore fixed UTC instants that land mid-morning
 * in Berlin, so the same cards appear on a laptop in Berlin, Bengaluru or
 * California instead of the board silently emptying itself on one of them.
 */
const CURRENT_DATE = new Date('2026-03-12T11:00:00.000Z');

const appointment = (over: Partial<Appointment> & { id: string }): Appointment => ({
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: CURRENT_USER_ID, name: 'Dr. Weber' },
  appointmentType: {
    id: 'type-1',
    name: 'Annual check-up',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  ...over,
});

const APPOINTMENTS: Appointment[] = [
  appointment({ id: 'appt-1' }),
  appointment({
    id: 'appt-2',
    patient: {
      id: 'companion-2',
      name: 'Mochi',
      species: 'cat',
      breed: 'Ragdoll',
      parent: { id: 'parent-2', name: 'Tomas Ruiz' },
    },
    startTime: new Date('2026-03-12T10:00:00.000Z'),
    endTime: new Date('2026-03-12T10:30:00.000Z'),
    timeSlot: '11:00 - 11:30',
  }),
  appointment({
    id: 'appt-3',
    status: 'CHECKED_IN',
    lead: { id: OTHER_LEAD_ID, name: 'Dr. Nadia Iqbal' },
    patient: {
      id: 'companion-3',
      name: 'Bruno',
      species: 'dog',
      breed: 'Boxer',
      parent: { id: 'parent-3', name: 'Ines Fabre' },
    },
    startTime: new Date('2026-03-12T10:30:00.000Z'),
    endTime: new Date('2026-03-12T11:15:00.000Z'),
    timeSlot: '11:30 - 12:15',
    durationMinutes: 45,
  }),
];

/** Exactly the member `currentUserLeadId` resolves to, so "Mine" is not always empty. */
const TEAM_MEMBER: Team = {
  _id: 'team-1',
  practionerId: CURRENT_USER_ID,
  organisationId: ORG_ID,
  name: 'Dr. Weber',
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
};

/**
 * Seeds the three stores the board reads and restores them on unmount.
 *
 * Nothing here fetches: `useTeamForPrimaryOrg` and `useInvoicesForPrimaryOrg` are
 * pure selectors over their stores - the loaders are separate hooks the board never
 * calls - so seeding is the whole setup, with no service stub and the real component
 * under review.
 */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();
  const authSnapshot = useAuthStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgsById: { [ORG_ID]: { _id: ORG_ID, type: 'HOSPITAL' } as never },
    status: 'loaded',
  });
  useTeamStore.setState({
    teamsById: { 'team-1': TEAM_MEMBER },
    teamIdsByOrgId: { [ORG_ID]: ['team-1'] },
    status: 'loaded',
  });
  useAuthStore.setState({ attributes: { sub: CURRENT_USER_ID } });

  return () => {
    useOrgStore.setState(orgSnapshot);
    useTeamStore.setState(teamSnapshot);
    useAuthStore.setState(authSnapshot);
  };
};

/** The seven column roots, in render order. */
const getColumns = (canvasElement: HTMLElement): HTMLElement[] => {
  const scroller = canvasElement.querySelector('[data-board-scroll-root="true"]');
  const track = scroller?.firstElementChild;
  return [...(track?.children ?? [])] as HTMLElement[];
};

/** The count chip in a column header - the number beside the status label. */
const getColumnCount = (column: HTMLElement): string =>
  column.firstElementChild?.firstElementChild?.lastElementChild?.textContent?.trim() ?? '';

/**
 * The card titles the board renders. `AppointmentCardContent` composes the
 * companion name with the owner's LAST name (`Poppy · Hartmann`), so a query for
 * the bare fixture name matches nothing - and, worse, a loose regex would match
 * the preview decorator's sr-only <h1> instead and pass with the card missing.
 */
const CARD_TITLES = {
  poppy: 'Poppy · Hartmann',
  mochi: 'Mochi · Ruiz',
  bruno: 'Bruno · Fabre',
};

const COLUMN_LABELS = [
  'Requested',
  'Upcoming',
  'Checked in',
  'In progress',
  'Completed',
  'Cancelled',
  'No show',
];

const meta = {
  title: 'Appointments/AppointmentBoard',
  component: AppointmentBoard,
  parameters: {
    layout: 'fullscreen',
    // The card rail pushes into the workspace with next/navigation's router.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The seven-column status board behind /appointments. Its card and its toolbar each ' +
          'had a story; the board that arranges them did not, so one branch of `BoardColumn` ' +
          'had never been drawn: what a column looks like with nothing in it.\n\n' +
          'That state is not exotic. Five of the seven columns are empty on an ordinary morning, ' +
          'and the **Mine** scope toggle in the toolbar can empty all seven at once - it filters ' +
          'on `appointment.lead.id` against the signed-in user resolved through the team list, ' +
          'so anyone without a practitioner row (a receptionist, say) presses it and watches the ' +
          'whole board go blank. Two dashed affordances carry that state: a centred ' +
          '"No appointments" plate, and an `mt-auto` "Add" button that only exists with ' +
          '`canEditAppointments`. Both are dashed on purpose - they are placeholders, not cards ' +
          '- and neither had any snapshot coverage.\n\n' +
          'The filter is why these stories seed `authStore` and `teamStore` rather than passing ' +
          'a prop: `currentUserLeadId` is derived by matching `attributes.sub` against five ' +
          'different id fields on each team member, so a story that skipped the team seed would ' +
          'render an always-empty board and prove nothing about the toggle.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointments: APPOINTMENTS,
    currentDate: CURRENT_DATE,
    setCurrentDate: fn(),
    canEditAppointments: true,
    setActiveAppointment: fn(),
    setViewPopup: fn(),
    setDetailPopup: fn(),
    setViewIntent: fn(),
    onAddAppointment: fn(),
    activeFilter: 'all',
    setActiveFilter: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof AppointmentBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'Board with cards',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(CARD_TITLES.poppy)).toBeInTheDocument();

    const columns = getColumns(canvasElement);
    await expect(columns).toHaveLength(7);
    COLUMN_LABELS.forEach((label, index) => {
      expect(within(columns[index]).getByText(label)).toBeInTheDocument();
    });

    // Upcoming holds two of the three fixtures and Checked in holds the third; the
    // count chip and the cards have to agree, since a filter bug that dropped cards
    // would leave the chip still reading 2.
    await expect(getColumnCount(columns[1])).toBe('2');
    await expect(within(columns[1]).getByText(CARD_TITLES.poppy)).toBeInTheDocument();
    await expect(within(columns[1]).getByText(CARD_TITLES.mochi)).toBeInTheDocument();
    await expect(getColumnCount(columns[2])).toBe('1');
    await expect(within(columns[2]).getByText(CARD_TITLES.bruno)).toBeInTheDocument();

    // The other five columns are the empty branch.
    await expect(canvas.getAllByText('No appointments')).toHaveLength(5);
    await expect(within(columns[1]).queryByText('No appointments')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting board. Columns are fixed 300px panes below md and 320px from md up, so ' +
          'the row scrolls horizontally rather than compressing the cards - and five of the ' +
          'seven are already showing the placeholder.',
      },
    },
  },
};

export const MineOnlyFiltersOtherLeads: Story = {
  name: 'Mine-only scope - other leads drop out',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(CARD_TITLES.bruno)).toBeInTheDocument();

    // Bruno is led by another vet; Poppy and Mochi are led by the signed-in user.
    await userEvent.click(canvas.getByRole('button', { name: 'Show my appointments' }));

    await waitFor(() => {
      expect(canvas.queryByText(CARD_TITLES.bruno)).not.toBeInTheDocument();
    });
    await expect(canvas.getByText(CARD_TITLES.poppy)).toBeInTheDocument();

    // Checked in emptied; Upcoming kept both. The placeholder count moves with it.
    const columns = getColumns(canvasElement);
    await expect(getColumnCount(columns[2])).toBe('0');
    await expect(within(columns[2]).getByText('No appointments')).toBeInTheDocument();
    await expect(getColumnCount(columns[1])).toBe('2');
    await expect(canvas.getAllByText('No appointments')).toHaveLength(6);

    // The toggle relabels rather than only restyling, so the pressed state is
    // announced and not carried by the track colour alone.
    await expect(canvas.getByRole('button', { name: 'Show all appointments' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'One column crossing from populated to empty. This is the transition the placeholder ' +
          'exists for, and the only story in which the plate replaces cards rather than ' +
          'starting there.',
      },
    },
  },
};

export const MineOnlyEmptiesEveryColumn: Story = {
  name: 'Mine-only scope - every column empty',
  // A signed-in user with no practitioner row on this team: `currentUserLeadId`
  // resolves to '' and no appointment can match it. Receptionists sit exactly here.
  beforeEach: () => {
    useAuthStore.setState({ attributes: { sub: 'user-not-on-this-team' } });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(CARD_TITLES.poppy)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Show my appointments' }));

    const plates = await canvas.findAllByText('No appointments');
    await expect(plates).toHaveLength(7);
    await expect(canvas.queryByText(CARD_TITLES.poppy)).not.toBeInTheDocument();

    const columns = getColumns(canvasElement);
    await expect(columns.map(getColumnCount)).toEqual(['0', '0', '0', '0', '0', '0', '0']);

    // The plate is a dashed placeholder, not a card: no fill of its own, and the
    // dashed edge is the only thing separating the two at a glance.
    await expect(getComputedStyle(plates[0]).borderStyle).toBe('dashed');

    // The Add affordance sits under the plate in every column and is also dashed.
    const addButtons = canvas.getAllByRole('button', { name: /^Add appointment to / });
    await expect(addButtons).toHaveLength(7);
    await expect(addButtons.map((button) => button.textContent?.trim())).toEqual(
      Array.from({ length: 7 }, () => 'Add')
    );
    await expect(getComputedStyle(addButtons[0]).borderStyle).toBe('dashed');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every column at once. Worth looking at because it is the only time all seven dashed ' +
          'plates and all seven dashed Add buttons are on screen together, and the two use ' +
          'different radii (13px and 11px) and different borders (`--card-border` and ' +
          '`--divider`) despite reading as a pair.',
      },
    },
  },
};

export const EmptyWithoutEditPermission: Story = {
  name: 'Empty columns, read-only',
  args: { appointments: [], canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findAllByText('No appointments')).toHaveLength(7);
    // The Add affordance is gated on canEditAppointments, so a read-only board shows
    // the plate alone - the empty column has two distinct looks, not one.
    await expect(canvas.queryAllByRole('button', { name: /^Add appointment to / })).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: 'New appointment' })).not.toBeInTheDocument();

    /* One plate per column rather than seven somewhere. A layout bug that stacked all
       seven into one column would satisfy the count above and nothing else here. Every
       header still shows its label and a zero chip, so the columns are present and
       empty rather than missing. */
    const columns = getColumns(canvasElement);
    await expect(columns).toHaveLength(7);
    columns.forEach((column, index) => {
      expect(within(column).getAllByText('No appointments')).toHaveLength(1);
      expect(within(column).getByText(COLUMN_LABELS[index])).toBeInTheDocument();
    });
    await expect(columns.map(getColumnCount)).toEqual(['0', '0', '0', '0', '0', '0', '0']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same empty columns without appointment-edit rights. The dashed Add button and ' +
          'the toolbar CTA both disappear, leaving the plate as the only thing in the column - ' +
          'the layout the `mt-auto` on the Add button was written for and never checked against.',
      },
    },
  },
};
