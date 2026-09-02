import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useOrganizationDocumentStore } from '@/app/stores/documentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import DocSigning from './index';

const ORG_ID = 'org-storybook-doc-signing';

/**
 * The origin the iframe branch is gated on. `getSafeDocumensoIframeUrl` compares
 * the resolved URL's origin against `NEXT_PUBLIC_DOCUMENSO_HOST` and returns ''
 * on any mismatch, so the stories pin the variable to a `.invalid` host: the TLD
 * never resolves, so the frame lays out its box without a request leaving for
 * the real portal. Same approach as DocSigning/DocSigningPortal.
 */
const PORTAL_ORIGIN = 'https://documenso.storybook.invalid';
const REDIRECT_URL = `${PORTAL_ORIGIN}/portal/home`;

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

type PortalFixture =
  /** Held open on purpose: the only way to hold the loading frame still. */
  | { kind: 'pending' }
  | { kind: 'resolves'; redirectUrl: string }
  | { kind: 'rejects'; message: string };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The portal POSTs `/v1/documenso/pms/redirect/:orgId` on mount; OrgGuard's
 * subscription loader GETs two finance endpoints. All go through the shared
 * axios instance, so its adapter is the seam. The 403 in the reject branch is
 * chosen: a 401 sends the interceptor into a real sign-out, and 5xx is retried.
 */
const buildAdapter =
  (fixture: PortalFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    if (url.includes('/v1/documenso/')) {
      if (fixture.kind === 'pending') return new Promise<never>(() => {});
      if (fixture.kind === 'rejects') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 403'), {
            isAxiosError: true,
            config,
            response: {
              status: 403,
              statusText: 'Forbidden',
              data: { message: fixture.message },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, { redirectUrl: fixture.redirectUrl }));
    }
    if (url.includes('/v1/finance/subscriptions/current')) {
      return Promise.resolve(
        respond(config, { data: { organisationId: ORG_ID, currency: 'GBP' } })
      );
    }
    if (url.includes('/v1/finance/usage-snapshots')) {
      return Promise.resolve(respond(config, { data: [] }));
    }
    return Promise.resolve(respond(config, []));
  };

const REAL_ADAPTER = api.defaults.adapter;
const env = process.env as Record<string, string | undefined>;

/**
 * The page ships behind `ProtectedRoute` and `OrgGuard` and calls `useLoadOrg`,
 * which only fires while the org store is idle. The stories lift the guards
 * with `NEXT_PUBLIC_DISABLE_AUTH_GUARD` - the local-only flag the shell honours
 * through `isLocalGuardBypassEnabled` - and seed every org-scoped index the
 * guard's loaders short-circuit on, so nothing reaches the network.
 */
const prepare = (fixture: PortalFixture) => () => {
  clearInFlightGetRequests();
  const previousBypass = env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const previousHost = env.NEXT_PUBLIC_DOCUMENSO_HOST;
  env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
  env.NEXT_PUBLIC_DOCUMENSO_HOST = PORTAL_ORIGIN;

  const snapshots = {
    appointment: useAppointmentStore.getState(),
    auth: useAuthStore.getState(),
    companion: useCompanionStore.getState(),
    document: useOrganizationDocumentStore.getState(),
    forms: useFormsStore.getState(),
    integration: useIntegrationStore.getState(),
    inventory: useInventoryStore.getState(),
    invoice: useInvoiceStore.getState(),
    org: useOrgStore.getState(),
    room: useOrganisationRoomStore.getState(),
    speciality: useSpecialityStore.getState(),
    task: useTaskStore.getState(),
    team: useTeamStore.getState(),
  };
  api.defaults.adapter = buildAdapter(fixture);

  const emptyIndex = { [ORG_ID]: [] as string[] };
  const fetchedAt = { [ORG_ID]: new Date().toISOString() };

  useAuthStore.setState({ status: 'authenticated' });
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: ORG },
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });
  useTeamStore.setState({ teamIdsByOrgId: emptyIndex, status: 'loaded' });
  useSpecialityStore.setState({ specialityIdsByOrgId: emptyIndex, status: 'loaded' });
  useOrganisationRoomStore.setState({ roomIdsByOrgId: emptyIndex, status: 'loaded' });
  useInvoiceStore.setState({ invoiceIdsByOrgId: emptyIndex, status: 'loaded' });
  useTaskStore.setState({ taskIdsByOrgId: emptyIndex, status: 'loaded' });
  useOrganizationDocumentStore.setState({ documentIdsByOrgId: emptyIndex, status: 'loaded' });
  useIntegrationStore.setState({ integrationIdsByOrgId: emptyIndex, status: 'loaded' });
  useAppointmentStore.setState({
    appointmentIdsByOrgId: emptyIndex,
    appointmentsById: {},
    status: 'loaded',
  });
  useCompanionStore.setState({
    companionsById: {},
    companionsIdsByOrgId: emptyIndex,
    status: 'loaded',
  });
  useFormsStore.setState({ lastFetchedByOrgId: fetchedAt, loading: false });
  useInventoryStore.setState({ lastFetchedByOrgId: fetchedAt });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useTeamStore.setState(snapshots.team);
    useTaskStore.setState(snapshots.task);
    useSpecialityStore.setState(snapshots.speciality);
    useOrganisationRoomStore.setState(snapshots.room);
    useOrgStore.setState(snapshots.org);
    useInvoiceStore.setState(snapshots.invoice);
    useInventoryStore.setState(snapshots.inventory);
    useIntegrationStore.setState(snapshots.integration);
    useFormsStore.setState(snapshots.forms);
    useOrganizationDocumentStore.setState(snapshots.document);
    useCompanionStore.setState(snapshots.companion);
    useAuthStore.setState(snapshots.auth);
    useAppointmentStore.setState(snapshots.appointment);
    if (previousBypass === undefined) delete env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    else env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = previousBypass;
    if (previousHost === undefined) delete env.NEXT_PUBLIC_DOCUMENSO_HOST;
    else env.NEXT_PUBLIC_DOCUMENSO_HOST = previousHost;
    clearInFlightGetRequests();
  };
};

/**
 * A refused fetch is logged twice on its way to the error branch - once by
 * `postData`, once by the portal itself - and the render check treats any
 * console error as a broken story. Only those two lines are dropped.
 */
const EXPECTED_FAILURE_LOGS = ['API postData error:', 'Failed to fetch Documenso portal URL'];

const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) => typeof arg === 'string' && EXPECTED_FAILURE_LOGS.some((line) => arg.includes(line))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const meta = {
  title: 'DocSigning/DocSigning',
  component: DocSigning,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname.
    nextjs: { appDirectory: true, navigation: { pathname: '/doc-signing' } },
    docs: {
      description: {
        component:
          'The Doc Signing route at `/doc-signing`: the route guards, the org loader, and ' +
          '`DocSigningPortal` on its own in the full-height standalone layout.\n\n' +
          'The page adds nothing of its own to the portal beyond the frame it stands in, ' +
          'which is exactly why it is worth a story: the standalone sizing ' +
          '(`calc(100vh - 140px)`) is chosen here rather than in the embedded card on the ' +
          'organisation page, and the two are only comparable side by side. The four ' +
          'branches the portal can land on - loading, an error from the backend, an empty ' +
          'link, and the sandboxed frame - are decided by one POST, so each story pins the ' +
          'transport. The frame itself is a third-party page on another origin and stays ' +
          'blank offline; its geometry and sandbox are what can be read.\n\n' +
          'The route guards are lifted with the local-only bypass flag the shell honours, ' +
          'and the org-scoped stores OrgGuard would load are seeded.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ kind: 'resolves', redirectUrl: REDIRECT_URL }),
} satisfies Meta<typeof DocSigning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Portal: Story = {
  name: 'Portal on its route',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const iframe = await canvas.findByTitle('Doc Signing Portal');
    await expect(iframe).toHaveAttribute('src', REDIRECT_URL);
    await expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-downloads allow-forms allow-modals allow-popups allow-scripts allow-same-origin'
    );
    // Standalone: the viewport less the app chrome above it.
    const container = iframe.parentElement as HTMLElement;
    await expect(
      Math.abs(container.getBoundingClientRect().height - (window.innerHeight - 140))
    ).toBeLessThan(2);
    await expect(canvas.getByText(/could not sign you in automatically/i)).toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading the portal',
  beforeEach: prepare({ kind: 'pending' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('status', { name: 'Loading Doc Signing' })
    ).toBeInTheDocument();
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const RequestFailed: Story = {
  name: 'Error from the backend',
  beforeEach: [
    prepare({ kind: 'rejects', message: 'Doc portal disabled for this practice' }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Doc portal disabled for this practice');
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvas.queryByRole('status')).toBeNull();
  },
};

export const NoPortalUrl: Story = {
  name: 'Empty portal link',
  beforeEach: prepare({ kind: 'resolves', redirectUrl: '' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Document Signing Portal' })
    ).toBeVisible();
    await expect(canvas.getByText('Portal link not available')).toBeVisible();
    // A blank link is a successful 200, so it must not be dressed as a failure.
    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(canvasElement.querySelector('iframe')).toBeNull();
  },
};
