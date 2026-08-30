import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment, Invoice, Organisation, RoomUnit } from '@yosemite-crew/types';

import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import type { Team } from '@/app/features/organization/types/team';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';
import { useTeamStore } from '@/app/stores/teamStore';

import Appointments from './Appointments';

const ORG_ID = 'org-appointments-story';
const BOARDING_ORG_ID = 'org-appointments-boarding-story';
const LEAD_PRACTITIONER_ID = 'pract-lead-2';

const HOSPITAL: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

const BOARDING_HOUSE: Organisation = {
  _id: BOARDING_ORG_ID,
  name: 'Meadowbrook Boarding',
  type: 'BOARDER',
  phoneNo: '4155550188',
  taxId: 'TAX-0002',
  isVerified: true,
  isActive: true,
};

const LEAD_VET: Team = {
  _id: 'team-lead-2',
  practionerId: LEAD_PRACTITIONER_ID,
  organisationId: ORG_ID,
  name: 'Dr. Idris Kaur',
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
};

const companion = (id: string, name: string) => ({
  id,
  name,
  species: 'dog',
  breed: 'Beagle',
  parent: { id: `${id}-parent`, name: 'Maya Whitfield' },
});

/* Local Date constructors, not UTC literals: the date and time cells format
   through the org's preferred time zone, so a '...T09:30:00.000Z' fixture
   would render a different hour - and in some zones a different day - depending
   on where the story runs. */
const appointment = (
  id: string,
  companionName: string,
  overrides: Partial<Appointment> = {}
): Appointment => {
  const who = companion(`companion-${companionName.toLowerCase()}`, companionName);
  return {
    id,
    patient: who,
    companion: who,
    lead: { id: 'pract-lead-1', name: 'Dr. Elena Marsh' },
    supportStaff: [{ id: 'nurse-1', name: 'Tom Reyes' }],
    room: { id: 'room-1', name: 'Consult 2' },
    appointmentType: {
      id: 'type-1',
      name: 'Wellness exam',
      speciality: { id: 'spec-1', name: 'General practice' },
    },
    organisationId: ORG_ID,
    appointmentDate: new Date(2026, 2, 12, 9, 30),
    startTime: new Date(2026, 2, 12, 9, 30),
    endTime: new Date(2026, 2, 12, 10, 0),
    timeSlot: '09:30 - 10:00',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Annual check-up',
    ...overrides,
  };
};

const POPPY = appointment('appt-poppy', 'Poppy');

/* Rufus names no lead - only an id - so the row has to resolve the name out of
   the team directory. */
const RUFUS = appointment('appt-rufus', 'Rufus', {
  status: 'IN_PROGRESS',
  lead: { id: LEAD_PRACTITIONER_ID, name: '' },
  concern: 'Limping on the left hind',
});

/* Nala has no lead at all, and a completed visit affords none of the editing
   actions regardless of permission. */
const NALA = appointment('appt-nala', 'Nala', {
  status: 'COMPLETED',
  lead: undefined,
  supportStaff: [],
});

const APPOINTMENTS: Appointment[] = [POPPY, RUFUS, NALA];

/* Rufus is the only appointment with an invoice, and it is unpaid. Everything
   else falls through `getAppointmentPaymentDisplay`'s no-invoice branch, which
   reports "Paid". */
const UNPAID_INVOICE: Invoice = {
  id: 'inv-rufus',
  organisationId: ORG_ID,
  appointmentId: 'appt-rufus',
  items: [],
  subtotal: 12000,
  totalAmount: 12000,
  paymentCollectionMethod: 'PAYMENT_LINK',
  currency: 'USD',
  status: 'AWAITING_PAYMENT',
};

const WARD_UNIT: RoomUnit = {
  id: 'unit-kennel-a',
  organisationId: ORG_ID,
  roomId: 'room-ward-1',
  code: 'K-A',
  displayName: 'Kennel A',
  isActive: true,
};

/* Only the fields the room cell reads. The full `AppointmentEncounter` carries
   the whole workspace (soap, vitals, invoice lines, locks); none of it is
   involved in resolving a unit id. */
const encounterWithUnit = (appointmentId: string, unitId: string) =>
  ({ appointmentId, unitId }) as unknown as AppointmentEncounter;

type SeedOptions = {
  orgs?: Organisation[];
  invoices?: Invoice[];
  roomUnits?: RoomUnit[];
  encounters?: Record<string, AppointmentEncounter>;
};

/**
 * The table reads five stores. Seeding `teamIdsByOrgId` for the primary org is
 * what keeps the story offline: `useLoadTeam` fires a real `loadTeam()` request
 * whenever `primaryOrgId` is set and that key is missing, so a half-seeded team
 * store is worse than none. Every store is restored on unmount.
 */
const seed =
  ({ orgs = [HOSPITAL], invoices = [], roomUnits = [], encounters = {} }: SeedOptions = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();
    const invoiceSnapshot = useInvoiceStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();
    const workspaceSnapshot = useAppointmentWorkspaceStore.getState();

    useOrgStore.setState({
      orgsById: Object.fromEntries(orgs.map((org) => [org._id as string, org])),
      orgIds: orgs.map((org) => org._id as string),
      primaryOrgId: ORG_ID,
    });
    useTeamStore.setState({
      teamsById: { [LEAD_VET._id]: LEAD_VET },
      teamIdsByOrgId: { [ORG_ID]: [LEAD_VET._id] },
      status: 'loaded',
    });
    useInvoiceStore.setState({
      invoicesById: Object.fromEntries(invoices.map((invoice) => [invoice.id as string, invoice])),
      invoiceIdsByOrgId: { [ORG_ID]: invoices.map((invoice) => invoice.id as string) },
      status: 'loaded',
    });
    useOrganisationRoomStore.setState({
      roomUnitsById: Object.fromEntries(roomUnits.map((unit) => [unit.id, unit])),
    });
    useAppointmentWorkspaceStore.setState({ encountersById: encounters });

    return () => {
      useOrgStore.setState({
        orgsById: orgSnapshot.orgsById,
        orgIds: orgSnapshot.orgIds,
        primaryOrgId: orgSnapshot.primaryOrgId,
      });
      useTeamStore.setState({
        teamsById: teamSnapshot.teamsById,
        teamIdsByOrgId: teamSnapshot.teamIdsByOrgId,
        status: teamSnapshot.status,
      });
      useInvoiceStore.setState({
        invoicesById: invoiceSnapshot.invoicesById,
        invoiceIdsByOrgId: invoiceSnapshot.invoiceIdsByOrgId,
        status: invoiceSnapshot.status,
      });
      useOrganisationRoomStore.setState({ roomUnitsById: roomSnapshot.roomUnitsById });
      useAppointmentWorkspaceStore.setState({
        encountersById: workspaceSnapshot.encountersById,
      });
      // Two row actions push through `startRouteLoader`, which flips a global
      // flag nothing in this story ever turns off. Left set, the next story
      // that happens to mount the route-loader overlay renders it spinning.
      useRouteLoaderStore.getState().stop();
    };
  };

/** The desktop row for an appointment, found through its kebab. */
const rowFor = (canvasElement: HTMLElement, companionName: string) => {
  const kebab = within(canvasElement).getByRole('button', {
    name: `Actions for ${companionName}`,
  });
  const row = kebab.closest('tr');
  if (!row) throw new Error(`No table row for ${companionName}`);
  return row as HTMLElement;
};

/**
 * Cells in column order: photo, name, reason, service, room, date/time, lead,
 * support, status, actions.
 */
const cellTexts = (row: HTMLElement) =>
  [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? '');

/**
 * The row menu is `createPortal`ed to `document.body`, so it is outside
 * `canvasElement` entirely and has to be queried from the document.
 */
const openRowMenu = async (canvasElement: HTMLElement, companionName: string) => {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: `Actions for ${companionName}` })
  );
  const items = await within(globalThis.document.body).findAllByRole('menuitem');
  return items.map((item) => item.textContent?.trim() ?? '');
};

const meta = {
  title: 'Tables/Appointments',
  component: Appointments,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The appointments list: a `GenericTable` above `xl` and a paginated `AppointmentCard` ' +
          'list below it, both driven by the same array and the same handlers.\n\n' +
          'Almost nothing on a row is a plain field read. The lead falls back from ' +
          '`appointment.lead.name` to a lookup in the team directory keyed on `practionerId`; the ' +
          'payment line under the status pill is derived from the invoice store, and an ' +
          'appointment with no invoice at all reports "Paid"; the room cell resolves an inpatient ' +
          "unit through the workspace store's encounter and then the room store; and the row's " +
          'whole action set is rebuilt per row from the status and from `canEditAppointments`.\n\n' +
          'That action set is the part worth watching. It lives in a kebab that `createPortal`s to ' +
          '`document.body` and only exists after a click, so no snapshot ever contained it. A ' +
          'requested booking gets a two-item accept/decline menu instead of the usual eight, and ' +
          'revoking edit permission removes Change status, Reschedule and Assign room while ' +
          'leaving the read actions - which means a permission regression shows up as three ' +
          'missing lines inside a menu nobody opens.\n\n' +
          'The clinical-notes item is renamed from the organisation type ("Medical Records" for a ' +
          'hospital, "Care" everywhere else), read out of the org store - so an appointment whose ' +
          'organisation has not loaded silently offers "Medical Records" at a boarding house.\n\n' +
          'Decline/cancel is the one action these stories never click: it calls ' +
          '`rejectAppointment` / `cancelAppointment` directly against the API rather than through ' +
          'a prop.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: APPOINTMENTS,
    canEditAppointments: true,
    setActiveAppointment: fn(),
    setDetailPopup: fn(),
    setViewIntent: fn(),
    setReschedulePopup: fn(),
    setChangeStatusPopup: fn(),
    setChangeStatusPreferredStatus: fn(),
    setChangeRoomPopup: fn(),
  },
  beforeEach: seed({ invoices: [UNPAID_INVOICE] }),
} satisfies Meta<typeof Appointments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "A day's appointments",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(3);

    /* Rufus stores a lead id and an empty name. The only way this cell can read
       "Dr. Idris Kaur" is the team-directory fallback, which silently empties
       whenever the team store is scoped to a different organisation. */
    expect(cellTexts(rowFor(canvasElement, 'Rufus'))[6]).toBe('Dr. Idris Kaur');
    // No lead and no id at all is a dash, not a blank cell.
    expect(cellTexts(rowFor(canvasElement, 'Nala'))[6]).toBe('-');

    /* The status enum never reaches the reader. Asserted as an absence because
       the card list renders the same pill at every width, so a leak would show
       up twice and a scoped positive assertion would miss it. */
    expect(canvas.queryByText('IN_PROGRESS')).not.toBeInTheDocument();
    expect(canvas.getAllByText('In progress').length).toBeGreaterThan(0);

    /* Payment is derived, not stored on the appointment: Rufus is the only one
       with an invoice and it is unpaid, while Poppy - with no invoice at all -
       reads "Paid". */
    expect(within(rowFor(canvasElement, 'Rufus')).getByText('Unpaid')).toBeInTheDocument();
    expect(within(rowFor(canvasElement, 'Poppy')).getByText('Paid')).toBeInTheDocument();

    // One kebab per row, each labelled with its own companion.
    expect(canvas.getAllByRole('button', { name: /^Actions for / })).toHaveLength(3);
  },
};

export const RowActions: Story = {
  name: 'The row menu with edit permission',
  play: async ({ canvasElement }) => {
    /* The full eight. Order is part of the contract: the read actions come
       first, then the three edit actions the permission gates, then the
       workspace group behind a divider. */
    expect(await openRowMenu(canvasElement, 'Poppy')).toEqual([
      'View appointment',
      'Overview',
      'Change status',
      'Reschedule',
      'Assign room',
      'Medical Records',
      'Finance summary',
      'Lab tests',
    ]);
  },
};

export const WithoutEditPermission: Story = {
  name: 'Without edit permission',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    /* Change status, Reschedule and Assign room are GONE, not disabled - so a
       regression here is three absent lines in a menu that has to be opened to
       be seen at all. The read actions and the workspace group survive, because
       a receptionist still has to be able to look. */
    expect(await openRowMenu(canvasElement, 'Poppy')).toEqual([
      'View appointment',
      'Overview',
      'Medical Records',
      'Finance summary',
      'Lab tests',
    ]);
  },
};

export const CompletedAppointment: Story = {
  name: 'A completed visit affords no edits',
  args: { filteredList: [NALA] },
  play: async ({ canvasElement }) => {
    /* Same five as the read-only story, but reached the other way: permission
       is granted and the STATUS closes the edits. `COMPLETED` has no allowed
       transitions, cannot be dragged and cannot take a room, so the menu
       collapses to the read set on its own. */
    expect(await openRowMenu(canvasElement, 'Nala')).toEqual([
      'View appointment',
      'Overview',
      'Medical Records',
      'Finance summary',
      'Lab tests',
    ]);
  },
};

export const RequestedBooking: Story = {
  name: 'A requested booking',
  args: {
    filteredList: [appointment('appt-milo', 'Milo', { status: 'REQUESTED' }), POPPY],
  },
  play: async ({ args, canvasElement }) => {
    /* A request is a different menu, not the usual one with extras: accept and
       decline REPLACE the eight, so a reader cannot open the workspace for a
       visit that has not been agreed to yet. */
    expect(await openRowMenu(canvasElement, 'Milo')).toEqual(['Accept request', 'Decline request']);

    /* Accepting does not flip the status behind the reader's back - it opens
       the change-status modal pre-set to the only transition `REQUESTED`
       allows, so a lead and a room can be assigned in the same step.

       Decline is deliberately not clicked: it calls `rejectAppointment`
       against the API directly rather than through a prop, so there is nothing
       to stub. */
    await userEvent.click(
      within(globalThis.document.body).getByRole('menuitem', { name: 'Accept request' })
    );
    await expect(args.setActiveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-milo' })
    );
    await expect(args.setChangeStatusPreferredStatus).toHaveBeenCalledWith('UPCOMING');
    await expect(args.setChangeStatusPopup).toHaveBeenCalledWith(true);
  },
};

export const RoutesToTheWorkspace: Story = {
  name: 'Routing out of the row',
  play: async ({ canvasElement }) => {
    /* Two controls that sit a few pixels apart and route to different places.
       The companion name is a button, not a link, so nothing about it says
       where it goes. */
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Poppy · Whitfield' }));
    await expect(getRouter().push).toHaveBeenCalledWith(
      '/companions/history?companionId=companion-poppy&source=appointments&appointmentId=appt-poppy&backTo=%2Fappointments'
    );

    await openRowMenu(canvasElement, 'Poppy');
    await userEvent.click(
      within(globalThis.document.body).getByRole('menuitem', { name: 'Medical Records' })
    );
    await expect(getRouter().push).toHaveBeenCalledWith(
      '/appointments/appt-poppy/workspace?step=SOAP'
    );
  },
};

export const BoardingOrganisation: Story = {
  name: 'A boarding house renames the clinical notes',
  args: {
    filteredList: [appointment('appt-otto', 'Otto', { organisationId: BOARDING_ORG_ID })],
  },
  beforeEach: seed({ orgs: [HOSPITAL, BOARDING_HOUSE] }),
  play: async ({ canvasElement }) => {
    /* `getClinicalNotesLabel` reads the org type out of the store and defaults
       to HOSPITAL when the organisation is missing - so this label is exactly
       the thing that reads "Medical Records" at a boarding house whenever the
       org store has not resolved yet. */
    const items = await openRowMenu(canvasElement, 'Otto');
    expect(items).toContain('Care');
    expect(items).not.toContain('Medical Records');
  },
};

export const InpatientRoomAndUnit: Story = {
  name: 'Inpatient room resolved through the encounter',
  args: {
    filteredList: [
      appointment('appt-bruno', 'Bruno', {
        status: 'CHECKED_IN',
        appointmentKind: 'INPATIENT',
        appointmentType: {
          id: 'type-2',
          name: 'Hospitalization',
          speciality: { id: 'spec-2', name: 'Internal medicine' },
        },
        room: { id: 'room-ward-1', name: 'Ward 1' },
      }),
    ],
  },
  beforeEach: seed({
    roomUnits: [WARD_UNIT],
    encounters: { 'appt-bruno': encounterWithUnit('appt-bruno', WARD_UNIT.id) },
  }),
  play: async ({ canvasElement }) => {
    const room = cellTexts(rowFor(canvasElement, 'Bruno'))[4];

    /* The booking carries no unit of its own. The label can only appear by
       going appointment id -> encounter -> unit id -> room store -> display
       name, and every step of that chain is silent when it breaks: the cell
       just shows the room and nobody notices the ward went missing. */
    expect(room).toContain('Ward 1');
    expect(room).toContain('Kennel A');
    // The mode pill sits in the same cell and is what marks the stay inpatient.
    expect(room).toContain('Inpatient');
  },
};

export const Emergency: Story = {
  name: 'An emergency row',
  args: {
    filteredList: [appointment('appt-luna', 'Luna', { isEmergency: true }), POPPY],
  },
  play: async ({ canvasElement }) => {
    const emergencyRow = rowFor(canvasElement, 'Luna');
    expect(emergencyRow).toHaveClass('appointment-row-emergency');

    /* The red rail is an inset box-shadow on the FIRST cell only, so it cannot
       be asserted from the row. Measured against the ordinary row beside it
       rather than against a hard-coded value: the pair is what proves the class
       is doing something. */
    const emergencyLead = emergencyRow.querySelector('td') as HTMLElement;
    const ordinaryLead = rowFor(canvasElement, 'Poppy').querySelector('td') as HTMLElement;
    expect(globalThis.getComputedStyle(emergencyLead).boxShadow).toMatch(/inset/);
    expect(globalThis.getComputedStyle(ordinaryLead).boxShadow).toBe('none');

    /* Colour alone would leave the row unreadable to anyone who cannot see it,
       so the name cell also carries the word. It is a table-only chip - the
       card list never renders one - which is why a single match is correct. */
    expect(within(canvasElement).getByText('Emergency')).toBeInTheDocument();
  },
};

const MANY_APPOINTMENTS: Appointment[] = [
  'Poppy',
  'Rufus',
  'Nala',
  'Milo',
  'Luna',
  'Bruno',
  'Otto',
  'Sadie',
].map((name, index) => appointment(`appt-${index}`, name));

export const Small: Story = {
  name: 'Small: five rows to a page',
  args: { filteredList: MANY_APPOINTMENTS, small: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `small` is the dashboard rendering: page size drops from ten to five, so
    // eight appointments become two pages instead of one.
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(5);

    /* Two pagers, both in the DOM at every width and both reading "5 of 8" -
       the table's and the card list's. They are fed the same page size on
       purpose, because a phone that showed all eight while the table showed
       five is how the card list came to render a few hundred appointments at
       once. */
    expect(canvas.getAllByText('5 of 8')).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: 'Page 2' }));
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(3);

    /* Each half keeps its own page number, though. Paging the table leaves the
       card list on page one, so the two counters now disagree - which is fine
       while only one of them is visible, and is exactly what would surprise
       anyone who assumed the pager was shared. The count is of the whole list,
       so the short last page reads "8 of 8" rather than "3 of 8". */
    expect(canvas.getAllByText('8 of 8')).toHaveLength(1);
    expect(canvas.getAllByText('5 of 8')).toHaveLength(1);
  },
};

export const FullPage: Story = {
  name: 'Full page: ten rows, no pager',
  args: { filteredList: MANY_APPOINTMENTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The same eight rows without `small`. Page size is ten, one page covers
       them, and `GenericTable` hides the pager entirely rather than showing a
       dead one - which is the difference this story exists to hold against the
       story above. */
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(8);
    expect(canvas.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'Nothing booked',
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Two empty states ship in one render and both stay in the DOM at every
       width: the table falls back to `GenericTable`'s copy, the card list to
       its own bare line. Which sentence a user reads depends only on their
       window width. Exact strings, because the preview decorator puts the story
       name in an sr-only h1 that a loose /nothing/i would also match. */
    expect(canvas.getByText('Looks like a quiet day… for now.')).toBeInTheDocument();
    expect(canvas.getByText('No data available')).toBeInTheDocument();
    expect(canvas.queryByRole('button', { name: /^Actions for / })).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { filteredList: [appointment('appt-milo', 'Milo', { status: 'REQUESTED' }), POPPY, NALA] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The card rail is per-companion, not a shared row of unlabelled icons -
       three identical "View" buttons on one screen is the failure this guards.

       Queried by label rather than by role because the card list is hidden
       behind `xl:hidden` at the width this renders at, and a role query skips
       anything outside the accessibility tree. */
    expect(canvas.getByLabelText('View appointment for Poppy')).toBeInTheDocument();
    expect(canvas.getByLabelText('Reschedule appointment for Poppy')).toBeInTheDocument();

    /* The card rail gates on the same status rules as the table menu: a
       completed visit keeps the read actions and loses reschedule, and a
       request swaps the whole rail for accept/decline. */
    expect(canvas.getByLabelText('View appointment for Nala')).toBeInTheDocument();
    expect(canvas.queryByLabelText('Reschedule appointment for Nala')).not.toBeInTheDocument();
    expect(canvas.getByLabelText('Accept request for Milo')).toBeInTheDocument();
    expect(canvas.queryByLabelText('View appointment for Milo')).not.toBeInTheDocument();

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
