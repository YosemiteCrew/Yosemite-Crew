import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  CreatePatientProblemInput,
  PatientProblem,
} from '@/app/features/companionHistory/services/patientProblemService';
import ProblemListPanel from './ProblemListPanel';

const ORG_ID = 'org-storybook-companion-history';
const COMPANION_ID = 'patient-storybook-bramble';

const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-bramble',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const problem = (
  over: Partial<PatientProblem> & Pick<PatientProblem, 'id' | 'name'>
): PatientProblem => ({
  organisationId: ORG_ID,
  patientId: COMPANION_ID,
  encounterId: null,
  codeSystem: null,
  code: null,
  status: 'ACTIVE',
  severity: null,
  onsetDate: null,
  resolvedDate: null,
  notes: null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const KIDNEY = problem({
  id: 'problem-kidney',
  name: 'Chronic kidney disease',
  severity: 'SEVERE',
  status: 'ACTIVE',
  code: 'N18.9',
  onsetDate: '2025-11-02T00:00:00.000Z',
  notes: 'IRIS stage 3. Monitoring phosphate and blood pressure.',
});
const OTITIS = problem({
  id: 'problem-otitis',
  name: 'Otitis externa (left ear)',
  severity: 'MODERATE',
  status: 'ACTIVE',
  onsetDate: '2026-01-04T00:00:00.000Z',
});
const WOUND = problem({
  id: 'problem-wound',
  name: 'Post-operative wound',
  severity: 'MODERATE',
  status: 'RESOLVED',
  onsetDate: '2025-08-01T00:00:00.000Z',
  resolvedDate: '2025-08-20T00:00:00.000Z',
});

const SAMPLE: PatientProblem[] = [KIDNEY, OTITIS, WOUND];
const BY_ID: Record<string, PatientProblem> = Object.fromEntries(SAMPLE.map((p) => [p.id, p]));

type ListFixture =
  | { kind: 'resolves'; problems: PatientProblem[] }
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
 * The panel reads and writes `/v1/pms/organisation/:id/patient-problems` through
 * the shared axios instance, so its adapter is the seam. A create POST is echoed
 * back as the record the server would store; a resolve POST looks the record up
 * by the id in its URL and marks it resolved. The list GET is driven by the
 * fixture so each story can show a different load outcome.
 */
const buildAdapter =
  (fixture: ListFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (!url.includes('/patient-problems')) return Promise.resolve(respond(config, []));

    if (method === 'post' && url.endsWith('/resolve')) {
      const id = url.split('/').slice(-2, -1)[0] ?? '';
      const existing = BY_ID[id] ?? problem({ id, name: 'Problem' });
      return Promise.resolve(
        respond(config, {
          ...existing,
          status: 'RESOLVED',
          resolvedDate: '2026-02-01T00:00:00.000Z',
        })
      );
    }

    if (method === 'post') {
      const body = JSON.parse(String(config.data ?? '{}')) as CreatePatientProblemInput;
      return Promise.resolve(
        respond(
          config,
          problem({
            id: 'problem-new',
            name: body.name,
            severity: body.severity ?? null,
            notes: body.notes ?? null,
            onsetDate: body.onsetDate ?? null,
            status: 'ACTIVE',
          })
        )
      );
    }

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
    return Promise.resolve(respond(config, fixture.problems));
  };

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The panel gates on `appointments:view:any` / `appointments:edit:any` from
 * `usePermissions`, which is itself derived from `useOrgStore`'s active
 * membership - so the stories seed a real membership on that store rather than
 * mocking the permission hook. `revoked` reproduces exactly how a practice
 * takes a right off one person.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: ListFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();
    const orgSnapshot = useOrgStore.getState();
    api.defaults.adapter = buildAdapter(fixture);
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useOrgStore.setState(orgSnapshot);
      clearInFlightGetRequests();
    };
  };

/**
 * A refused read is logged by the axios wrapper on its way to the panel's
 * catch, and the render check treats a console error as a broken story. Only
 * that line is dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some((arg) => typeof arg === 'string' && arg.includes('API getData error'));
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const problemListPanelMeta = {
  title: 'CompanionHistory/ProblemListPanel',
  component: ProblemListPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data container for `ProblemList`. It calls `usePermissions` directly for the ' +
          "signed-in member's `appointments:view:any` / `appointments:edit:any` grants on the " +
          "active organisation (from `useOrgStore`), fetches the companion's problems from the " +
          'patient-problems API on mount, and wires the create and resolve callbacks to that ' +
          'same service. All state - loading, the fetched list, the create/resolve in-flight ' +
          'flags - lives in this component; `ProblemList` itself is a pure presentational ' +
          'component that only renders what it is given. It renders nothing when the member ' +
          'cannot view problems.\n\n' +
          'The stories seed `useOrgStore` with a real membership so the permission check runs ' +
          'unmocked, and swap the shared axios adapter to answer the patient-problems endpoints ' +
          'from fixtures instead of a live backend.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    companionId: {
      control: 'text',
      description: 'The companion (patient) whose problems to load.',
    },
  },
  args: {
    companionId: COMPANION_ID,
  },
  beforeEach: prepare({ fixture: { kind: 'resolves', problems: SAMPLE } }),
} satisfies Meta<typeof ProblemListPanel>;

export default problemListPanelMeta;
type ProblemListPanelStory = StoryObj<typeof problemListPanelMeta>;

export const Default: ProblemListPanelStory = {
  name: 'Problems loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 3, name: 'Problem list' })
    ).toBeVisible();
    await expect(canvas.getByText('Chronic kidney disease')).toBeVisible();
    await expect(canvas.getByText('Severe')).toBeVisible();
    await expect(canvas.getByText('Otitis externa (left ear)')).toBeVisible();
    await expect(canvas.getByText('Post-operative wound')).toBeVisible();
    await expect(canvas.getByText('2 active')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add problem' })).toBeEnabled();

    // Real create flow: submits through the panel, into the mocked POST.
    await userEvent.click(canvas.getByRole('button', { name: 'Add problem' }));
    const titleInput = await canvas.findByLabelText('Problem title');
    await userEvent.type(titleInput, 'Seasonal allergies');
    await userEvent.click(canvas.getByRole('button', { name: 'Save problem' }));
    await expect(await canvas.findByText('Seasonal allergies')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Save problem' })).not.toBeInTheDocument();

    // Real resolve flow: submits through the panel, into the mocked POST.
    await userEvent.click(
      canvas.getByRole('button', { name: 'Resolve Otitis externa (left ear)' })
    );
    await waitFor(() =>
      expect(canvas.getByText('Otitis externa (left ear)').closest('li')).toHaveTextContent(
        'Resolved'
      )
    );
  },
};

export const Empty: ProblemListPanelStory = {
  name: 'No problems recorded',
  beforeEach: prepare({ fixture: { kind: 'resolves', problems: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No problems recorded for this patient yet.')
    ).toBeVisible();
    await expect(canvas.queryByText('Chronic kidney disease')).not.toBeInTheDocument();
  },
};

export const Loading: ProblemListPanelStory = {
  name: 'Loading the problem list',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 3, name: 'Problem list' });
    await waitFor(() =>
      expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull()
    );
    await expect(canvas.queryByText('Chronic kidney disease')).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('No problems recorded for this patient yet.')
    ).not.toBeInTheDocument();
  },
};

export const LoadFailed: ProblemListPanelStory = {
  name: 'Problem list failed to load',
  beforeEach: [prepare({ fixture: { kind: 'rejects' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not load the problem list. Please try again.');
    await expect(canvas.queryByText('Chronic kidney disease')).not.toBeInTheDocument();
  },
};

export const ReadOnly: ProblemListPanelStory = {
  name: 'View only - edit permission revoked',
  beforeEach: prepare({
    fixture: { kind: 'resolves', problems: SAMPLE },
    revoked: ['appointments:edit:any'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Chronic kidney disease')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add problem' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Resolve Otitis externa (left ear)' })
    ).not.toBeInTheDocument();
  },
};

export const NoAccess: ProblemListPanelStory = {
  name: 'View permission revoked - renders nothing',
  beforeEach: prepare({
    fixture: { kind: 'resolves', problems: SAMPLE },
    revoked: ['appointments:view:any'],
  }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement).toBeEmptyDOMElement());
  },
};
