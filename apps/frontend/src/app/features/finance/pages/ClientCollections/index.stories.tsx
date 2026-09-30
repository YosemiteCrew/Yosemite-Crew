import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import type { StoredParent } from '@/app/features/companions/pages/Companions/types';
import ClientCollections from './index';

const ORG_ID = 'org-storybook-collections';
const invoices = [
  {
    invoiceId: '10000000-0000-4000-8000-000000000001',
    parentId: 'parent-story-1',
    dueAt: '2026-09-05T22:59:59.999Z',
    dueDate: '2026-09-05',
    currency: 'GBP',
    balance: 145.5,
    netDays: 14,
    reviewedAt: null,
    reviewedBy: null,
  },
  {
    invoiceId: '20000000-0000-4000-8000-000000000002',
    parentId: 'parent-story-2',
    dueAt: '2026-09-11T22:59:59.999Z',
    dueDate: '2026-09-11',
    currency: 'KWD',
    balance: 82.125,
    netDays: 0,
    reviewedAt: '2026-09-18T00:00:00.000Z',
    reviewedBy: 'staff-story-1',
  },
];

const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const adapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  let data: unknown;
  if (url.endsWith('/collections/overdue')) {
    data = { data: invoices, error: null };
  } else if (url.endsWith('/payment-terms') && config.method === 'put') {
    data = {
      data: { netDays: 30, updatedAt: '2026-09-20T00:00:00.000Z', updatedBy: 'staff-story-1' },
      error: null,
    };
  } else {
    data = {
      data: {
        id: '10000000-0000-4000-8000-000000000001',
        collectionsReviewedAt: '2026-09-20T00:00:00.000Z',
        collectionsReviewedBy: 'staff-story-1',
      },
      error: null,
    };
  }
  return response(config, data);
};

const membership = (readOnly: boolean): UserOrganization => ({
  id: 'membership-story',
  practitionerReference: 'Practitioner/story',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: readOnly ? [PERMISSIONS.BILLING_EDIT_ANY] : [],
});

const setup = (readOnly = false) => {
  clearInFlightGetRequests();
  const originalAdapter = api.defaults.adapter;
  const originalOrg = useOrgStore.getState();
  const originalParents = useParentStore.getState();
  api.defaults.adapter = adapter;
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    status: 'loaded',
    membershipsByOrgId: { [ORG_ID]: membership(readOnly) },
  });
  useParentStore
    .getState()
    .setParents([
      { id: 'parent-story-1', firstName: 'Mara', lastName: 'Jones' } as StoredParent,
      { id: 'parent-story-2', firstName: 'Sam', lastName: 'Lee' } as StoredParent,
    ]);
  return () => {
    api.defaults.adapter = originalAdapter;
    useOrgStore.setState(originalOrg);
    useParentStore.setState(originalParents);
    clearInFlightGetRequests();
  };
};

const meta = {
  title: 'Finance/Overdue accounts',
  component: ClientCollections,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/collections' } },
  },
  beforeEach: () => setup(),
} satisfies Meta<typeof ClientCollections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Queue: Story = {
  name: 'Review before contacting clients',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Overdue accounts' });
    await expect(await canvas.findByRole('heading', { name: 'Mara Jones' })).toBeVisible();
    await expect(canvas.getByText('£145.50')).toBeVisible();
    await expect(canvas.getByText('Due Sep 5, 2026')).toBeVisible();
    // A three-decimal currency keeps its third decimal.
    await expect(canvas.getByText('KWD 82.125')).toBeVisible();
    const [maraTerms, samTerms] = canvas.getAllByRole('spinbutton', {
      name: /Payment due after/,
    });
    await expect(maraTerms).toHaveValue(14);
    await expect(samTerms).toHaveValue(0);
    await userEvent.clear(maraTerms);
    await userEvent.type(maraTerms, '30');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Save payment terms for Mara Jones' })
    );
    await expect(
      await canvas.findByRole('button', { name: 'Save payment terms for Mara Jones' })
    ).toBeEnabled();
    await expect(maraTerms).toHaveValue(30);
    await expect(canvas.getByText(/Reviewed/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Mark invoice 10000000 reviewed' }));
    await expect(canvas.getAllByText(/Reviewed/)).toHaveLength(2);
  },
};

export const ReadOnly: Story = {
  name: 'A billing reader cannot change terms or review',
  beforeEach: () => setup(true),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Mara Jones' });
    await expect(canvas.getByText('Payment due after 14 days')).toBeVisible();
    await expect(canvas.getByText('Needs review')).toBeVisible();
  },
};
