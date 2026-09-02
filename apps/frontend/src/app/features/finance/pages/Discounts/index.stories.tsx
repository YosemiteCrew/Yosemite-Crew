import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Discounts from './index';

const ORG_ID = 'org-storybook-discounts';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * Every shipped role carries `billing:edit:any`, so the read-only page is only
 * reachable through `revokedPermissions` - which is also how a practice really
 * takes billing rights off one person.
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

type CapFixture =
  | { kind: 'resolves'; cap: number | null }
  /** Held open on purpose: the only way to hold the skeleton still. */
  | { kind: 'pending' }
  | { kind: 'rejects'; message: string };

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * The page reads and writes `/v1/finance/organisation/:id/discount-settings`
 * through the shared axios instance, so its adapter is the seam. A PUT is
 * echoed back as the settings the server would store, so the saved figure the
 * page prints is exactly what it sent. The two finance calls OrgGuard's
 * subscription loader makes are answered too, so nothing leaves the preview.
 */
const buildAdapter =
  (fixture: CapFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (url.includes('/discount-settings')) {
      if (method === 'put') {
        const body = JSON.parse(String(config.data ?? '{}')) as {
          maxOverallDiscountPercent: number | null;
        };
        return Promise.resolve(
          respond(config, {
            data: {
              organisationId: ORG_ID,
              maxOverallDiscountPercent: body.maxOverallDiscountPercent,
            },
          })
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
              data: { message: fixture.message },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(
        respond(config, {
          data: { organisationId: ORG_ID, maxOverallDiscountPercent: fixture.cap },
        })
      );
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
 * The page ships behind `ProtectedRoute` and `OrgGuard`. The stories lift both
 * with `NEXT_PUBLIC_DISABLE_AUTH_GUARD` - the local-only flag the shell itself
 * honours through `isLocalGuardBypassEnabled`, which SessionInitializer.stories
 * also flips - so the route renders without a session and without the redirect
 * ladder. OrgGuard still mounts its eleven org-scoped loaders, and each of
 * their stores is seeded with an entry for this org so they short-circuit on
 * `Object.hasOwn(...ByOrgId, primaryOrgId)` rather than reaching the network.
 */
const prepare =
  ({ fixture, revoked = [] }: { fixture: CapFixture; revoked?: string[] }) =>
  () => {
    clearInFlightGetRequests();
    const previousBypass = env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';

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
      subscription: useSubscriptionStore.getState(),
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
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
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
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency: 'GBP' } },
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTeamStore.setState(snapshots.team);
      useTaskStore.setState(snapshots.task);
      useSubscriptionStore.setState(snapshots.subscription);
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

const capInput = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('spinbutton', { name: 'Maximum overall discount percent' });

const meta = {
  title: 'Finance/Discounts',
  component: Discounts,
  parameters: {
    layout: 'fullscreen',
    // Both guards read usePathname; "Back to invoices" is a next/link.
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/discounts' } },
    docs: {
      description: {
        component:
          "The Discounts page: one setting, the organisation's maximum overall invoice " +
          'discount, read from and written to the finance discount-settings endpoint.\n\n' +
          'The empty field is a real value, not a missing one. `null` means no cap, and the ' +
          'copy under the field says so in plain words - "any amount up to 100%" - rather ' +
          'than leaving a blank input to be read as zero. The input re-syncs to the loaded or ' +
          'saved cap during render, keyed on the cap value, so a local edit is not clobbered ' +
          'by a re-render but a save does update it. Validation runs before any request: a ' +
          'value outside 0-100 or that is not a number is refused with an inline alert.\n\n' +
          'The page sits behind `billing:view:any` and the Save button behind ' +
          '`billing:edit:any`, both derived from the seeded role. The stories lift the route ' +
          'guards with the local-only bypass flag the shell honours, seed every org-scoped ' +
          'index OrgGuard would otherwise load, and answer the settings endpoint from the ' +
          'shared axios adapter.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare({ fixture: { kind: 'resolves', cap: 20 } }),
} satisfies Meta<typeof Discounts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Capped: Story = {
  name: 'Cap configured',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Discounts' })).toBeVisible();
    await expect(await canvas.findByText('Invoices are currently capped at 20%.')).toBeVisible();
    await expect(capInput(canvasElement)).toHaveValue(20);
    await expect(canvas.getByRole('button', { name: 'Save discount cap' })).toBeEnabled();
    await expect(canvas.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
    await expect(canvas.getByText('Overall invoice discount cap')).toBeVisible();
  },
};

export const NoCap: Story = {
  name: 'No cap configured',
  beforeEach: prepare({ fixture: { kind: 'resolves', cap: null } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'No cap is configured, so invoices can be discounted by any amount up to 100%.'
      )
    ).toBeVisible();
    // Empty means "no cap", and the placeholder says so rather than showing 0.
    await expect(capInput(canvasElement)).toHaveValue(null);
    await expect(capInput(canvasElement)).toHaveAttribute('placeholder', 'No cap');
  },
};

export const Loading: Story = {
  name: 'Loading the cap',
  beforeEach: prepare({ fixture: { kind: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'Discounts' });
    // A pulsing placeholder stands in for the field; no input, no Save.
    await waitFor(() => expect(canvasElement.querySelector('.animate-pulse')).not.toBeNull());
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Maximum overall discount percent' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Save discount cap' })
    ).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  name: 'Cap could not be loaded',
  beforeEach: [
    prepare({ fixture: { kind: 'rejects', message: 'Discount settings are unavailable.' } }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    // The server's own wording, with a way to try again.
    await expect(alert).toHaveTextContent('Discount settings are unavailable.');
    await expect(
      canvas.getByRole('button', { name: 'Retry loading the discount cap' })
    ).toBeEnabled();
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Maximum overall discount percent' })
    ).not.toBeInTheDocument();
  },
};

export const InvalidCap: Story = {
  name: 'Refuses a cap outside 0-100',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await waitFor(() => capInput(canvasElement));
    await userEvent.clear(input);
    await userEvent.type(input, '150');
    await userEvent.click(canvas.getByRole('button', { name: 'Save discount cap' }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The cap must be between 0 and 100 percent.'
    );
    // Refused before any request, so the loaded figure is still what the copy reports.
    await expect(canvas.getByText('Invoices are currently capped at 20%.')).toBeVisible();
  },
};

export const Saved: Story = {
  name: 'Saving a new cap',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await waitFor(() => capInput(canvasElement));
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.click(canvas.getByRole('button', { name: 'Save discount cap' }));

    // The copy follows the SERVER's echo, not the typed value.
    await expect(await canvas.findByText('Invoices are currently capped at 25%.')).toBeVisible();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Billing edit revoked - no Save',
  beforeEach: prepare({ fixture: { kind: 'resolves', cap: 20 }, revoked: ['billing:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Invoices are currently capped at 20%.')).toBeVisible();
    // The field is still there to read; the action is absent rather than disabled.
    await expect(capInput(canvasElement)).toHaveValue(20);
    await expect(
      canvas.queryByRole('button', { name: 'Save discount cap' })
    ).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Invoices are currently capped at 20%.')).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
