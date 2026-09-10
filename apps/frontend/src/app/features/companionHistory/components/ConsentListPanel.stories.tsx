import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import ConsentListPanel from './ConsentListPanel';
import type {
  CreatePatientConsentInput,
  PatientConsent,
} from '@/app/features/companionHistory/services/patientConsentService';

const ORG_ID = 'org-storybook-consents';
const COMPANION_ID = 'companion-fenn';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * OWNER carries both `appointments:view:any` and `appointments:edit:any` by
 * default, so revoking one is the only way to reach the read-only or hidden
 * stories - the same way a real practice narrows a member's access.
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

const consent = (over: Partial<PatientConsent>): PatientConsent => ({
  id: over.id ?? 'consent-1',
  organisationId: ORG_ID,
  patientId: COMPANION_ID,
  consentType: over.consentType ?? 'SURGICAL',
  status: over.status ?? 'ACTIVE',
  procedureDesc: over.procedureDesc ?? null,
  consentedByName: over.consentedByName ?? null,
  consentedAt: over.consentedAt ?? '2026-01-10T09:00:00.000Z',
  expiresAt: over.expiresAt ?? null,
  witnessedBy: over.witnessedBy ?? null,
  revokedAt: over.revokedAt ?? null,
  revokedReason: over.revokedReason ?? null,
  documentId: null,
  notes: over.notes ?? null,
  createdAt: over.createdAt ?? '2026-01-10T09:00:00.000Z',
  updatedAt: over.updatedAt ?? '2026-01-10T09:00:00.000Z',
});

const SAMPLE: PatientConsent[] = [
  consent({
    id: 'consent-1',
    consentType: 'SURGICAL',
    status: 'ACTIVE',
    procedureDesc: 'Cranial cruciate ligament repair (left stifle)',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2026-01-08T09:00:00.000Z',
    witnessedBy: 'Dr. Okafor',
    notes: 'Owner briefed on anaesthetic risk and post-op physiotherapy.',
  }),
  consent({
    id: 'consent-2',
    consentType: 'DNR',
    status: 'ACTIVE',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2026-01-08T09:05:00.000Z',
    notes: 'Do not resuscitate on cardiac or respiratory arrest.',
  }),
  consent({
    id: 'consent-3',
    consentType: 'DATA_SHARING',
    status: 'EXPIRED',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2025-01-02T09:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
  }),
];

type ConsentsFixture =
  { kind: 'resolves'; records: PatientConsent[] } | { kind: 'pending' } | { kind: 'rejects' };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The panel reads and writes `/patient-consents` through the shared axios
 * instance (via `useConsentList`), so its adapter is the seam. A resolving
 * fixture keeps a mutable `records` array behind the closure: granting POSTs a
 * new row onto it and the panel's own refetch-after-grant reads the mutation
 * straight back, while revoking POSTs to `.../revoke` and the response IS the
 * updated row - the same two round trips `useConsentList` drives against the
 * real API.
 */
const buildAdapter = (fixture: ConsentsFixture): AxiosAdapter => {
  let records = fixture.kind === 'resolves' ? [...fixture.records] : [];
  let nextId = records.length + 1;

  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (!url.includes('/patient-consents')) {
      return Promise.resolve(respond(config, []));
    }

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
              data: { message: 'Consent service unavailable' },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, records));
    }

    if (method === 'post' && url.endsWith('/revoke')) {
      const id = url.split('/').at(-2) ?? '';
      const body = JSON.parse(String(config.data ?? '{}')) as { revokedReason?: string };
      records = records.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'REVOKED' as const,
              revokedAt: '2026-02-01T10:00:00.000Z',
              revokedReason: body.revokedReason ?? null,
            }
          : r
      );
      return Promise.resolve(
        respond(
          config,
          records.find((r) => r.id === id)
        )
      );
    }

    if (method === 'post') {
      const body = JSON.parse(String(config.data ?? '{}')) as CreatePatientConsentInput;
      const created = consent({
        id: `consent-${nextId++}`,
        consentType: body.consentType,
        procedureDesc: body.procedureDesc ?? null,
        consentedByName: body.consentedByName ?? null,
        witnessedBy: body.witnessedBy ?? null,
        notes: body.notes ?? null,
        expiresAt: body.expiresAt ?? null,
        consentedAt: '2026-02-01T10:00:00.000Z',
      });
      records = [...records, created];
      return Promise.resolve(respond(config, created));
    }

    return Promise.resolve(respond(config, []));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

const prepare =
  ({ fixture, revoked = [] }: { fixture: ConsentsFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();
    const orgSnapshot = useOrgStore.getState();
    api.defaults.adapter = buildAdapter(fixture);
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
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
 * A rejected load is logged twice on its way to the hook's `catch` - once by
 * `getData` itself and once by `patientConsentService`'s own wrapper - and the
 * render check treats a console error as a broken story. Only those two lines
 * are dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('API getData error') || arg.includes('Failed to load patient consents'))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'CompanionHistory/ConsentListPanel',
  component: ConsentListPanel,
  tags: ['autodocs'],
  args: {
    companionId: COMPANION_ID,
  },
  beforeEach: prepare({ fixture: { kind: 'resolves', records: SAMPLE } }),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data container for `ConsentList`. All state - the load, the grant form, the revoke ' +
          'flow - lives in `useConsentList`, which reads the active organisation from `useOrgStore` ' +
          'and calls the patient-consent endpoints through the shared axios client directly; this ' +
          'component only projects that state onto the presentational list and never fetches ' +
          'itself. It renders nothing when the member lacks `appointments:view:any` on the active ' +
          'organisation, and gates the grant and revoke controls on `appointments:edit:any` - both ' +
          'derived from the membership role rather than a prop. The stories seed `useOrgStore` with ' +
          'an organisation and membership and answer the consent endpoints from a mocked axios ' +
          'adapter, the same seam `Finance/Discounts` uses for its own page-level stories.',
      },
    },
  },
} satisfies Meta<typeof ConsentListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Consents loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByRole('heading', { name: 'Consents' })).toBeVisible();
    await expect(
      await canvas.findByText('Cranial cruciate ligament repair (left stifle)')
    ).toBeVisible();
    await expect(canvas.getByText('2 active')).toBeVisible();

    // Grant: the form POSTs through the mocked adapter, which appends the
    // record and then answers the refetch useConsentList makes right after -
    // the same round trip the real API drives.
    await userEvent.click(canvas.getByRole('button', { name: 'Record consent' }));
    await userEvent.type(
      canvas.getByLabelText('Procedure'),
      'Dental extraction, upper right canine'
    );
    await userEvent.type(canvas.getByLabelText('Consented by'), 'Priya Anand');
    await userEvent.click(canvas.getByRole('button', { name: 'Save consent' }));

    const newRow = (await canvas.findByText('Dental extraction, upper right canine')).closest(
      'li'
    ) as HTMLElement;
    await expect(newRow).not.toBeNull();
    await expect(await canvas.findByText('3 active')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Save consent' })).not.toBeInTheDocument();

    // Revoke: scoped to the new row, so the identically labelled "Revoke
    // Surgical consent" button on consent-1 is left untouched.
    const rowCanvas = within(newRow);
    await userEvent.click(rowCanvas.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.type(
      rowCanvas.getByLabelText('Reason for revoking'),
      'Client rescheduled the procedure.'
    );
    await userEvent.click(rowCanvas.getByRole('button', { name: 'Revoke consent' }));

    await expect(
      await rowCanvas.findByText('Reason: Client rescheduled the procedure.')
    ).toBeVisible();
    await expect(
      rowCanvas.queryByRole('button', { name: 'Revoke Surgical consent' })
    ).not.toBeInTheDocument();
    await expect(await canvas.findByText('2 active')).toBeVisible();
  },
};

export const Empty: Story = {
  name: 'No consents recorded',
  beforeEach: prepare({ fixture: { kind: 'resolves', records: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No consents recorded for this patient yet.')
    ).toBeVisible();
    await expect(canvas.queryByText(/active/)).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading the list',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Consents' });
    // The skeleton rows stand in for the list; nothing real has arrived yet.
    await expect(canvasElement.querySelector('ul[aria-hidden="true"]')).not.toBeNull();
    await expect(canvas.queryByText(/active/)).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('No consents recorded for this patient yet.')
    ).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'List failed to load',
  beforeEach: [prepare({ fixture: { kind: 'rejects' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A generous timeout: the reject -> catch -> setError -> re-render chain is
    // synchronous in the app, but on a loaded CI/dev machine the default 1s
    // findBy* window can be too tight for the browser's main thread to commit it.
    const alert = await canvas.findByRole('alert', {}, { timeout: 10000 });
    await expect(alert).toHaveTextContent('Could not load the consent list. Please try again.');
    await expect(
      canvas.queryByText('No consents recorded for this patient yet.')
    ).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Edit permission revoked - no grant or revoke controls',
  beforeEach: prepare({
    fixture: { kind: 'resolves', records: SAMPLE },
    revoked: ['appointments:edit:any'],
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Cranial cruciate ligament repair (left stifle)')
    ).toBeVisible();
    // The field is still there to read; the controls are absent rather than disabled.
    await expect(canvas.queryByRole('button', { name: 'Record consent' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Revoke/ })).not.toBeInTheDocument();
  },
};

export const Hidden: Story = {
  name: 'View permission missing - renders nothing',
  beforeEach: prepare({
    fixture: { kind: 'resolves', records: SAMPLE },
    revoked: ['appointments:view:any'],
  }),
  play: async ({ canvasElement }) => {
    // canView is derived synchronously from the store, seeded by beforeEach
    // before this mounts, so there is no flash of content to wait out.
    await waitFor(() => expect(canvasElement).toBeEmptyDOMElement(), { timeout: 10000 });
  },
};
