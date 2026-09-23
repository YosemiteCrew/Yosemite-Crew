import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useParentStore } from '@/app/stores/parentStore';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import type { WaitlistEntry } from '@/app/features/appointments/services/waitlistService';
import WaitlistPanel from './WaitlistPanel';

const ORG_ID = 'org-storybook-waitlist-panel';

const membership = (revoked: string[] = []) => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-fields',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const companion = (id: string, name: string, parentId: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId,
  name,
  type: 'dog',
  breed: 'Labrador',
  dateOfBirth: new Date('2020-03-01'),
  gender: 'female',
  isInsured: false,
});

const parent = (id: string, firstName: string, lastName: string): StoredParent => ({
  id,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}@example.com`,
  address: {},
  createdFrom: 'pms',
});

// Shadow is deliberately not on the waitlist yet - the Add story puts it there.
const COMPANIONS: StoredCompanion[] = [
  companion('companion-nova', 'Nova', 'parent-reyes'),
  companion('companion-biscuit', 'Biscuit', 'parent-ortiz'),
  companion('companion-shadow', 'Shadow', 'parent-lindqvist'),
];
const PARENTS: StoredParent[] = [
  parent('parent-reyes', 'Maria', 'Reyes'),
  parent('parent-ortiz', 'Daniel', 'Ortiz'),
  parent('parent-lindqvist', 'Elin', 'Lindqvist'),
];

const entry = (
  overrides: Partial<WaitlistEntry> & Pick<WaitlistEntry, 'id' | 'patientId' | 'status'>
): WaitlistEntry => ({
  organisationId: ORG_ID,
  requestedBy: null,
  preferredLeadId: null,
  appointmentType: null,
  earliestDate: null,
  latestDate: null,
  notes: null,
  offeredAt: null,
  bookedAt: null,
  expiresAt: null,
  createdAt: '2026-08-18T09:00:00.000Z',
  updatedAt: '2026-08-18T09:00:00.000Z',
  ...overrides,
});

const ENTRIES: WaitlistEntry[] = [
  entry({
    id: 'wl-nova',
    patientId: 'companion-nova',
    status: 'WAITING',
    appointmentType: 'Dental',
    createdAt: '2026-08-18T09:00:00.000Z',
  }),
  entry({
    id: 'wl-biscuit',
    patientId: 'companion-biscuit',
    status: 'OFFERED',
    appointmentType: 'Vaccination',
    offeredAt: '2026-08-21T09:00:00.000Z',
    createdAt: '2026-08-19T09:00:00.000Z',
  }),
];

type WaitlistFixture =
  | { kind: 'resolves'; entries: WaitlistEntry[] }
  /** Held open on purpose: the only way to hold the loading skeleton still. */
  | { kind: 'pending' }
  | { kind: 'rejects' };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The panel reads and writes `/v1/pms/organisation/:id/waitlist` (and its
 * `/:entryId/offer|cancel` transitions) through the shared axios instance, so
 * its adapter is the seam. A resolved fixture keeps its own mutable copy of the
 * list so an add/offer/cancel is reflected in the refetch the hook makes right
 * after - the same round trip the real backend does.
 */
const buildAdapter = (fixture: WaitlistFixture): AxiosAdapter => {
  let entries = fixture.kind === 'resolves' ? fixture.entries : [];
  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();
    if (!url.includes('/waitlist')) return Promise.resolve(respond(config, []));

    if (method === 'get') {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 500'), {
            isAxiosError: true,
            config,
            response: {
              status: 500,
              statusText: 'Internal Server Error',
              data: {},
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, entries));
    }

    if (/\/waitlist$/.test(url)) {
      const body = JSON.parse(String(config.data ?? '{}')) as {
        patientId: string;
        appointmentType?: string;
        notes?: string;
      };
      const created = entry({
        id: `wl-new-${entries.length + 1}`,
        patientId: body.patientId,
        status: 'WAITING',
        appointmentType: body.appointmentType ?? null,
        notes: body.notes ?? null,
        createdAt: new Date().toISOString(),
      });
      entries = [...entries, created];
      return Promise.resolve(respond(config, created));
    }

    const transition = /\/waitlist\/([^/]+)\/(offer|cancel)$/.exec(url);
    if (transition) {
      const [, id, action] = transition;
      const nextStatus = action === 'offer' ? 'OFFERED' : 'CANCELLED';
      entries = entries.map((e) => (e.id === id ? { ...e, status: nextStatus } : e));
      const updated = entries.find((e) => e.id === id) ?? entries[0];
      return Promise.resolve(respond(config, updated));
    }

    return Promise.resolve(respond(config, []));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * Seeds the org, companion and parent stores the container's hooks read, and
 * points the shared axios instance at the fixture adapter. Mirrors the
 * companions store the way `Discounts/index.stories.tsx` seeds finance's
 * stores - each is pre-populated with an entry for this org so the loader
 * hooks short-circuit rather than reaching the network.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: WaitlistFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();
    const snapshots = {
      org: useOrgStore.getState(),
      companion: useCompanionStore.getState(),
      parent: useParentStore.getState(),
    };
    api.defaults.adapter = buildAdapter(fixture);

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useCompanionStore.setState({
      companionsById: Object.fromEntries(COMPANIONS.map((c) => [c.id, c])),
      companionsIdsByOrgId: { [ORG_ID]: COMPANIONS.map((c) => c.id) },
      status: 'loaded',
    });
    useParentStore.setState({
      parentsById: Object.fromEntries(PARENTS.map((p) => [p.id, p])),
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useParentStore.setState(snapshots.parent);
      useCompanionStore.setState(snapshots.companion);
      useOrgStore.setState(snapshots.org);
      clearInFlightGetRequests();
    };
  };

/**
 * A refused load is logged twice on its way to the hook's catch (once by the
 * shared axios wrapper, once by the service's own `logFailure`), and the
 * render check treats a console error as a broken story. Only those two
 * expected lines are dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.filter((a) => typeof a === 'string').join(' ');
    const expected = text.includes('API getData error') || text.includes('Failed to load waitlist');
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'Appointments/WaitlistPanel',
  component: WaitlistPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data container for the presentational `Waitlist`. It loads the primary ' +
          "organisation's waitlist, resolves each entry's companion and owner names from " +
          'the companions store (an entry itself only carries a patient id), and wires the ' +
          'offer/cancel/add actions from `useWaitlist` onto the panel. "Book" has no service ' +
          'call of its own here - a waitlist entry has no time slot to book directly, so it ' +
          'calls `onBookAppointment` to open the ordinary New Appointment form and lets staff ' +
          'pick a slot through the normal create flow. Edit actions (offer, cancel, add, book) ' +
          'are withheld entirely, not just disabled, when the signed-in user lacks the ' +
          '`appointments:edit:any`/`appointments:edit:own` permission.\n\n' +
          'The stories seed the org/companion/parent stores the container reads and answer ' +
          'the waitlist endpoint from the shared axios adapter, the same mocking approach ' +
          '`Discounts/index.stories.tsx` uses for finance.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onBookAppointment: fn(),
  },
  beforeEach: prepare({ fixture: { kind: 'resolves', entries: ENTRIES } }),
} satisfies Meta<typeof WaitlistPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 3, name: 'Waitlist' })).toBeVisible();
    await expect(canvas.getByText('Nova')).toBeVisible();
    await expect(canvas.getByText('Maria Reyes')).toBeVisible();
    await expect(canvas.getByText('Offered')).toBeVisible();

    // "Book" has no service call of its own - it hands the entry straight to
    // the caller-supplied onBookAppointment, which opens the New Appointment form.
    await userEvent.click(canvas.getAllByRole('button', { name: 'Book appointment' })[0]);
    await expect(args.onBookAppointment).toHaveBeenCalledTimes(1);
    await expect(args.onBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wl-nova' })
    );
  },
};

export const Empty: Story = {
  name: 'No entries',
  beforeEach: prepare({ fixture: { kind: 'resolves', entries: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No one is on the waitlist')).toBeVisible();
  },
};

export const Loading: Story = {
  name: 'Loading the waitlist',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 3, name: 'Waitlist' });
    // The skeleton rows render in place of the list while the fetch is pending.
    await waitFor(() =>
      expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull()
    );
    await expect(canvas.queryByText('Nova')).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Waitlist failed to load',
  beforeEach: [prepare({ fixture: { kind: 'rejects' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Unable to load the waitlist right now.');
    await expect(canvas.getByText('No one is on the waitlist')).toBeVisible();
  },
};

export const ReadOnly: Story = {
  name: 'Appointment edit revoked - actions hidden',
  beforeEach: prepare({
    fixture: { kind: 'resolves', entries: ENTRIES },
    revoked: ['appointments:edit:any', 'appointments:edit:own'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Nova')).toBeVisible();
    // The rows and their status are still readable; only the edit actions are gone.
    await expect(canvas.queryByRole('button', { name: 'Add to waitlist' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Book appointment' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument();
  },
};

export const AddingAnEntry: Story = {
  name: 'Adding a companion to the waitlist',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Nova');

    await userEvent.click(canvas.getByRole('button', { name: 'Add to waitlist' }));
    await userEvent.selectOptions(await canvas.findByLabelText('Companion'), 'companion-shadow');
    await userEvent.type(canvas.getByLabelText('Requested service'), 'Grooming');
    await userEvent.click(canvas.getByRole('button', { name: 'Add to waitlist' }));

    // The form closes and the list is refetched, so the new row appears.
    await expect(await canvas.findByText('Shadow')).toBeVisible();
    await expect(canvas.getByText('Elin Lindqvist')).toBeVisible();
    await expect(canvas.queryByLabelText('Companion')).not.toBeInTheDocument();
  },
};
