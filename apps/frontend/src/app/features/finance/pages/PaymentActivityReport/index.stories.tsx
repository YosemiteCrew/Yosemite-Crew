import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
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
import { useUserProfileStore } from '@/app/stores/profileStore';
import PaymentActivityReport from './index';

const ORG_ID = 'org-storybook-payment-activity';
const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};
const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  userId: 'user-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+44 20 7946 0958',
    address: {
      addressLine: '14 Harbour Row',
      city: 'Bristol',
      state: 'Bristol',
      postalCode: 'BS1 4RN',
      country: 'United Kingdom',
    },
  },
  professionalDetails: {
    qualification: 'BVSc MRCVS',
    yearsOfExperience: 8,
    specialization: 'Internal medicine',
  },
  status: 'COMPLETED',
};
const AVAILABILITY: ApiDayAvailability = {
  _id: 'availability-monday',
  userId: 'user-storybook',
  organisationId: ORG_ID,
  dayOfWeek: 'MONDAY',
  slots: [{ startTime: '09:00', endTime: '17:00', isAvailable: true }],
};
const REPORT = {
  rows: [
    {
      id: 'payment-1',
      date: '2026-09-27T10:00:00.000Z',
      type: 'Payment' as const,
      status: 'SUCCEEDED',
      provider: 'STRIPE',
      currency: 'GBP',
      amount: 125.5,
      invoiceId: 'INV-1042',
    },
    {
      id: 'refund-1',
      date: '2026-09-27T11:00:00.000Z',
      type: 'Refund' as const,
      status: 'SUCCEEDED',
      provider: 'MANUAL',
      currency: 'GBP',
      amount: 25,
      invoiceId: 'INV-1042',
    },
  ],
  totals: [{ currency: 'GBP', payments: 125.5, refunds: 25, net: 100.5 }],
};

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});
const REAL_ADAPTER = api.defaults.adapter;
type ReportFixture = { kind: 'resolves'; report: typeof REPORT } | { kind: 'too-many' };

const buildAdapter =
  (fixture: ReportFixture): AxiosAdapter =>
  (config) => {
    if (String(config.url ?? '').includes('/reports/payment-activity')) {
      if (fixture.kind === 'too-many') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 422'), {
            isAxiosError: true,
            config,
            response: {
              status: 422,
              statusText: 'Unprocessable Entity',
              data: { message: 'The selected period has too many entries.' },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, { data: fixture.report }));
    }
    return Promise.resolve(respond(config, []));
  };

const prepare = (fixture: ReportFixture) => () => {
  clearInFlightGetRequests();
  const snapshots = {
    appointment: useAppointmentStore.getState(),
    auth: useAuthStore.getState(),
    availability: useAvailabilityStore.getState(),
    companion: useCompanionStore.getState(),
    document: useOrganizationDocumentStore.getState(),
    forms: useFormsStore.getState(),
    integration: useIntegrationStore.getState(),
    inventory: useInventoryStore.getState(),
    invoice: useInvoiceStore.getState(),
    org: useOrgStore.getState(),
    profile: useUserProfileStore.getState(),
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
  useAvailabilityStore.setState({
    availabilitiesById: { [AVAILABILITY._id]: AVAILABILITY },
    availabilityIdsByOrgId: { [ORG_ID]: [AVAILABILITY._id] },
    status: 'loaded',
  });
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: ORG },
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });
  useUserProfileStore.setState({ profilesByOrgId: { [ORG_ID]: PROFILE }, status: 'loaded' });
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
    useAppointmentStore.setState(snapshots.appointment);
    useAuthStore.setState(snapshots.auth);
    useAvailabilityStore.setState(snapshots.availability);
    useCompanionStore.setState(snapshots.companion);
    useOrganizationDocumentStore.setState(snapshots.document);
    useFormsStore.setState(snapshots.forms);
    useIntegrationStore.setState(snapshots.integration);
    useInventoryStore.setState(snapshots.inventory);
    useInvoiceStore.setState(snapshots.invoice);
    useOrgStore.setState(snapshots.org);
    useUserProfileStore.setState(snapshots.profile);
    useOrganisationRoomStore.setState(snapshots.room);
    useSpecialityStore.setState(snapshots.speciality);
    useSubscriptionStore.setState(snapshots.subscription);
    useTaskStore.setState(snapshots.task);
    useTeamStore.setState(snapshots.team);
    clearInFlightGetRequests();
  };
};

const meta = {
  title: 'Finance/PaymentActivityReport (page)',
  component: PaymentActivityReport,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/reports' } },
  },
  beforeEach: prepare({ kind: 'resolves', report: REPORT }),
} satisfies Meta<typeof PaymentActivityReport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Payments and refunds' })
    ).toBeVisible();
    const totals = within(canvas.getByRole('region', { name: 'Report totals' }));
    await expect(totals.getByText('GBP activity')).toBeVisible();
    await expect(totals.getByText('£100.50')).toBeVisible();
    const table = within(await canvas.findByRole('table'));
    // Only a completed refund reads as money going out.
    await expect(table.getByText('−£25.00')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Download CSV report' })).toBeEnabled();
  },
};

export const Empty: Story = {
  beforeEach: prepare({ kind: 'resolves', report: { rows: [], totals: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No payments or refunds were recorded in this period.')
    ).toBeVisible();
  },
};

export const TooManyEntries: Story = {
  beforeEach: prepare({ kind: 'too-many' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The selected period has too many entries. Choose a shorter date range.'
    );
    await expect(canvas.getByRole('button', { name: 'Download PDF report' })).toBeDisabled();
  },
};
