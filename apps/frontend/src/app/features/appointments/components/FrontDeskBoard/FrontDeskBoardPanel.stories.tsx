import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, OrganisationRoom, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import type {
  CreateCheckInPayload,
  PatientCheckIn,
} from '@/app/features/appointments/services/patientCheckInService';
import FrontDeskBoardPanel from './FrontDeskBoardPanel';

// `assertOrganisationId` accepts a UUID or a 24-hex legacy Mongo id, and every
// transition call (`assertUuid`) requires the check-in id itself to be a
// UUID - a slug like "checkin-1" would throw inside the service before any
// request is made. These ids are shaped to pass both checks.
const ORG_ID = 'a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * OWNER carries every permission, so `revoked` is the only way to reach the
 * read-only board a receptionist without edit rights would actually see.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const QUINN: StoredParent = {
  id: 'parent-quinn',
  firstName: 'Quinn',
  lastName: 'Ander',
  email: 'quinn.ander@example.com',
  address: {},
  createdFrom: 'pms',
};
const MARA: StoredParent = {
  id: 'parent-mara',
  firstName: 'Mara',
  lastName: 'Voss',
  email: 'mara.voss@example.com',
  address: {},
  createdFrom: 'pms',
};
const JULES: StoredParent = {
  id: 'parent-jules',
  firstName: 'Jules',
  lastName: 'Byrne',
  email: 'jules.byrne@example.com',
  address: {},
  createdFrom: 'pms',
};

const BRAMBLE: StoredCompanion = {
  id: 'companion-bramble',
  organisationId: ORG_ID,
  parentId: QUINN.id,
  name: 'Bramble',
  type: 'dog',
  breed: 'Cavalier King Charles Spaniel',
  dateOfBirth: new Date('2021-04-02'),
  gender: 'female',
  isInsured: true,
};
const OTIS: StoredCompanion = {
  id: 'companion-otis',
  organisationId: ORG_ID,
  parentId: MARA.id,
  name: 'Otis',
  type: 'cat',
  breed: 'British Shorthair',
  dateOfBirth: new Date('2019-08-15'),
  gender: 'male',
  isInsured: false,
};
const PERCY: StoredCompanion = {
  id: 'companion-percy',
  organisationId: ORG_ID,
  parentId: JULES.id,
  name: 'Percy',
  type: 'dog',
  breed: 'Border Collie',
  dateOfBirth: new Date('2022-02-10'),
  gender: 'male',
  isInsured: true,
};
const NOVA: StoredCompanion = {
  id: 'companion-nova',
  organisationId: ORG_ID,
  parentId: JULES.id,
  name: 'Nova',
  type: 'cat',
  breed: 'Domestic Shorthair',
  dateOfBirth: new Date('2023-06-01'),
  gender: 'female',
  isInsured: false,
};

const EXAM_1: OrganisationRoom = {
  id: 'room-exam-1',
  organisationId: ORG_ID,
  name: 'Exam 1',
  code: 'EX1',
  type: 'EXAM_ROOM',
};
const EXAM_2: OrganisationRoom = {
  id: 'room-exam-2',
  organisationId: ORG_ID,
  name: 'Exam 2',
  code: 'EX2',
  type: 'EXAM_ROOM',
};

const minutesAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString();

/**
 * `waitMinutes` is set explicitly on every fixture row so the displayed wait
 * time is fixed at render time rather than drifting off `arrivedAt` and the
 * clock the story happens to run at.
 */
const PERCY_WAITING: PatientCheckIn = {
  id: '11111111-1111-4111-8111-111111111111',
  organisationId: ORG_ID,
  patientId: PERCY.id,
  clientId: JULES.id,
  appointmentId: null,
  arrivedAt: minutesAgo(2),
  triagePriority: 'IMMEDIATE',
  triageNote: 'Active seizure',
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: null,
  seenAt: null,
  waitMinutes: 2,
  status: 'WAITING',
  notes: null,
  createdAt: minutesAgo(2),
  updatedAt: minutesAgo(2),
};
const BRAMBLE_WAITING: PatientCheckIn = {
  id: '22222222-2222-4222-8222-222222222222',
  organisationId: ORG_ID,
  patientId: BRAMBLE.id,
  clientId: QUINN.id,
  appointmentId: null,
  arrivedAt: minutesAgo(25),
  triagePriority: 'URGENT',
  triageNote: 'Limping on left hind leg',
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: null,
  seenAt: null,
  waitMinutes: 25,
  status: 'WAITING',
  notes: null,
  createdAt: minutesAgo(25),
  updatedAt: minutesAgo(25),
};
const OTIS_IN_CONSULT: PatientCheckIn = {
  id: '33333333-3333-4333-8333-333333333333',
  organisationId: ORG_ID,
  patientId: OTIS.id,
  clientId: MARA.id,
  appointmentId: null,
  arrivedAt: minutesAgo(33),
  triagePriority: 'STANDARD',
  triageNote: null,
  assignedRoomId: EXAM_1.id,
  checkedInBy: null,
  waitStartedAt: minutesAgo(33),
  seenAt: minutesAgo(8),
  waitMinutes: 8,
  status: 'IN_CONSULTATION',
  notes: 'Annual wellness check',
  createdAt: minutesAgo(33),
  updatedAt: minutesAgo(8),
};
const NOVA_COMPLETED: PatientCheckIn = {
  id: '44444444-4444-4444-8444-444444444444',
  organisationId: ORG_ID,
  patientId: NOVA.id,
  clientId: JULES.id,
  appointmentId: null,
  arrivedAt: minutesAgo(70),
  triagePriority: 'NON_URGENT',
  triageNote: null,
  assignedRoomId: EXAM_2.id,
  checkedInBy: null,
  waitStartedAt: minutesAgo(70),
  seenAt: minutesAgo(60),
  waitMinutes: 55,
  status: 'COMPLETED',
  notes: null,
  createdAt: minutesAgo(70),
  updatedAt: minutesAgo(10),
};
const BRAMBLE_CANCELLED: PatientCheckIn = {
  id: '55555555-5555-4555-8555-555555555555',
  organisationId: ORG_ID,
  patientId: BRAMBLE.id,
  clientId: QUINN.id,
  appointmentId: null,
  arrivedAt: minutesAgo(95),
  triagePriority: 'LESS_URGENT',
  triageNote: 'No-show reschedule request',
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: null,
  seenAt: null,
  waitMinutes: 12,
  status: 'CANCELLED',
  notes: null,
  createdAt: minutesAgo(95),
  updatedAt: minutesAgo(90),
};

const CHECKINS_ACTIVE: PatientCheckIn[] = [PERCY_WAITING, BRAMBLE_WAITING, OTIS_IN_CONSULT];
const CHECKINS_WITH_HISTORY: PatientCheckIn[] = [
  ...CHECKINS_ACTIVE,
  NOVA_COMPLETED,
  BRAMBLE_CANCELLED,
];

type CheckInFixture =
  | { kind: 'resolves'; entries: PatientCheckIn[] }
  | /** Held open on purpose: the only way to hold the loading skeleton still. */ {
      kind: 'pending';
    }
  | { kind: 'rejects'; message: string };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const axiosError = (config: InternalAxiosRequestConfig, message: string): unknown =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    config,
    response: {
      status: 500,
      statusText: 'Internal Server Error',
      data: { message },
      headers: {},
      config,
    },
  });

/**
 * The panel reads and writes `/v1/pms/organisation/:id/check-in` (list,
 * create) and its `/:checkInId/<action>` transitions through the shared axios
 * instance. Every write mutates this closure's own list, so a click that
 * triggers an action's own refetch (see the Default story) sees the real
 * updated row rather than a canned response.
 */
const buildAdapter = (fixture: CheckInFixture): AxiosAdapter => {
  let entries = fixture.kind === 'resolves' ? [...fixture.entries] : [];
  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (url.endsWith('/check-in')) {
      if (method === 'get') {
        if (fixture.kind === 'pending') return new Promise<never>(() => {});
        if (fixture.kind === 'rejects') return Promise.reject(axiosError(config, fixture.message));
        return Promise.resolve(respond(config, entries));
      }
      if (method === 'post') {
        const body = JSON.parse(String(config.data ?? '{}')) as CreateCheckInPayload;
        const created: PatientCheckIn = {
          id: `66666666-6666-4666-8666-${String(entries.length).padStart(12, '0')}`,
          organisationId: ORG_ID,
          patientId: body.patientId,
          clientId: body.clientId,
          appointmentId: body.appointmentId ?? null,
          arrivedAt: body.arrivedAt,
          triagePriority: body.triagePriority ?? 'STANDARD',
          triageNote: body.triageNote ?? null,
          assignedRoomId: null,
          checkedInBy: body.checkedInBy ?? null,
          waitStartedAt: null,
          seenAt: null,
          waitMinutes: 0,
          status: 'WAITING',
          notes: body.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        entries = [...entries, created];
        return Promise.resolve(respond(config, created));
      }
    }

    const transitionMatch = /\/check-in\/([^/]+)\/(seen|complete|cancel|no-show|room)$/.exec(url);
    if (transitionMatch && method === 'post') {
      const [, id, action] = transitionMatch;
      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) return Promise.reject(axiosError(config, 'Check-in not found'));
      const updated: PatientCheckIn = { ...entries[index] };
      if (action === 'seen') {
        updated.status = 'IN_CONSULTATION';
        updated.seenAt = new Date().toISOString();
      } else if (action === 'complete') {
        updated.status = 'COMPLETED';
      } else if (action === 'cancel') {
        updated.status = 'CANCELLED';
      } else if (action === 'no-show') {
        updated.status = 'NO_SHOW';
      } else if (action === 'room') {
        const body = JSON.parse(String(config.data ?? '{}')) as { roomId: string };
        updated.assignedRoomId = body.roomId;
      }
      entries = entries.map((entry, i) => (i === index ? updated : entry));
      return Promise.resolve(respond(config, updated));
    }

    return Promise.resolve(respond(config, []));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * Seeds the organisation, companion, parent and room stores directly - the
 * same `Object.hasOwn(...ByOrgId, primaryOrgId)` short-circuit the panel's
 * loader hooks check, so seeding the id index (like the Discounts stories do)
 * skips their network calls entirely rather than needing them mocked too.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: CheckInFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();

    const snapshots = {
      org: useOrgStore.getState(),
      companion: useCompanionStore.getState(),
      parent: useParentStore.getState(),
      room: useOrganisationRoomStore.getState(),
    };
    api.defaults.adapter = buildAdapter(fixture);

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: {
        [BRAMBLE.id]: BRAMBLE,
        [OTIS.id]: OTIS,
        [PERCY.id]: PERCY,
        [NOVA.id]: NOVA,
      },
      companionsIdsByOrgId: { [ORG_ID]: [BRAMBLE.id, OTIS.id, PERCY.id, NOVA.id] },
      status: 'loaded',
    });
    useParentStore.setState({
      parentsById: { [QUINN.id]: QUINN, [MARA.id]: MARA, [JULES.id]: JULES },
      parentIds: [QUINN.id, MARA.id, JULES.id],
      status: 'loaded',
    });
    useOrganisationRoomStore.setState({
      roomsById: { [EXAM_1.id]: EXAM_1, [EXAM_2.id]: EXAM_2 },
      roomIdsByOrgId: { [ORG_ID]: [EXAM_1.id, EXAM_2.id] },
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useOrganisationRoomStore.setState(snapshots.room);
      useParentStore.setState(snapshots.parent);
      useCompanionStore.setState(snapshots.companion);
      useOrgStore.setState(snapshots.org);
      clearInFlightGetRequests();
    };
  };

/**
 * A rejected load is logged twice on its way to the hook's catch (once by the
 * shared axios wrapper, once by the service's own `logFailure`), and the
 * render check treats a console error as a broken story. Only those two
 * expected lines are dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('API getData error') || arg.includes('Failed to load check-ins'))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const frontDeskBoardPanelMeta = {
  title: 'Appointments/FrontDeskBoardPanel',
  component: FrontDeskBoardPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'FrontDeskBoardPanel is the data container for the check-in board: it owns no markup ' +
          'of its own, it wires `useFrontDeskBoard` (organisation-scoped check-ins, the ' +
          'companion and room lookups, and the seen/complete/cancel/no-show/assign-room/add ' +
          'actions) onto the presentational `FrontDeskBoard`. The one decision it makes itself ' +
          'is permission gating: a user without `appointments:edit:any` or ' +
          '`appointments:edit:own` has every edit handler withheld, and `FrontDeskBoard` hides ' +
          'the button or control that handler belongs to rather than rendering it disabled. ' +
          'The show-all toggle is not gated - it only changes what is visible, not what can be ' +
          'changed, so it stays available regardless of edit rights.\n\n' +
          'The stories seed the organisation, companion, parent and room Zustand stores ' +
          'directly and answer the check-in REST endpoints from the shared axios adapter with ' +
          'an in-memory list that mutates on every write, so an action button’s round trip ' +
          'reflects a real refetch rather than a canned response.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: prepare({ fixture: { kind: 'resolves', entries: CHECKINS_ACTIVE } }),
} satisfies Meta<typeof FrontDeskBoardPanel>;

export default frontDeskBoardPanelMeta;
type FrontDeskBoardPanelStory = StoryObj<typeof frontDeskBoardPanelMeta>;

export const Default: FrontDeskBoardPanelStory = {
  name: 'Active check-ins, sorted by triage',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 3, name: 'Arrivals' })).toBeVisible();

    // Three active check-ins; the completed/cancelled fixtures live only in
    // the ShowAllToggle story, so nothing here is filtered.
    const rows = await canvas.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Percy'), // IMMEDIATE
      expect.stringContaining('Bramble'), // URGENT
      expect.stringContaining('Otis'), // STANDARD
    ]);
    await expect(canvas.getByText(String(3))).toBeVisible();

    // Room metadata resolved from the room store, and a live wait time from
    // the fixture's own `waitMinutes` rather than a clock-derived value.
    await expect(canvas.getByText('Room: Exam 1')).toBeVisible();
    await expect(canvas.getByLabelText('Waiting 25 min')).toBeVisible();

    // A WAITING row offers seen/no-show/cancel; the IN_CONSULTATION row
    // offers complete/cancel - both gated by `canEdit`, true for this fixture.
    await expect(canvas.getAllByRole('button', { name: 'Start consult' })).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Complete' })).toBeEnabled();

    // Completing Otis's consultation posts the transition, refetches, and the
    // now-COMPLETED row drops out of the active-only default view.
    await userEvent.click(canvas.getByRole('button', { name: 'Complete' }));
    await waitFor(() => expect(canvas.queryByText('Otis')).not.toBeInTheDocument());
    await expect(canvas.getByText(String(2))).toBeVisible();
  },
};

export const Loading: FrontDeskBoardPanelStory = {
  name: 'Loading the board',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 3, name: 'Arrivals' });
    // Three placeholder rows stand in for the list; they are `aria-hidden`,
    // so no real listitem or the count pill has appeared yet.
    await waitFor(() =>
      expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull()
    );
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    await expect(canvas.queryByText(String(3))).not.toBeInTheDocument();
  },
};

export const EmptyBoard: FrontDeskBoardPanelStory = {
  name: 'No patients checked in',
  beforeEach: prepare({ fixture: { kind: 'resolves', entries: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No patients are checked in')).toBeVisible();

    // Opening the add form and submitting without a patient selected is real
    // client-side validation, not a network round trip.
    await userEvent.click(canvas.getByRole('button', { name: 'Check in patient' }));
    await expect(await canvas.findByLabelText('Patient')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Check in patient' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Choose a patient to check in.'
    );
  },
};

export const LoadFailed: FrontDeskBoardPanelStory = {
  name: 'Board could not load',
  beforeEach: [
    prepare({ fixture: { kind: 'rejects', message: 'Check-in service unavailable.' } }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The hook's catch always reports this fixed copy, not the server's own
    // message - so the alert text is independent of what the fixture rejects with.
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Unable to load the check-in board right now.'
    );
    // The error banner and the empty body are not mutually exclusive - both
    // render at once, since `checkIns` never left its initial empty array.
    await expect(canvas.getByText('No patients are checked in')).toBeVisible();
  },
};

export const ReadOnly: FrontDeskBoardPanelStory = {
  name: 'Edit permission revoked - view only',
  beforeEach: prepare({
    fixture: { kind: 'resolves', entries: CHECKINS_ACTIVE },
    revoked: ['appointments:edit:any', 'appointments:edit:own'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Rows still render - viewing the board is not what canEdit gates.
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(3);

    // Every edit control is withheld: no transition buttons, no add button,
    // no room-assign dropdown, even though Otis already has a room assigned.
    await expect(canvas.queryByRole('button', { name: 'Start consult' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Check in patient' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Assign room')).not.toBeInTheDocument();

    // The show-all toggle is not part of edit gating, so it is still there.
    await expect(canvas.getByRole('button', { name: 'Show all' })).toBeEnabled();
  },
};

export const ShowAllToggle: FrontDeskBoardPanelStory = {
  name: 'Show all reveals completed and cancelled',
  beforeEach: prepare({ fixture: { kind: 'resolves', entries: CHECKINS_WITH_HISTORY } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(3);
    const toggle = canvas.getByRole('button', { name: 'Show all' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);

    await expect(await canvas.findByRole('button', { name: 'Active only' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(5);
    await expect(canvas.getByText(String(5))).toBeVisible();
    await expect(canvas.getByText('Completed')).toBeVisible();
    await expect(canvas.getByText('Cancelled')).toBeVisible();
  },
};
