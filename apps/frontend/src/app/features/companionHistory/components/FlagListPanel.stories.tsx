import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  FlagSeverity,
  PatientFlag,
  PatientFlagType,
} from '@/app/features/companionHistory/services/patientFlagService';
import FlagListPanel from './FlagListPanel';

const ORG_ID = 'org-storybook-flag-panel';
const COMPANION_ID = 'companion-bramble';

const membership = (revoked: string[] = []) => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-alvarez',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const flag = (
  overrides: Partial<PatientFlag> & Pick<PatientFlag, 'id' | 'title' | 'flagType' | 'severity'>
): PatientFlag => ({
  organisationId: ORG_ID,
  patientId: COMPANION_ID,
  description: null,
  isActive: true,
  createdBy: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: '2026-02-10T09:00:00.000Z',
  updatedAt: '2026-02-10T09:00:00.000Z',
  ...overrides,
});

const FLAGS: PatientFlag[] = [
  flag({
    id: 'flag-aggression',
    title: 'Bites when startled',
    flagType: 'AGGRESSION',
    severity: 'HIGH',
    description: 'Approach from the front and speak before touching.',
  }),
  flag({
    id: 'flag-escape',
    title: 'Jumps low fences',
    flagType: 'ESCAPE_RISK',
    severity: 'CRITICAL',
  }),
];

type FlagFixture =
  | { kind: 'resolves'; flags: PatientFlag[] }
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
 * The panel reads and writes `/v1/pms/organisation/:id/patient-flags` (and its
 * `/:flagId/resolve` transition) through the shared axios instance, so its
 * adapter is the seam. A resolved fixture keeps its own mutable copy of the
 * list so a create is reflected in the refetch `useCreateFlag` makes right
 * after - the same round trip the real backend does.
 */
const buildAdapter = (fixture: FlagFixture): AxiosAdapter => {
  let flags = fixture.kind === 'resolves' ? fixture.flags : [];
  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();
    if (!url.includes('/patient-flags')) return Promise.resolve(respond(config, []));

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
      return Promise.resolve(respond(config, flags));
    }

    const resolveMatch = /\/patient-flags\/([^/]+)\/resolve$/.exec(url);
    if (method === 'post' && resolveMatch) {
      const [, id] = resolveMatch;
      flags = flags.map((item) =>
        item.id === id ? { ...item, isActive: false, resolvedAt: new Date().toISOString() } : item
      );
      const updated = flags.find((item) => item.id === id) ?? flags[0];
      return Promise.resolve(respond(config, updated));
    }

    if (method === 'post' && /\/patient-flags$/.test(url)) {
      const body = JSON.parse(String(config.data ?? '{}')) as {
        patientId: string;
        title: string;
        flagType: PatientFlagType;
        severity: FlagSeverity;
        description?: string;
      };
      const created: PatientFlag = {
        id: `flag-new-${flags.length + 1}`,
        organisationId: ORG_ID,
        patientId: body.patientId,
        flagType: body.flagType,
        severity: body.severity,
        title: body.title,
        description: body.description ?? null,
        isActive: true,
        createdBy: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      flags = [...flags, created];
      return Promise.resolve(respond(config, created));
    }

    return Promise.resolve(respond(config, []));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * Seeds the org store the panel's `usePatientFlags` reads (for the primary
 * organisation and the signed-in membership's permissions) and points the
 * shared axios instance at the fixture adapter - the same mocking approach
 * `Discounts/index.stories.tsx` uses for finance.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: FlagFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();
    const snapshot = useOrgStore.getState();
    api.defaults.adapter = buildAdapter(fixture);

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useOrgStore.setState(snapshot);
      clearInFlightGetRequests();
    };
  };

/**
 * A refused load is logged twice on its way to the hook's catch (once by the
 * shared axios wrapper, once by the service's own `requestWithLog`), and the
 * render check treats a console error as a broken story. Only those two
 * expected lines are dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.filter((arg) => typeof arg === 'string').join(' ');
    const expected =
      text.includes('API getData error') || text.includes('Failed to load patient flags');
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'CompanionHistory/FlagListPanel',
  component: FlagListPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data container for the presentational `FlagList`. All state - the loaded flags, ' +
          'the create- and resolve-in-flight ids, and the derived view/edit permissions - lives ' +
          'in `usePatientFlags`; this component is a thin projection that renders nothing when ' +
          'the signed-in user lacks `companions:view:any` for the active organisation. Flags are ' +
          'loaded, and reloaded after a create, from the shared patient-flags endpoint scoped to ' +
          'the primary organisation and the given companion; resolving a flag calls its own ' +
          'endpoint and drops it from the active list locally rather than reloading.\n\n' +
          'The stories seed `useOrgStore` with a membership (the same way ' +
          "`Discounts/index.stories.tsx` seeds finance's stores) and answer the patient-flags " +
          'endpoint from the shared axios adapter, so a real create/resolve round trip runs ' +
          'entirely in the browser.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: COMPANION_ID,
  },
  beforeEach: prepare({ fixture: { kind: 'resolves', flags: FLAGS } }),
} satisfies Meta<typeof FlagListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole('heading', { level: 2, name: 'Patient flags' })).toBeVisible();
    await expect(canvas.getByText('2 active')).toBeVisible();
    await expect(canvas.getByText('Bites when startled')).toBeVisible();
    await expect(canvas.getByText('Jumps low fences')).toBeVisible();

    // Resolving one drops it from the active list and the count, with no reload.
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve Bites when startled' }));
    await waitFor(() => expect(canvas.queryByText('Bites when startled')).not.toBeInTheDocument());
    await expect(canvas.getByText('1 active')).toBeVisible();
  },
};

export const Empty: Story = {
  name: 'No active flags',
  beforeEach: prepare({ fixture: { kind: 'resolves', flags: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText('No active flags for this patient.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add flag' })).toBeEnabled();
  },
};

export const Loading: Story = {
  name: 'Loading the flags',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 2, name: 'Patient flags' });
    // The skeleton rows render in place of the list while the fetch is pending.
    await waitFor(() =>
      expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull()
    );
    await expect(canvas.queryByText('Bites when startled')).not.toBeInTheDocument();
    // The active-count badge only appears once loading settles.
    await expect(canvas.queryByText(/\d+ active/)).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Flags failed to load',
  beforeEach: [prepare({ fixture: { kind: 'rejects' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not load patient flags. Please try again.');
    await expect(canvas.queryByText('Bites when startled')).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Companion edit revoked - view only',
  beforeEach: prepare({
    fixture: { kind: 'resolves', flags: FLAGS },
    revoked: ['companions:edit:any'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText('Bites when startled')).toBeVisible();
    // Flags are still readable; only the edit affordances are gone.
    await expect(canvas.queryByRole('button', { name: 'Add flag' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Resolve Bites when startled' })
    ).not.toBeInTheDocument();
  },
};

export const AddingAFlag: Story = {
  name: 'Adding a flag',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Bites when startled');

    await userEvent.click(canvas.getByRole('button', { name: 'Add flag' }));
    await userEvent.type(await canvas.findByLabelText('Flag title'), 'Needs sedation for X-rays');
    await userEvent.selectOptions(canvas.getByLabelText('Flag type'), 'SPECIAL_HANDLING');
    await userEvent.selectOptions(canvas.getByLabelText('Severity'), 'HIGH');
    await userEvent.click(canvas.getByRole('button', { name: 'Save flag' }));

    // The form closes and the list is reloaded, so the new flag joins the seeded ones.
    await expect(canvas.findByText('Needs sedation for X-rays')).toBeVisible();
    await expect(canvas.getByText('3 active')).toBeVisible();
    await expect(canvas.queryByLabelText('Flag title')).not.toBeInTheDocument();
  },
};
