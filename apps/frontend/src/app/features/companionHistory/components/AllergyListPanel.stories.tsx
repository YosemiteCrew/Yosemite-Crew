import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  CreatePatientAllergyInput,
  PatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';
import AllergyListPanel from './AllergyListPanel';

const ORG_ID = 'org-storybook-companion-history';
const COMPANION_ID = 'patient-storybook-fenn';

const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-fenn',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const allergy = (
  over: Partial<PatientAllergy> & Pick<PatientAllergy, 'id' | 'allergen'>
): PatientAllergy => ({
  organisationId: ORG_ID,
  patientId: COMPANION_ID,
  allergyType: 'DRUG',
  severity: 'MILD',
  reaction: null,
  status: 'ACTIVE',
  onsetDate: null,
  resolvedDate: null,
  notes: null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const PENICILLIN = allergy({
  id: 'allergy-penicillin',
  allergen: 'Penicillin',
  allergyType: 'DRUG',
  severity: 'LIFE_THREATENING',
  status: 'ACTIVE',
  reaction: 'Anaphylaxis, facial swelling',
  onsetDate: '2025-11-02T00:00:00.000Z',
  notes: 'Confirmed by intradermal test.',
});
const CHICKEN = allergy({
  id: 'allergy-chicken',
  allergen: 'Chicken protein',
  allergyType: 'FOOD',
  severity: 'MODERATE',
  status: 'ACTIVE',
  reaction: 'Chronic pruritus',
  onsetDate: '2026-01-04T00:00:00.000Z',
});
const GRASS = allergy({
  id: 'allergy-grass',
  allergen: 'Grass pollen',
  allergyType: 'ENVIRONMENTAL',
  severity: 'MILD',
  status: 'UNCONFIRMED',
});

const SAMPLE: PatientAllergy[] = [PENICILLIN, CHICKEN, GRASS];
const BY_ID: Record<string, PatientAllergy> = Object.fromEntries(SAMPLE.map((a) => [a.id, a]));

type ListFixture =
  | { kind: 'resolves'; allergies: PatientAllergy[] }
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
 * The panel reads and writes `/v1/pms/organisation/:id/patient-allergies` through
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

    if (!url.includes('/patient-allergies')) return Promise.resolve(respond(config, []));

    if (method === 'post' && url.endsWith('/resolve')) {
      const id = url.split('/').slice(-2, -1)[0] ?? '';
      const existing = BY_ID[id] ?? allergy({ id, allergen: 'Allergy' });
      return Promise.resolve(
        respond(config, {
          ...existing,
          status: 'RESOLVED',
          resolvedDate: '2026-02-01T00:00:00.000Z',
        })
      );
    }

    if (method === 'post') {
      const body = JSON.parse(String(config.data ?? '{}')) as CreatePatientAllergyInput;
      return Promise.resolve(
        respond(
          config,
          allergy({
            id: 'allergy-new',
            allergen: body.allergen,
            allergyType: body.allergyType,
            severity: body.severity,
            reaction: body.reaction ?? null,
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
        Object.assign(new Error('Request failed with status code 403'), {
          isAxiosError: true,
          config,
          response: {
            status: 403,
            statusText: 'Forbidden',
            data: {},
            headers: {},
            config,
          },
        })
      );
    }
    return Promise.resolve(respond(config, fixture.allergies));
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
 * A refused read is logged by the axios wrapper on its way to the hook's catch,
 * and the render check treats a console error as a broken story. Only that
 * line is dropped; anything else still reaches the console.
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

const allergyListPanelMeta = {
  title: 'CompanionHistory/AllergyListPanel',
  component: AllergyListPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data container for `AllergyList`. It calls `useAllergyList` for the signed-in ' +
          "member's permissions (`appointments:view:any` / `appointments:edit:any` on the " +
          "active organisation from `useOrgStore`), fetches the patient's allergies from the " +
          'patient-allergies API, and forwards the create and resolve callbacks. All state ' +
          'lives in the hook, not this component - it renders nothing when the member cannot ' +
          'view allergies on the active organisation, and otherwise just projects the hook ' +
          'onto the presentational `AllergyList`.\n\n' +
          "The stories seed `useOrgStore` with a real membership so the hook's own permission " +
          'check runs unmocked, and swap the shared axios adapter to answer the ' +
          'patient-allergies endpoints from fixtures instead of a live backend.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    companionId: {
      control: 'text',
      description: 'The companion (patient) whose allergies to load. `companionId === patientId`.',
    },
  },
  args: {
    companionId: COMPANION_ID,
  },
  beforeEach: prepare({ fixture: { kind: 'resolves', allergies: SAMPLE } }),
} satisfies Meta<typeof AllergyListPanel>;

export default allergyListPanelMeta;
type AllergyListPanelStory = StoryObj<typeof allergyListPanelMeta>;

export const Default: AllergyListPanelStory = {
  name: 'Allergies loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole('heading', { level: 3, name: 'Allergies' })).toBeVisible();
    await expect(canvas.getByText('Penicillin')).toBeVisible();
    await expect(canvas.getByText('Life-threatening')).toBeVisible();
    await expect(canvas.getByText('Chicken protein')).toBeVisible();
    await expect(canvas.getByText('Grass pollen')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add allergy' })).toBeEnabled();

    // Real create flow: submits through the hook, into the mocked POST.
    await userEvent.click(canvas.getByRole('button', { name: 'Add allergy' }));
    const allergenInput = await canvas.findByLabelText('Allergen');
    await userEvent.type(allergenInput, 'Latex');
    await userEvent.click(canvas.getByRole('button', { name: 'Save allergy' }));
    await expect(canvas.findByText('Latex')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Save allergy' })).not.toBeInTheDocument();

    // Real resolve flow: submits through the hook, into the mocked POST.
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve Chicken protein' }));
    await waitFor(() =>
      expect(canvas.getByText('Chicken protein').closest('li')).toHaveTextContent('Resolved')
    );
  },
};

export const Empty: AllergyListPanelStory = {
  name: 'No allergies recorded',
  beforeEach: prepare({ fixture: { kind: 'resolves', allergies: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No allergies recorded for this patient yet.')
    ).toBeVisible();
    await expect(canvas.queryByText('Penicillin')).not.toBeInTheDocument();
  },
};

export const Loading: AllergyListPanelStory = {
  name: 'Loading the allergy list',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 3, name: 'Allergies' });
    await waitFor(() =>
      expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull()
    );
    await expect(canvas.queryByText('Penicillin')).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('No allergies recorded for this patient yet.')
    ).not.toBeInTheDocument();
  },
};

export const LoadFailed: AllergyListPanelStory = {
  name: 'Allergy list failed to load',
  beforeEach: [prepare({ fixture: { kind: 'rejects' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not load the allergy list. Please try again.');
    await expect(canvas.queryByText('Penicillin')).not.toBeInTheDocument();
  },
};

export const ReadOnly: AllergyListPanelStory = {
  name: 'View only - edit permission revoked',
  beforeEach: prepare({
    fixture: { kind: 'resolves', allergies: SAMPLE },
    revoked: ['appointments:edit:any'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText('Penicillin')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add allergy' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Resolve Chicken protein' })
    ).not.toBeInTheDocument();
  },
};

export const NoAccess: AllergyListPanelStory = {
  name: 'View permission revoked - renders nothing',
  beforeEach: prepare({
    fixture: { kind: 'resolves', allergies: SAMPLE },
    revoked: ['appointments:view:any'],
  }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement).toBeEmptyDOMElement());
  },
};
